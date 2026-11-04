import Link from 'next/link';
import type { CSSProperties } from 'react';
import { db } from '@/lib/db';
import { ago } from '@/lib/util';
import { addLink, passOffer, validateOffer } from '../actions';
import SubmitButton from '@/components/SubmitButton';
import Toolbar from '@/components/Toolbar';
import type { SourceRef } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

export default async function OffersPage({ searchParams }: { searchParams: { min?: string; err?: string; view?: string } }) {
  const view = searchParams.view === 'pending' ? 'pending' : 'scored';
  const min = Math.max(0, Math.min(100, Number(searchParams.min) || 0));
  const q = await db();
  const offers = view === 'pending'
    ? await q`select * from offers where status = 'new' order by coalesce(published_at, first_seen_at) desc limit 100`
    : await q`select * from offers where status = 'scored' and score >= ${min}
              order by score desc, coalesce(published_at, first_seen_at) desc limit 60`;
  const [{ pending }] = await q`select count(*)::int as pending from offers where status = 'new'`;
  const [{ total }] = await q`select count(*)::int as total from offers where status = 'scored'`;

  return (
    <>
      <Toolbar pending={pending} />
      {searchParams.err && <p className="err" role="alert">{searchParams.err}</p>}

      <form action={addLink} className="addlink">
        <label htmlFor="url">Offre trouvée ailleurs (Walt, JobTeaser, Indeed, WTTJ…)</label>
        <div className="row">
          <input id="url" name="url" type="url" placeholder="Colle le lien de l'offre" required />
          <SubmitButton ghost>Ajouter</SubmitButton>
        </div>
      </form>

      <div className="filters" aria-label="Vue">
        <Link href="/" className={view === 'scored' ? 'chip on' : 'chip'}>Scorées ({total})</Link>
        <Link href="/?view=pending" className={view === 'pending' ? 'chip on' : 'chip'}>Non scorées ({pending})</Link>
      </div>

      {view === 'scored' && (
        <div className="filters" aria-label="Score minimum">
          <span className="muted">Score minimum</span>
          {[0, 40, 60, 75].map((m) => (
            <Link key={m} href={m ? `/?min=${m}` : '/'} className={m === min ? 'chip on' : 'chip'}>{m}%</Link>
          ))}
          <span className="muted">{offers.length} affichées sur {total}</span>
        </div>
      )}

      {offers.length === 0 && (
        <p className="empty">
          {view === 'pending' ? 'Aucune offre en attente de score.' : 'Rien à trier pour le moment. Lance « Récupérer les offres » ou ajoute un lien.'}
        </p>
      )}

      {offers.map((o) => {
        const sources = (o.sources as SourceRef[]).map((s) => s.name).join(', ');
        const scored = o.status === 'scored';
        return (
          <article className={scored ? 'card' : 'card flat'} key={o.id}>
            {scored && <div className="rail" style={{ '--s': o.score } as CSSProperties} aria-hidden />}
            <div className="body">
              <header>
                <h2>{o.title}</h2>
                {scored ? <span className="score" aria-label={`Score ${o.score} pour cent`}>{o.score}%</span> : <span className="tag">Pas encore scorée</span>}
              </header>
              <p className="who">{o.company || 'Entreprise non indiquée'}{o.city ? `, ${o.city}` : ''}</p>
              <p className="muted small">
                Publiée {ago(o.published_at)}, détectée {ago(o.first_seen_at)}. Source : {sources}.
              </p>
              <p className="tags">
                <span className={o.contact_email ? 'tag ok' : 'tag'}>{o.contact_email ? 'Mail direct' : 'Via le site'}</span>
                {o.lm_required && <span className="tag">Lettre demandée</span>}
                {o.analysis?.company_size && o.analysis.company_size !== 'inconnue' && <span className="tag">{o.analysis.company_size}</span>}
                {o.analysis?.foreign_subsidiaries && <span className="tag ok">Filiales à l'étranger</span>}
              </p>
              <p className="sum">{scored ? o.summary : `${String(o.description).replace(/\s+/g, ' ').slice(0, 320)}${o.description.length > 320 ? '…' : ''}`}</p>
              <div className="actions">
                {o.url && <a className="btn ghost" href={o.url} target="_blank" rel="noopener noreferrer">Voir l'offre</a>}
                <form action={passOffer}><input type="hidden" name="id" value={o.id} /><SubmitButton ghost>Passer</SubmitButton></form>
                <form action={validateOffer}><input type="hidden" name="id" value={o.id} /><SubmitButton>Valider</SubmitButton></form>
              </div>
            </div>
          </article>
        );
      })}
    </>
  );
}
