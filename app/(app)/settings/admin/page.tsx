import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, Notice, PageHeader, SectionTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { createBetaInvite, revokeBetaInvite, setBetaUserActive } from "@/lib/actions/admin";
import { inviteLink, inviteStatus, shareLinks } from "@/lib/auth/invite-code";
import { requireViewer } from "@/lib/auth/viewer";
import { siteUrl } from "@/lib/env";
import { fmt, intlLocale } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { InviteShare } from "./invite-share";

export const metadata = { title: "Bêta" };

export default async function AdminPage({ searchParams }: PageProps<"/settings/admin">) {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") notFound();
  const params = await searchParams;
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  // Aggregates only (no climbing data): see admin_beta_overview() in the migration.
  const { data: rows } = await viewer.supabase.rpc("admin_beta_overview");
  // Invitation links: RLS shows them to the admin only.
  const { data: invites } = await viewer.supabase
    .from("beta_invites")
    .select("id, code, label, expires_at, redeemed_at, revoked_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  const day = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "long", timeZone: "Europe/Paris" });
  const base = siteUrl();

  return (
    <div className="space-y-4">
      <PageHeader title={t.admin.title} subtitle={t.admin.intro} />

      <Card className="space-y-3">
        <SectionTitle>{t.admin.invitesTitle}</SectionTitle>
        <p className="text-sm text-ink-2">{t.admin.invitesIntro}</p>
        {params.error === "invite" ? <Notice tone="error">{t.admin.inviteError}</Notice> : null}
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          action={async (formData: FormData) => {
            "use server";
            const result = await createBetaInvite(String(formData.get("label") ?? ""));
            redirect(result.ok ? "/settings/admin" : "/settings/admin?error=invite");
          }}
        >
          <div className="flex-1">
            <Label htmlFor="invite-for">{t.admin.inviteFor}</Label>
            <Input id="invite-for" name="label" maxLength={60} autoComplete="off" placeholder={t.admin.inviteForPlaceholder} />
          </div>
          <Button type="submit">{t.admin.createInvite}</Button>
        </form>
      </Card>

      {invites && invites.length > 0 ? (
        <ul aria-label={t.admin.invitesList} className="space-y-2">
          {invites.map((invite) => {
            const status = inviteStatus(invite);
            const url = inviteLink(base, invite.code);
            const links = shareLinks(t.admin.shareMessage, url);
            const statusText =
              status === "pending" ? fmt(t.admin.statusPending, { date: day.format(new Date(invite.expires_at)) })
              : status === "used" ? fmt(t.admin.statusUsed, { date: day.format(new Date(invite.redeemed_at ?? invite.created_at)) })
              : status === "expired" ? t.admin.statusExpired
              : t.admin.statusRevoked;
            return (
              <li key={invite.id}>
                <Card className={"space-y-2" + (status === "pending" ? "" : " opacity-70")}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold">{invite.label || t.admin.inviteNoName}</span>
                    <span className="text-xs text-ink-3">{statusText}</span>
                  </div>
                  {status === "pending" ? (
                    <>
                      <InviteShare
                        url={url}
                        message={t.admin.shareMessage}
                        whatsapp={links.whatsapp}
                        telegram={links.telegram}
                        labels={{ link: t.admin.inviteLink, copy: t.admin.copyLink, copied: t.admin.linkCopied, share: t.admin.shareLink }}
                      />
                      <form
                        action={async () => {
                          "use server";
                          await revokeBetaInvite(invite.id);
                        }}
                      >
                        <Button type="submit" variant="ghost" size="sm">{t.admin.revokeInvite}</Button>
                      </form>
                    </>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}

      <ul className="space-y-2">
        {(rows ?? []).map((r) => (
          <li key={r.email}>
            <Card className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold">{r.display_name}</span>
                <span className="text-xs uppercase tracking-[0.12em] text-ink-3">{r.role}</span>
              </div>
              <p className="text-sm text-ink-2">{r.email}</p>
              <p className="text-sm text-ink-2">
                {t.admin.active}: {r.active ? t.common.yes : t.common.no} · {t.admin.account}:{" "}
                {r.has_account ? t.common.yes : t.common.no} · {t.admin.coach30d}: {r.coach_requests_30d}
              </p>
              {r.role !== "admin" ? (
                <form
                  action={async () => {
                    "use server";
                    await setBetaUserActive(r.email, !r.active);
                  }}
                >
                  <Button type="submit" variant={r.active ? "danger" : "secondary"}>
                    {r.active ? t.admin.deactivate : t.admin.activate}
                  </Button>
                </form>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
