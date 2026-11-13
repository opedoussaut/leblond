import { TrainingAssessmentView } from "@/components/training/assessment-page-view";
export const metadata = { title: "LEBLOND — Full assessment" };
export default function TrainingJourneyAssessmentPage() {
  return <TrainingAssessmentView backHref="/programmes" />;
}
