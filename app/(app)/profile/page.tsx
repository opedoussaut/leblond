import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, SectionTitle } from "@/components/ui/card";
import { signOut } from "@/app/(public)/login/actions";
import { requireViewer } from "@/lib/auth/viewer";
import { gradeLabel } from "@/lib/grading/labels";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "Profil" };

export default async function ProfilePage() {
  const viewer = await requireViewer();
  const { t } = await getI18n(viewer.profile.preferred_language);
  const p = viewer.profile;
  const links = [
    { href: "/projects", label: t.nav.projects },
    { href: "/settings", label: t.profile.edit },
    { href: "/settings/connections", label: t.nav.connections },
    ...(viewer.role === "admin" ? [{ href: "/settings/admin", label: t.profile.admin }] : []),
  ];
  return (
    <div className="space-y-5">
      <PageHeader title={p.display_name || t.profile.title} subtitle={viewer.email} />
      <Card>
        <dl className="divide-y divide-line text-sm">
          <div className="flex justify-between py-2">
            <dt className="text-ink-2">{t.profile.target}</dt>
            <dd className="font-semibold">
              {gradeLabel(t, p.target_grade_system, p.target_grade)} · {t.grades.systems[p.target_grade_system]}
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-ink-2">{t.profile.discipline}</dt>
            <dd className="font-semibold">{t.profile.bouldering}</dd>
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
