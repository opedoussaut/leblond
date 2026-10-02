"use client";

import { useActionState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Label, Select, Textarea } from "@/components/ui/field";
import { updateProject } from "@/lib/actions/projects";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/climbing/types";

export function ProjectForm({ projectId, status, notes }: { projectId: string; status: ProjectStatus; notes: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(updateProject.bind(null, projectId), null);
  return (
    <Card>
      <form action={action} className="space-y-3">
        <div>
          <Label htmlFor="proj-status">{t.projects.setStatus}</Label>
          <Select id="proj-status" name="status" defaultValue={status}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.projects.status[s]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="proj-notes">{t.projects.notes}</Label>
          <Textarea id="proj-notes" name="notes" defaultValue={notes} maxLength={4000} />
        </div>
        {state?.ok ? <Notice tone="ok">✓</Notice> : state ? <Notice tone="error">{t.common.unknownError}</Notice> : null}
        <Button type="submit" disabled={pending}>
          {pending ? t.common.saving : t.common.save}
        </Button>
      </form>
    </Card>
  );
}
