import { redirect } from "next/navigation";

/** Old climbing home: climbing séances now live in the Journal (Séances). */
export default function ClimbingRedirect() {
  redirect("/session?type=climb");
}
