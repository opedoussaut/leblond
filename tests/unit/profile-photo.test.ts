import { describe, expect, it } from "vitest";
import { profilePhotoDictionary } from "@/lib/i18n/profile-photo";
import { rivalDictionary } from "@/lib/i18n/rival";
import {
  PROFILE_PHOTO_MAX_BYTES, PROFILE_PHOTO_SOURCE_MAX_BYTES, RIVAL_PHOTO_FOLDER, isOwnPhotoPath, isOwnProfilePhotoPath, isProfilePhotoType,
  photoObjectPath, pictureSource, profilePhotoPath, squareCrop,
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

describe("the rival's photo storage path", () => {
  it("lives in the climber's own rival folder, apart from the profile photo", () => {
    const rival = photoObjectPath(ME, RIVAL_PHOTO_FOLDER, FILE, "image/webp");
    expect(rival).toBe(`${ME}/rival/${FILE}.webp`);
    expect(isOwnPhotoPath(ME, RIVAL_PHOTO_FOLDER, rival)).toBe(true);
    expect(isOwnProfilePhotoPath(ME, rival)).toBe(false);
    expect(isOwnPhotoPath(ME, RIVAL_PHOTO_FOLDER, profilePhotoPath(ME, FILE, "image/webp"))).toBe(false);
  });
  it("rejects another climber's folder and anything else", () => {
    for (const bad of [
      null, `${OTHER}/rival/${FILE}.webp`, `${ME}/rival/${FILE}.gif`, `${ME}/rival/x/${FILE}.webp`,
      `https://evil.example/${ME}/rival/${FILE}.webp`, `${ME}/rival/${FILE}.webp#x`,
    ]) expect(isOwnPhotoPath(ME, RIVAL_PHOTO_FOLDER, bad), String(bad)).toBe(false);
  });
  it("has the same strings in French and English", () => {
    const fr = rivalDictionary("fr");
    const en = rivalDictionary("en");
    expect(Object.keys(en.photo).sort()).toEqual(Object.keys(fr.photo).sort());
    for (const v of [...Object.values(fr.photo), ...Object.values(en.photo), fr.name, en.name, fr.nameHint, en.nameHint]) {
      expect(v.trim()).not.toBe("");
    }
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
