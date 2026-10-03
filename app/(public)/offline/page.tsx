import { Wordmark } from "@/components/brand/wordmark";
import { getI18n } from "@/lib/i18n/server";

export default async function OfflinePage() {
  const { t } = await getI18n();
  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <Wordmark />
      <h1 className="mt-8 text-2xl font-black">{t.pwa.offlineTitle}</h1>
      <p className="mt-2 text-ink-2">{t.pwa.offlineBody}</p>
    </main>
  );
}
