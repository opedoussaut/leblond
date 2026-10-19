import { TrainingAssessmentView } from "@/components/training/assessment-page-view";
export const metadata = { title: "Climbing assessment & tracking" };
export default function TrainingAssessmentPage() {
  return <TrainingAssessmentView backHref="/follow-up" />;
}
