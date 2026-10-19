import Link from "next/link";
import { PlanEditor } from "@/components/training/plan-editor";
import { requireViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";
import { trainingDictionary } from "@/lib/i18n/training";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";
import { trainingPlanSchema, type SavedTrainingPlan } from "@/lib/training/plans";
import { localDate_, mondayOf } from "@/lib/training/sessions";

export const metadata = { title: "Training plans" };

export default async function TrainingPlansPage({ searchParams }: PageProps<"/training-plans">) {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const t = trainingDictionary(locale);
  const sp = await searchParams;
  const addMethod = typeof sp.add === "string" && METHODS_FOR_PLANS.some((m) => m.id === sp.add) ? sp.add : "";
  const today = localDate_(new Date());
  const { data, error } = await viewer.supabase.from("training_plans")
    .select("id, name, goal, weeks, sessions, updated_at")
    .order("updated_at", { ascending: false })
    .limit(20);

  const plans: SavedTrainingPlan[] = (data ?? []).flatMap((row) => {
    const parsed = trainingPlanSchema.safeParse({
      id: row.id,
      name: row.name,
      goal: row.goal,
      weeks: row.weeks,
      sessions: row.sessions,
    });
    return parsed.success ? [{ ...parsed.data, id: row.id, updatedAt: row.updated_at }] : [];
  });

  return (
    <div>
      <Link href="/train" className="text-sm font-bold text-accent underline underline-offset-4">← {t.back}</Link>
      <h1 className="mt-5 text-3xl font-black tracking-tight">{t.planTitle}</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{t.plansSubtitle}</p>
      {error ? (
        <p role="alert" className="mt-5 rounded-xl border border-warn bg-surface p-4 text-sm text-ink-2">{t.unavailable}</p>
      ) : (
        <PlanEditor initialPlans={plans} locale={locale} addMethod={addMethod} today={today} monday={mondayOf(today)} />
      )}
    </div>
  );
}
