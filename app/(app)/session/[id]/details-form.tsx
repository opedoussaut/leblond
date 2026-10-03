"use client";

import { useActionState, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, Notice, SectionTitle } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/field";
import { cn } from "@/components/ui/cn";
import { deleteSession, updateSessionDetails } from "@/lib/actions/sessions";

type Scale = number | null;

function ScaleInput({ name, label, value }: { name: string; label: string; value: Scale }) {
  const [v, setV] = useState<Scale>(value);
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold">{label}</legend>
      <input type="hidden" name={name} value={v ?? ""} />
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={v === n}
            onClick={() => setV(v === n ? null : n)}
            className={cn(
              "h-11 w-11 rounded-full border font-bold tabular-nums",
              v === n ? "border-accent bg-accent text-accent-ink" : "border-line text-ink-2",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SessionDetailsForm({
  sessionId,
  initial,
}: {
  sessionId: string;
  initial: { notes: string; perceivedEnergyBefore: Scale; perceivedEnergyAfter: Scale; fatigue: Scale; motivation: Scale };
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(updateSessionDetails.bind(null, sessionId), null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <Card>
      <form action={action} className="space-y-4">
        <SectionTitle>{t.session.feelings}</SectionTitle>
        <p className="text-xs text-ink-3">{t.session.scaleHint}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ScaleInput name="perceivedEnergyBefore" label={t.session.energyBefore} value={initial.perceivedEnergyBefore} />
          <ScaleInput name="perceivedEnergyAfter" label={t.session.energyAfter} value={initial.perceivedEnergyAfter} />
          <ScaleInput name="fatigue" label={t.session.fatigue} value={initial.fatigue} />
          <ScaleInput name="motivation" label={t.session.motivation} value={initial.motivation} />
        </div>
        <div>
          <Label htmlFor="session-notes">{t.session.notes}</Label>
          <Textarea id="session-notes" name="notes" defaultValue={initial.notes} maxLength={4000} placeholder={t.session.notesPlaceholder} />
        </div>
        {state && !state.ok ? <Notice tone="error">{t.common.unknownError}</Notice> : null}
        {state?.ok ? <Notice tone="ok">✓</Notice> : null}
        <Button type="submit" disabled={pending}>
          {pending ? t.common.saving : t.common.save}
        </Button>
      </form>
      <div className="mt-6 border-t border-line pt-4">
        {confirmDelete ? (
          <form action={deleteSession.bind(null, sessionId)} className="space-y-2">
            <p className="text-sm">{t.session.deleteSessionConfirm}</p>
            <div className="flex gap-2">
              <Button type="submit" variant="danger">
                {t.common.confirmDelete}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                {t.common.cancel}
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>
            {t.session.deleteSession}
          </Button>
        )}
      </div>
    </Card>
  );
}
