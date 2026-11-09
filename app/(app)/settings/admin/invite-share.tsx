"use client";

import { useId, useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";

/**
 * One pending invitation link: shown in full (selectable), with ready-made
 * WhatsApp / Telegram messages, copy, and the phone's own share sheet.
 * Nothing is sent from LEBLOND: the admin sends the message from their app.
 */
export function InviteShare({
  url,
  message,
  whatsapp,
  telegram,
  labels,
}: {
  url: string;
  message: string;
  whatsapp: string;
  telegram: string;
  labels: { link: string; copy: string; copied: string; share: string };
}) {
  const id = useId();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard refused (permissions, old browser): the link stays selectable in the field.
    }
  }

  async function share() {
    if (typeof navigator.share !== "function") return copy();
    try {
      await navigator.share({ title: "LEBLOND", text: message, url });
    } catch {
      // Share sheet closed without sending.
    }
  }

  return (
    <div className="space-y-2">
      <input
        id={id}
        readOnly
        value={url}
        aria-label={labels.link}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-ink"
      />
      <div className="flex flex-wrap gap-2">
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
          WhatsApp
        </a>
        <a href={telegram} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
          Telegram
        </a>
        <Button type="button" variant="secondary" size="sm" onClick={copy}>
          {copied ? labels.copied : labels.copy}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={share}>
          {labels.share}
        </Button>
      </div>
    </div>
  );
}
