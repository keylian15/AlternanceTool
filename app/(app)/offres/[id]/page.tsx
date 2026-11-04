import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getTemplates, render } from '@/lib/templates';
import { nextSendSlot } from '@/lib/schedule';
import { fmt, fmtDay } from '@/lib/util';
import { cancelApplication, markSentManual, saveDraft, scheduleSend } from '../../../actions';
import SubmitButton from '@/components/SubmitButton';
import type { SourceRef } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

export default async function PreparePage({ params, searchParams }: { params: { id: string }; searchParams: { err?: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();
  const q = await db();
  const [o] = await q`select * from offers where id = ${id}`;
  if (!o) notFound();
  const [a] = await q`select * from applications where offer_id = ${id}`;
  const t = await getTemplates();
  const vars = { poste: o.title, entreprise: o.company, ville: o.city, international: o.analysis?.foreign_subsidiaries === true };

  const locked = a && ['scheduled', 'sending', 'sent', 'replied', 'interview', 'rejected'].includes(a.status);
  const email: string = a?.to_email ?? o.contact_email ?? '';
  const subject: string = a?.subject || render(t.subject, vars);
  const body: string = a?.body || render(t.body, vars);
  const lm: string = a?.lm_text || render(t.lm, vars);
  const slot = nextSendSlot();
  const sources = (o.sources as SourceRef[]).map((s) => s.name).join(', ');

  return (
    <>
      <p><Link href="/">Retour aux offres</Link></p>
      <h1>{o.title}</h1>
      <p className="who">{o.company}{o.city ? `, ${o.city}` : ''}</p>
      <p className="muted small">Score {o.score ?? '—'}%. Source : {sources}.</p>
      <p className="sum">{o.summary}</p>
      {o.url && <p><a className="btn ghost" href={o.url} target="_blank" rel="noopener noreferrer">Ouvrir l'offre</a></p>}
      {searchParams.err && <p className="err" role="alert">{searchParams.err}</p>}

      {locked ? (
        <section className="panel">
          <h2>Candidature {a.status === 'scheduled' ? 'programmée' : a.status === 'sent' ? 'envoyée' : 'en cours'}</h2>
          {a.status === 'scheduled' && <p>Envoi prévu le {fmt(a.scheduled_send_at)} à {a.to_email}.</p>}
          {a.sent_at && <p>Envoyée le {fmt(a.sent_at)} ({a.method === 'link' ? 'via le site' : 'par mail'}).</p>}
          {a.error && <p className="err">Dernière erreur : {a.error}</p>}
          {a.status === 'scheduled' && (
            <form action={cancelApplication}>
              <input type="hidden" name="offer_id" value={id} />
              <SubmitButton ghost>Annuler l'envoi et modifier</SubmitButton>
            </form>
          )}
          <p><Link href="/suivi">Voir le suivi</Link></p>
        </section>
      ) : (
        <form className="panel stack" action={saveDraft}>
          <input type="hidden" name="offer_id" value={id} />
          <h2>Dernière vérification avant envoi</h2>
          {o.lm_required && <p className="tag">Cette offre demande une lettre de motivation</p>}

          <label htmlFor="to_email">Adresse de candidature</label>
          <input id="to_email" name="to_email" type="email" defaultValue={email} placeholder="Aucune adresse trouvée : candidature via le site" />

          <label htmlFor="subject">Objet du mail</label>
          <input id="subject" name="subject" defaultValue={subject} />

          <label htmlFor="body">Corps du mail</label>
          <textarea id="body" name="body" rows={7} defaultValue={body} />

          <label htmlFor="lm_text">Lettre de motivation (vide = pas de lettre jointe)</label>
          <textarea id="lm_text" name="lm_text" rows={16} defaultValue={lm} />

          <div className="actions">
            <SubmitButton ghost>Enregistrer le brouillon</SubmitButton>
            <SubmitButton formAction={scheduleSend}>Programmer l'envoi, {fmtDay(slot)} à 8h</SubmitButton>
          </div>

          <hr />
          <h3>Candidature via le site de l'offre</h3>
          <p className="muted small">
            Enregistre le brouillon, télécharge le CV et la lettre, postule sur le site, puis marque la candidature comme envoyée.
          </p>
          <div className="actions">
            <a className="btn ghost" href="/api/cv">Télécharger le CV</a>
            {a?.lm_text && <a className="btn ghost" href={`/api/lm?offer=${id}`}>Télécharger la lettre (PDF)</a>}
            <SubmitButton ghost formAction={markSentManual}>Marquer comme envoyée</SubmitButton>
          </div>
        </form>
      )}
    </>
  );
}
