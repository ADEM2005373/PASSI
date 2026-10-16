export const dynamic = 'force-dynamic';
export const revalidate = 0;

import AdminDashboard from '../[[...tab]]/page';

export default function PointsDePaiementPage() {
  return <AdminDashboard initialTab="payment-points" />;
}
