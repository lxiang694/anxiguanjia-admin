import { redirect } from 'next/navigation';

import { getCurrentUser, landingPathForRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** 根路径按角色分流到对应的端。 */
export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  redirect(landingPathForRole(user.role));
}
