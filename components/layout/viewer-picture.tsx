import { Suspense } from "react";
import { ProfilePicture } from "@/components/training/profile-picture";
import { viewerPicture } from "@/lib/data/profile-picture";
import { Avatar } from "./account-menu";

async function Picture({ size }: { size: number }) {
  const { photoUrl, level } = await viewerPicture();
  return <ProfilePicture photoUrl={photoUrl} level={level} size={size} />;
}

/**
 * The signed-in climber's picture for the app shell (account menu): photo or
 * avatar. It streams in so computing the avatar never delays the page; the
 * initials hold its place meanwhile.
 */
export function ViewerPicture({ name, size }: { name: string; size: number }) {
  return <Suspense fallback={<Avatar name={name} size={size} />}><Picture size={size} /></Suspense>;
}
