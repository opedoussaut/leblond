"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { deleteMedia } from "@/lib/actions/media";

type Item = { id: string; type: string; mime: string; url: string | null };

export function MediaGallery({ items }: { items: Item[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  if (items.length === 0) return <p className="text-sm text-ink-2">{t.problem.noMedia}</p>;
  return (
    <ul className="grid grid-cols-2 gap-2">
      {items.map((m) => (
        <li key={m.id} className="overflow-hidden rounded-xl border border-line bg-surface-2">
          {m.url ? (
            m.mime.startsWith("video/") ? (
              <video src={m.url} controls playsInline preload="metadata" className="aspect-square w-full object-cover" />
            ) : (
              // Signed, short-lived private URLs: plain <img> avoids proxying private media through the optimiser.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.url} alt={t.problem.addPhoto} className="aspect-square w-full object-cover" loading="lazy" />
            )
          ) : null}
          <div className="flex items-center justify-between px-2 py-1 text-xs">
            <span className="text-ink-3">
              {m.type === "PROBLEM_PHOTO" ? t.problem.addPhoto : m.type === "SEND_VIDEO" ? t.problem.sendVideo : t.problem.attemptVideo}
            </span>
            <button
              type="button"
              disabled={pending}
              className="min-h-10 px-2 text-danger"
              onClick={() =>
                start(async () => {
                  await deleteMedia(m.id);
                  router.refresh();
                })
              }
            >
              {t.common.delete}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
