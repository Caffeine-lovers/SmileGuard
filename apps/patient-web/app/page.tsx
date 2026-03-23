import { redirect } from 'next/navigation';

export default function RootPage() {
  // Redirect to login or dashboard based on auth status
  redirect('/login');
}
