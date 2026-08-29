import { redirect } from '@/i18n/routing';

export default function AdminRootRedirect({ params }: { params: { locale: string } }) {
  redirect({ href: '/admin/overview', locale: params.locale });
  return null;
}
