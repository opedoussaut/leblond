import { redirect } from "next/navigation";

/** The rival moved to its own area. */
export default function AlterEgoMoved() {
  redirect("/rival");
}
