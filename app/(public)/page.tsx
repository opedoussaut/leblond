import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";

/** LEBLOND is member-only: visitors go straight to the clean sign-in. */
export default async function LandingPage() {
  const viewer = await getViewer().catch(() => null);
  redirect(viewer ? "/home" : "/login");
}
