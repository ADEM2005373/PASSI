import { redirect } from 'next/navigation';

export default function ReservationsPage() {
  redirect('/dashboard?tab=reservations');
}
