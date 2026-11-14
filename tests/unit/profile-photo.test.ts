import { describe, expect, it } from "vitest";
import { profilePhotoDictionary } from "@/lib/i18n/profile-photo";
import {
  PROFILE_PHOTO_MAX_BYTES, PROFILE_PHOTO_SOURCE_MAX_BYTES, isOwnProfilePhotoPath, isProfilePhotoType,
  pictureSource, profilePhotoPath, squareCrop,
} from "@/lib/profile-photo";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const FILE = "33333333-3333-4333-8333-333333333333";

describe("profile picture: photo if uploaded, else the avatar", () => {
  it("shows the avatar when there is no photo", () => {
    expect(pictureSource(null, 3)).toEqual({ kind: "avatar", level: 3 });
    expect(pictureSource(undefined, 0)).toEqual({ kind: "avatar", level: 0 });
    expect(pictureSource("", 6)).toEqual({ kind: "avatar", level: 6 });
  });
  it("shows the photo when one was uploaded", () => {
    expect(pictureSource("https://x.supabase.co/storage/v1/object/sign/media/a.webp?token=t", 2))
      .toEqual({ kind: "photo", src: "https://x.supabase.co/storage/v1/object/sign/media/a.webp?token=t" });
  });
});

describe("profile photo storage path", () => {
  it("lives in the climber's own folder of the private bucket", () => {
    expect(profilePhotoPath(ME, FILE, "image/webp")).toBe(`${ME}/profile/${FILE}.webp`);
    expect(profilePhotoPath(ME, FILE, "image/jpeg")).toBe(`${ME}/profile/${FILE}.jpg`);
    expect(isOwnProfilePhotoPath(ME, profilePhotoPath(ME, FILE, "image/png"))).toBe(true);
  });
  it("rejects anything that is not the viewer's own profile photo", () => {
    for (const bad of [
      null, undefined, "", `${OTHER}/profile/${FILE}.webp`, `${ME}/${FILE}/${FILE}.webp`, `${ME}/profile/${FILE}.mp4`,
      `${ME}/profile/../${OTHER}/x.webp`, `${ME}/profile/sub/${FILE}.webp`, `https://evil.example/${ME}/profile/${FILE}.webp`,
      `/${ME}/profile/${FILE}.webp`, `${ME}/profile/${FILE}.webp?x=1`,
    ]) expect(isOwnProfilePhotoPath(ME, bad), String(bad)).toBe(false);
    expect(isOwnProfilePhotoPath("", `/profile/${FILE}.webp`)).toBe(false);
  });
  it("accepts only small resized images", () => {
    expect(isProfilePhotoType("image/webp")).toBe(true);
    expect(isProfilePhotoType("image/jpeg")).toBe(true);
    expect(isProfilePhotoType("image/heic")).toBe(false);
    expect(isProfilePhotoType("video/mp4")).toBe(false);
    expect(PROFILE_PHOTO_MAX_BYTES).toBeLessThan(PROFILE_PHOTO_SOURCE_MAX_BYTES);
  });
});

describe("square crop", () => {
  it("keeps the centre of landscape and portrait photos", () => {
    expect(squareCrop(4000, 3000)).toEqual({ sx: 500, sy: 0, side: 3000 });
    expect(squareCrop(3000, 4000)).toEqual({ sx: 0, sy: 500, side: 3000 });
    expect(squareCrop(512, 512)).toEqual({ sx: 0, sy: 0, side: 512 });
    expect(squareCrop(101, 100)).toEqual({ sx: 1, sy: 0, side: 100 });
  });
});

describe("profile photo strings", () => {
  it("exist in French and English with the same keys", () => {
    const fr = profilePhotoDictionary("fr");
    const en = profilePhotoDictionary("en");
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    expect(fr.remove).not.toBe(en.remove);
    for (const v of [...Object.values(fr), ...Object.values(en)]) expect(v.trim()).not.toBe("");
  });
});
