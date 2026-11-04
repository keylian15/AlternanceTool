import Link from 'next/link';
import { guard } from '@/lib/auth';
import { logout } from '../actions';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await guard();
  return (
    <div className="shell">
      <nav className="nav" aria-label="Navigation principale">
        <strong className="brand">Alternance</strong>
        <Link href="/">Offres</Link>
        <Link href="/suivi">Suivi</Link>
        <Link href="/reglages">Réglages</Link>
        <form action={logout}><button className="linklike">Quitter</button></form>
      </nav>
      <main className="content">{children}</main>
    </div>
  );
}
