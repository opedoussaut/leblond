import { expect, type Page } from "@playwright/test";

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Read the latest sign-in code sent to `email` from the local Mailpit inbox. */
export async function latestOtp(email: string, after: number): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const list = (await res.json()) as { messages?: Array<{ ID: string; Created: string }> };
    const msg = list.messages?.find((m) => new Date(m.Created).getTime() >= after - 2000);
    if (msg) {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()) as { Text: string };
      const code = full.Text.match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no OTP email for ${email}`);
}

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  const sentAt = Date.now();
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  await expect(page.getByLabel("Code reçu par e-mail")).toBeVisible();
  await page.getByLabel("Code reçu par e-mail").fill(await latestOtp(email, sentAt));
  await page.getByRole("button", { name: "Valider" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
