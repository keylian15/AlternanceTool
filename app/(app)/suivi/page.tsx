import Link from 'next/link';
import { db } from '@/lib/db';
import { ago, fmt } from '@/lib/util';
import { updateTracking } from '../../actions';
import SubmitButton from '@/components/SubmitButton';
import type { SourceRef } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

const LABELS: Record<string, string> = {
  draft: 'À finaliser', scheduled: 'Programmée', sending: 'Envoi en cours', sent: 'Envoyée',
  replied: 'Réponse reçue', interview: 'Entretien', rejected: 'Refus', cancelled: 'Abandonnée',
};

export default async function TrackingPage() {
  const q = await db();
  const rows = await q`select a.*, o.title, o.company, o.city, o.url, o.sources, o.published_at, o.first_seen_at
                       from applications a join offers o on o.id = a.offer_id order by a.updated_at desc`;
  const passed = await q`select id, title, company, city, sources, first_seen_at, published_at from offers
                         where status = 'passed' order by first_seen_at desc limit 100`;
  const [c] = await q`select count(*) filter (where status = 'scored')::int as todo,
                             count(*) filter (where status = 'passed')::int as passed,
                             count(*) filter (where status = 'filtered')::int as filtered,
                             count(*)::int as total from offers`;
  const due = rows.filter((r) => r.status === 'sent' && r.follow_up_at && new Date(r.follow_up_at) <= new Date()).length;

  return (
    <>
      <h1>Suivi</h1>
      <p className="muted">
        {c.total} offres détectées, {c.todo} à trier, {rows.length} candidatures, {c.passed} passées, {c.filtered} écartées automatiquement.
        {due > 0 && <strong> {due} relance(s) à faire.</strong>}
      </p>

      {rows.length === 0 && <p className="empty">Aucune candidature pour l'instant. Valide une offre pour la préparer.</p>}

      {rows.map((r) => {
        const sources = (r.sources as SourceRef[]).map((s) => s.name).join(', ');
        const relance = r.status === 'sent' && r.follow_up_at && new Date(r.follow_up_at) <= new Date();
        return (
          <article className="card flat" key={r.id}>
            <div className="body">
              <header>
                <h2>{r.company || 'Entreprise'}: {r.title}</h2>
                <span className={relance ? 'tag warn' : 'tag'}>{relance ? 'Relance due' : LABELS[r.status] ?? r.status}</span>
              </header>
              <dl className="facts">
                <div><dt>Ville</dt><dd>{r.city || '—'}</dd></div>
                <div><dt>Source</dt><dd>{sources}</dd></div>
                <div><dt>Offre publiée</dt><dd>{ago(r.published_at)}</dd></div>
                <div><dt>Offre détectée</dt><dd>{fmt(r.first_seen_at)}</dd></div>
                <div><dt>Validée</dt><dd>{fmt(r.validated_at)}</dd></div>
                <div><dt>{r.status === 'scheduled' ? 'Envoi prévu' : 'Envoyée'}</dt><dd>{fmt(r.scheduled_send_at && r.status === 'scheduled' ? r.scheduled_send_at : r.sent_at)}</dd></div>
                <div><dt>Méthode</dt><dd>{r.method === 'link' ? 'Via le site' : r.to_email ?? 'Mail'}</dd></div>
                {r.follow_up_at && r.status === 'sent' && <div><dt>Relance le</dt><dd>{fmt(r.follow_up_at)}</dd></div>}
              </dl>
              {r.error && <p className="err">Erreur d'envoi : {r.error}</p>}
              <form action={updateTracking} className="row wrap">
                <input type="hidden" name="offer_id" value={r.offer_id} />
                <select name="status" defaultValue={r.status} aria-label="Statut">
                  {Object.entries(LABELS).filter(([k]) => k !== 'sending').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input name="notes" defaultValue={r.notes ?? ''} placeholder="Notes (contact, réponse…)" aria-label="Notes" />
                <SubmitButton ghost>Mettre à jour</SubmitButton>
                <Link className="btn ghost" href={`/offres/${r.offer_id}`}>Ouvrir</Link>
              </form>
            </div>
          </article>
        );
      })}

      <details className="passed">
        <summary>Offres passées ({passed.length})</summary>
        <ul>
          {passed.map((p) => (
            <li key={p.id}>
              {p.company || 'Entreprise'}: {p.title} ({p.city || '—'}), détectée {ago(p.first_seen_at)},{' '}
              {(p.sources as SourceRef[]).map((s) => s.name).join(', ')}
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
