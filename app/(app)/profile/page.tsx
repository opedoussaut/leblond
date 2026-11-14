import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, SectionTitle } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { signOut } from "@/app/(public)/login/actions";
import { requireViewer } from "@/lib/auth/viewer";
import { gradeLabel } from "@/lib/grading/labels";
import { includesBoulder, includesRoute } from "@/lib/climbing/goals";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";
import { coachSessionsDictionary } from "@/lib/i18n/coach-sessions";
import { profilePhotoDictionary } from "@/lib/i18n/profile-photo";
import { avatarDictionary } from "@/lib/i18n/avatar";
import { AVATAR_LEVELS } from "@/lib/analytics/avatar";
import { viewerPicture } from "@/lib/data/profile-picture";
import { ProfilePicture } from "@/components/training/profile-picture";
import { linkClass } from "@/components/ui/button";

export const metadata = { title: "Profil" };

export default async function ProfilePage() {
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const p = viewer.profile;
  const picture = await viewerPicture();
  const ph = profilePhotoDictionary(locale);
  const av = avatarDictionary(locale);
  const colour = av.colour[AVATAR_LEVELS[picture.level] ?? "WHITE"];
  const links = [
    { href: "/projects", label: t.nav.projects },
    { href: "/settings", label: t.profile.edit },
    { href: "/settings/connections", label: t.nav.connections },
    { href: "/settings#coach-keys-heading", label: coachSessionsDictionary(locale).keys.title },
    ...(viewer.role === "admin" ? [{ href: "/settings/admin", label: t.profile.admin }] : []),
  ];
  return (
    <div className="space-y-5">
      <PageHeader icon={<PAGE_ICONS.profile />} title={p.display_name || t.profile.title} subtitle={viewer.email} />
      <Card className="flex items-center gap-4">
        <span className="shrink-0 p-1">
          <ProfilePicture photoUrl={picture.photoUrl} level={picture.level} size={72}
            label={picture.photoUrl ? ph.yourPhoto : fmt(av.portraitLabel, { colour })} />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-ink-2">{picture.photoUrl ? ph.usingPhoto : ph.usingAvatar}</p>
          <Link href="/settings#profile-photo-heading" className={linkClass + " text-sm"}>{ph.edit}</Link>
        </div>
      </Card>
      <Card>
        <dl className="divide-y divide-line text-sm">
          <div className="flex justify-between py-2">
            <dt className="text-ink-2">{t.profile.target}</dt>
            <dd className="font-semibold">
              {includesBoulder(p.target_discipline) ? (
                <span>{t.onboarding.goalBoulder}: {gradeLabel(t, p.target_grade_system, p.target_grade)}</span>
              ) : null}
              {p.target_discipline === "BOTH" ? <span> · </span> : null}
              {includesRoute(p.target_discipline) ? (
                <span>{t.onboarding.goalRoute}: {p.target_route_grade}</span>
              ) : null}
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-ink-2">{t.profile.discipline}</dt>
            <dd className="font-semibold">
              {p.target_discipline === "BOTH" ? t.onboarding.goalBoth :
               p.target_discipline === "ROUTE" ? t.onboarding.goalRoute : t.onboarding.goalBoulder}
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-ink-2">{t.profile.language}</dt>
            <dd className="font-semibold">{p.preferred_language === "en" ? t.settings.languageEn : t.settings.languageFr}</dd>
          </div>
        </dl>
      </Card>
      <Card>
        <SectionTitle>{t.profile.links}</SectionTitle>
        <ul className="mt-2 divide-y divide-line">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex min-h-12 items-center justify-between font-semibold">
                {l.label}
                <span aria-hidden className="text-ink-3">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <form action={signOut}>
        <Button type="submit" variant="ghost" className="w-full">
          {t.auth.signOut}
        </Button>
      </form>
    </div>
  );
}
