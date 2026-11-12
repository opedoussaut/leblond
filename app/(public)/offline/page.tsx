import { Wordmark } from "@/components/brand/wordmark";
import { getI18n } from "@/lib/i18n/server";
import { LIVE_KEY } from "@/lib/offline/session-store";

/*
 * Shown by the service worker when a page cannot load without signal. If a
 * live session is kept on this phone, a link reopens it (its kept copy works
 * offline). Plain inline script: this page must work even when the app's
 * scripts could not be kept.
 */
const resumeScript = `(function(){try{
var v=JSON.parse(localStorage.getItem(${JSON.stringify(LIVE_KEY)})||"null");
if(!v||!/^[0-9a-f-]{36}$/.test(v.sessionId))return;
var a=document.getElementById("lb-resume");if(!a)return;
a.href="/session/"+v.sessionId;
a.textContent=a.getAttribute("data-label").replace("{gym}",String(v.gymName||"").slice(0,80));
a.hidden=false;
}catch(e){}})();`;

export default async function OfflinePage() {
  const { t } = await getI18n();
  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <Wordmark />
      <h1 className="mt-8 text-2xl font-black tracking-tight md:text-3xl">{t.pwa.offlineTitle}</h1>
      <p className="mt-2 text-ink-2">{t.pwa.offlineBody}</p>
      {/* A full page load on purpose: the service worker then serves the session's kept copy. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        id="lb-resume"
        hidden
        suppressHydrationWarning
        href="/session"
        data-label={t.pwa.resume}
        className="mt-6 inline-flex min-h-12 items-center rounded-2xl bg-accent px-5 font-bold text-accent-ink"
      >
        {t.pwa.resume}
      </a>
      <script dangerouslySetInnerHTML={{ __html: resumeScript }} />
    </main>
  );
}
