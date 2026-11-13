import { redirect } from "next/navigation";

/** Old training hub: the programme, mobility and the rival now live in Programmes. */
export default function TrainingRedirect() {
  redirect("/programmes");
}
