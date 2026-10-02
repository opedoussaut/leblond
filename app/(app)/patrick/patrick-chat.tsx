"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { PatrickAvatar } from "@/components/brand/wordmark";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Select } from "@/components/ui/field";
import { QUICK_ACTIONS, type QuickAction } from "@/lib/coach/context";
import { fmt } from "@/lib/i18n";

type Msg = { id: string; role: "user" | "assistant"; content: string };

/** Minimal, injection-safe rendering of **bold**, lists and paragraphs. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}

function RichText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`l${blocks.length}`} className="ml-5 list-disc space-y-1">
          {list.map((li, i) => (
            <li key={i}>
              <Inline text={li} />
            </li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const item = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (item) {
      list.push(item[1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    blocks.push(
      <p key={`p${blocks.length}`} className={heading ? "font-bold" : undefined}>
        <Inline text={heading ? heading[1] : line} />
      </p>,
    );
  }
  flush();
  return <div className="space-y-2">{blocks}</div>;
}

export function PatrickChat({
  configured,
  dailyLimit,
  conversations,
  conversationId: initialConversationId,
  initialMessages,
  projects,
  focus,
}: {
  configured: boolean;
  dailyLimit: number;
  conversations: Array<{ id: string; title: string; updated_at: string }>;
  conversationId: string | null;
  initialMessages: Msg[];
  projects: Array<{ id: string; label: string }>;
  focus: { sessionId: string | null; projectId: string | null; initialAction: QuickAction | null };
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickProject, setPickProject] = useState(false);
  const [projectId, setProjectId] = useState(focus.projectId ?? projects[0]?.id ?? "");
  const autoSent = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // scrollIntoView may return a Promise in recent browsers: never return it from an effect.
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(text: string, extra: { quickAction?: QuickAction; sessionId?: string | null; projectId?: string | null } = {}) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: text };
    const botId = `a-${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: botId, role: "assistant", content: "" }]);
    setInput("");
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: text,
          quickAction: extra.quickAction ?? null,
          sessionId: extra.sessionId ?? null,
          projectId: extra.projectId ?? null,
        }),
      });
      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; limit?: number };
        setMessages((m) => m.filter((x) => x.id !== botId));
        setError(
          err.error === "not_configured"
            ? t.patrick.notConfigured
            : err.error === "rate_limited"
              ? fmt(t.patrick.rateLimited, { limit: err.limit ?? dailyLimit })
              : t.patrick.error,
        );
        return;
      }
      const cid = res.headers.get("X-Conversation-Id");
      if (cid && cid !== conversationId) {
        setConversationId(cid);
        window.history.replaceState(null, "", `/patrick?c=${cid}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => m.map((x) => (x.id === botId ? { ...x, content: x.content + chunk } : x)));
      }
      router.refresh();
    } catch {
      setError(t.patrick.error);
    } finally {
      setBusy(false);
    }
  }

  function quick(action: QuickAction) {
    if (action === "project") {
      if (!projects.length) return setError(t.patrick.noProjects);
      return setPickProject(true);
    }
    void send(t.patrick.quick[action], { quickAction: action, sessionId: focus.sessionId });
  }

  // Arriving from "Ask Patrick about this session/project".
  useEffect(() => {
    if (autoSent.current || !configured || !focus.initialAction) return;
    autoSent.current = true;
    void send(t.patrick.quick[focus.initialAction], {
      quickAction: focus.initialAction,
      sessionId: focus.sessionId,
      projectId: focus.projectId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col">
      <header className="flex items-start gap-3">
        <PatrickAvatar size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black">{t.patrick.title}</h1>
          <p className="text-sm text-ink-2">{t.patrick.subtitle}</p>
        </div>
        {messages.length ? (
          <Link href="/patrick" className="shrink-0 text-sm text-accent" onClick={() => setMessages([])}>
            {t.patrick.newConversation}
          </Link>
        ) : null}
      </header>

      {!configured ? (
        <div className="mt-4">
          <Notice tone="warn">{t.patrick.notConfigured}</Notice>
        </div>
      ) : null}

      <div className="mt-4 flex-1 space-y-3" aria-live="polite">
        {messages.length === 0 ? (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">{t.patrick.quickActions}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  disabled={!configured || busy}
                  onClick={() => quick(a)}
                  className="min-h-14 rounded-2xl border border-line bg-surface px-4 text-left text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
                >
                  {t.patrick.quick[a]}
                </button>
              ))}
            </div>
            {pickProject ? (
              <div className="flex gap-2 rounded-2xl border border-line p-3">
                <label className="sr-only" htmlFor="pick-project">
                  {t.patrick.pickProject}
                </label>
                <Select id="pick-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
                <Button
                  onClick={() => {
                    setPickProject(false);
                    void send(t.patrick.quick.project, { quickAction: "project", projectId });
                  }}
                >
                  {t.patrick.send}
                </Button>
              </div>
            ) : null}
            {conversations.length ? (
              <div className="pt-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">{t.patrick.conversations}</p>
                <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">
                  {conversations.map((c) => (
                    <li key={c.id}>
                      <Link href={`/patrick?c=${c.id}`} className="block truncate px-4 py-3 text-sm hover:bg-surface-2">
                        {c.title || "…"}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "max-w-[92%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed",
                m.role === "user" ? "ml-auto bg-accent text-accent-ink" : "bg-surface border border-line",
              )}
            >
              {m.role === "assistant" ? (
                m.content ? <RichText text={m.content} /> : <span className="text-ink-3">{t.patrick.thinking}</span>
              ) : (
                m.content
              )}
            </div>
          ))
        )}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-24 mt-4 flex gap-2 rounded-2xl bg-bg py-2 md:bottom-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <label htmlFor="patrick-input" className="sr-only">
          {t.patrick.placeholder}
        </label>
        <input
          id="patrick-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          disabled={!configured}
          placeholder={t.patrick.placeholder}
          className="min-h-12 flex-1 rounded-xl border border-line bg-surface px-3"
        />
        <Button type="submit" disabled={!configured || busy || !input.trim()}>
          {busy ? "…" : t.patrick.send}
        </Button>
      </form>
      <p className="mt-1 text-[11px] text-ink-3">
        {t.patrick.contextNote} {t.patrick.disclaimer}
      </p>
    </div>
  );
}
