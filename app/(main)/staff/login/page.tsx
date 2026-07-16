// app/(main)/staff/login/page.tsx
//
// Login is unified at /admin/login now — this route just forwards there
// so any existing bookmarks or links to /staff/login keep working.
import { redirect } from 'next/navigation';

export default async function StaffLoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: redirectTo } = await searchParams;
  const target = redirectTo ? `/admin/login?redirect=${encodeURIComponent(redirectTo)}` : '/admin/login';
  redirect(target);
}