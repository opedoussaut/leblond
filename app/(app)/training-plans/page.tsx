import { redirect } from "next/navigation";

/** Old programmes address: the editor now lives in Programmes; `?add=` (from a method sheet) keeps working. */
export default async function TrainingPlansRedirect({ searchParams }: PageProps<"/training-plans">) {
  const sp = await searchParams;
  redirect(typeof sp.add === "string" ? `/programmes?add=${encodeURIComponent(sp.add)}` : "/programmes");
}
