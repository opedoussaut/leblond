import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, Notice, PageHeader } from "@/components/ui/card";
import { setBetaUserActive } from "@/lib/actions/admin";
import { requireViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Bêta" };

export default async function AdminPage() {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") notFound();
  const { t } = await getI18n(viewer.profile.preferred_language);
  // Aggregates only (no climbing data): see admin_beta_overview() in the migration.
  const { data: rows } = await viewer.supabase.rpc("admin_beta_overview");
  const canManage = createAdminClient() !== null;
  return (
    <div className="space-y-4">
      <PageHeader title={t.admin.title} subtitle={t.admin.intro} />
      {!canManage ? <Notice tone="warn">{t.admin.notConfigured}</Notice> : null}
      <ul className="space-y-2">
        {(rows ?? []).map((r) => (
          <li key={r.email}>
            <Card className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold">{r.display_name}</span>
                <span className="text-xs uppercase tracking-wider text-ink-3">{r.role}</span>
              </div>
              <p className="text-sm text-ink-2">{r.email}</p>
              <p className="text-sm text-ink-2">
                {t.admin.active}: {r.active ? t.common.yes : t.common.no} · {t.admin.account}:{" "}
                {r.has_account ? t.common.yes : t.common.no} · {t.admin.coach30d}: {r.coach_requests_30d}
              </p>
              {canManage && r.role !== "admin" ? (
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
