import { db } from '@/lib/db';
import { getTemplates } from '@/lib/templates';
import { fmt } from '@/lib/util';
import { saveTemplates, uploadCv } from '../../actions';
import SubmitButton from '@/components/SubmitButton';

export const dynamic = 'force-dynamic';

const ENV = [
  ['APP_PASSWORD', 'Mot de passe de l\'app'], ['SESSION_SECRET', 'Secret de session'], ['CRON_SECRET', 'Secret des tâches planifiées'],
  ['DATABASE_URL', 'Base Postgres'], ['LBA_API_TOKEN', 'Token La Bonne Alternance'], ['GEMINI_API_KEY', 'Clé Gemini'],
  ['GMAIL_USER', 'Adresse Gmail'], ['GMAIL_APP_PASSWORD', 'Mot de passe d\'application Gmail'], ['APPLICANT_NAME', 'Ton nom (lettres et mails)'],
] as const;

export default async function SettingsPage({ searchParams }: { searchParams: { err?: string } }) {
  const q = await db();
  const [cv] = await q`select filename, length(data) as size, updated_at from files where name = 'cv'`;
  const runs = await q`select * from runs order by started_at desc limit 8`;
  const t = await getTemplates();

  return (
    <>
      <h1>Réglages</h1>
      {searchParams.err && <p className="err" role="alert">{searchParams.err}</p>}

      <section className="panel stack">
        <h2>CV</h2>
        <p className="muted">
          {cv ? <>Actuel : {cv.filename} ({Math.round(cv.size / 1024)} Ko), mis à jour le {fmt(cv.updated_at)}. <a href="/api/cv">Télécharger</a></> : 'Aucun CV enregistré.'}
        </p>
        <form action={uploadCv} className="row wrap">
          <input type="file" name="cv" accept="application/pdf" required aria-label="Fichier PDF du CV" />
          <SubmitButton>Enregistrer le CV</SubmitButton>
        </form>
      </section>

      <form action={saveTemplates} className="panel stack">
        <h2>Modèles</h2>
        <p className="muted small">Champs disponibles : {'{{poste}} {{entreprise}} {{ville}} {{nom}} {{phrase_international}}'}</p>
        <label htmlFor="mail_subject">Objet du mail</label>
        <input id="mail_subject" name="mail_subject" defaultValue={t.subject} />
        <label htmlFor="mail_body">Corps du mail</label>
        <textarea id="mail_body" name="mail_body" rows={7} defaultValue={t.body} />
        <label htmlFor="lm_template">Lettre de motivation</label>
        <textarea id="lm_template" name="lm_template" rows={18} defaultValue={t.lm} />
        <div className="actions"><SubmitButton>Enregistrer les modèles</SubmitButton></div>
      </form>

      <section className="panel stack">
        <h2>Configuration</h2>
        <ul className="checks">
          {ENV.map(([k, label]) => (
            <li key={k} className={process.env[k] ? 'ok' : 'ko'}>{process.env[k] ? 'Configuré' : 'Manquant'}: {label} ({k})</li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <h2>Dernières récupérations</h2>
        {runs.length === 0 && <p className="muted">Aucune récupération pour l'instant.</p>}
        <ul className="checks">
          {runs.map((r) => (
            <li key={r.id} className={r.ok === false ? 'ko' : r.ok ? 'ok' : ''}>
              {fmt(r.started_at)}: {r.kind === 'fetch' ? 'récupération' : r.kind}, {r.ok ? (r.message ?? `${r.inserted} nouvelles sur ${r.fetched}`) : r.ok === false ? r.message : 'en cours'}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
