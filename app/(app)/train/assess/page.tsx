import { TrainingAssessmentView } from "@/components/training/assessment-page-view";
export const metadata = { title: "LEBLOND — Training baseline protocol" };
export default function TrainingJourneyAssessmentPage() {
  return <TrainingAssessmentView backHref="/train" />;
}
