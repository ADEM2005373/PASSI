export const dynamic = 'force-dynamic';
export const revalidate = 0;

import AdminDashboard from '../[[...tab]]/page';

export default function ApprobationsPage() {
  return <AdminDashboard initialTab="approbations" />;
}
