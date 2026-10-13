import { redirect } from 'next/navigation';

export default function DashboardNewsPage() {
  redirect('/dashboard?tab=news');
}
