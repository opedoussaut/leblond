import { TrainingAssessmentView } from "@/components/training/assessment-page-view";
export const metadata = { title: "LEBLOND — Full assessment" };
export default async function TrainingJourneyAssessmentPage({ searchParams }: PageProps<"/train/assess">) {
  const sp = await searchParams;
  return <TrainingAssessmentView backHref="/programmes" startInForm={sp.new === "1"} />;
}
