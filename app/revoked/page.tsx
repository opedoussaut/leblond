import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/(public)/login/actions";
import { getI18n } from "@/lib/i18n/server";

export default async function RevokedPage() {
  const { t } = await getI18n();
  return (
    <main className="pt-safe mx-auto max-w-md px-5 py-8">
      <Wordmark />
      <h1 className="mt-8 text-2xl font-black">{t.auth.revokedTitle}</h1>
      <p className="mt-2 text-ink-2">{t.auth.revokedBody}</p>
      <form action={signOut} className="mt-6">
        <Button type="submit" variant="secondary">
          {t.auth.signOut}
        </Button>
      </form>
    </main>
  );
}
