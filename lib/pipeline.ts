import { db, logEvent } from './db';
import { EXCLUDE_TITLE, SOURCE_PRIORITY } from './config';
import { fetchLba, type RawOffer } from './sources/lba';
import { analyzeMany, GeminiError, type Analysis } from './gemini';
import { computeScore } from './score';
import { dedupeKey, findEmail, htmlToText } from './util';

export type SourceRef = { name: string; url: string; id: string };

const rank = (name: string) => {
  const i = SOURCE_PRIORITY.findIndex((p) => name.toLowerCase().includes(p));
  return i === -1 ? 99 : i;
};
const bestUrl = (s: SourceRef[]) => [...s].sort((a, b) => rank(a.name) - rank(b.name))[0]?.url ?? null;

/** Récupère les offres (7 jours au 1er lancement, puis depuis le dernier run réussi), dédoublonne et stocke. */
export async function runFetch(days?: number) {
  const q = await db();
  const [run] = await q`insert into runs(kind) values ('fetch') returning id`;
  try {
    const [last] = await q`select started_at from runs where kind = 'fetch' and ok = true order by started_at desc limit 1`;
    // days: undefined = depuis le dernier run (7 j au 1er), 0 = aucune limite de date, n = n derniers jours
    const since = days === 0 ? new Date(0)
      : days ? new Date(Date.now() - days * 864e5)
      : last ? new Date(last.started_at) : new Date(Date.now() - 7 * 864e5);

    const { offers: raw, perZone, received } = await fetchLba();
    const fresh = raw.filter((o) => !o.publishedAt || new Date(o.publishedAt) >= since);

    const merged = new Map<string, RawOffer & { sources: SourceRef[] }>();
    for (const o of fresh) {
      const key = dedupeKey(o.company, o.title, o.city);
      const ref = { name: o.source, url: o.url, id: o.sourceId };
      const cur = merged.get(key);
      if (!cur) merged.set(key, { ...o, sources: [ref] });
      else if (!cur.sources.some((s) => s.name === ref.name && s.id === ref.id)) cur.sources.push(ref);
    }

    const keys = [...merged.keys()];
    const existing = keys.length ? await q`select id, dedupe_key, sources from offers where dedupe_key in ${q(keys)}` : [];
    const byKey = new Map(existing.map((e) => [e.dedupe_key as string, e]));

    let inserted = 0, excluded = 0;
    for (const [key, o] of merged) {
      const ex = byKey.get(key);
      if (ex) {
        const cur = ex.sources as SourceRef[];
        const add = o.sources.filter((s) => !cur.some((c) => c.name === s.name && c.id === s.id));
        if (add.length) {
          const all = [...cur, ...add];
          await q`update offers set sources = ${q.json(all)}, url = ${bestUrl(all)} where id = ${ex.id}`;
        }
        continue;
      }
      const status = EXCLUDE_TITLE.test(o.title) ? 'filtered' : 'new';
      if (status === 'filtered') excluded++;
      const email = o.email ?? findEmail(o.description);
      await q`insert into offers (dedupe_key, title, company, city, url, description, published_at, expires_at, sources, contact_email, status)
              values (${key}, ${o.title}, ${o.company}, ${o.city}, ${bestUrl(o.sources)}, ${o.description}, ${o.publishedAt}, ${o.expiresAt},
                      ${q.json(o.sources)}, ${email}, ${status})
              on conflict (dedupe_key) do nothing`;
      inserted++;
    }

    await q`update offers set status = 'expired' where status in ('new', 'scored') and expires_at is not null and expires_at < now()`;
    const zones = Object.entries(perZone).map(([n, c]) => `${n} ${c.kept}/${c.received}`).join(', ');
    const message = `${received} reçues, ${raw.length} informatiques (gardées/reçues par zone : ${zones}), ${fresh.length} dans la fenêtre (${days === 0 ? 'sans limite de date' : 'depuis le ' + since.toLocaleDateString('fr-FR')}), ${merged.size} uniques, ${existing.length} déjà connues, ${inserted} nouvelles dont ${excluded} écartées d'office`;
    await q`update runs set finished_at = now(), ok = true, fetched = ${raw.length}, inserted = ${inserted}, message = ${message} where id = ${run.id}`;
    return { ok: true, fetched: raw.length, inserted };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await q`update runs set finished_at = now(), ok = false, message = ${message} where id = ${run.id}`;
    return { ok: false, error: message };
  }
}

async function applyAnalysis(id: number, a: Analysis) {
  const q = await db();
  const score = computeScore(a);
  const status = a.network_focus ? 'filtered' : 'scored';
  await q`update offers set score = ${score}, summary = ${a.summary ?? ''}, analysis = ${q.json(a as never)},
          contact_email = coalesce(contact_email, ${a.contact_email ?? null}), lm_required = ${a.lm_required ?? null},
          status = ${status}, scored_at = now() where id = ${id}`;
}

/** Score un lot d'offres 'new'. Retourne le nombre restant. */
export async function scoreBatch(limit = 10) {
  const q = await db();
  const rows = await q`select id, title, company, city, description from offers where status = 'new'
                       order by score_attempts asc, coalesce(published_at, first_seen_at) desc limit ${limit}`;
  let scored = 0, rateLimited = false, error: string | null = null;
  if (rows.length) {
    try {
      const res = await analyzeMany(rows.map((r) => ({ id: r.id, title: r.title, company: r.company, city: r.city, description: r.description })));
      const done = new Set<number>();
      for (const a of res) {
        if (!rows.some((r) => r.id === a.id)) continue;
        await applyAnalysis(a.id, a);
        done.add(a.id);
        scored++;
      }
      for (const r of rows) {
        if (done.has(r.id)) continue;
        await q`update offers set score_attempts = score_attempts + 1,
                status = case when score_attempts + 1 >= 3 then 'filtered' else status end,
                summary = case when score_attempts + 1 >= 3 then 'Analyse impossible' else summary end where id = ${r.id}`;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      rateLimited = e instanceof GeminiError && (e.status === 429 || e.status === 503);
    }
  }
  const [{ n }] = await q`select count(*)::int as n from offers where status = 'new'`;
  return { scored, remaining: n as number, rateLimited, error };
}

/** Ajoute une offre depuis un lien (Walt, JobTeaser, Indeed, WTTJ…) : texte de la page analysé par Gemini. */
export async function addByLink(url: string): Promise<number> {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error('Lien invalide');
  const res = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; AlternanceTool/1.0)' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Page inaccessible (HTTP ${res.status}). Colle le texte de l'offre à la place.`);
  const text = htmlToText(await res.text()).slice(0, 12000);
  if (text.length < 200) throw new Error("Page vide ou protégée (connexion requise). Ouvre l'offre et réessaie avec un autre lien.");

  const [a] = await analyzeMany([{ id: 0, title: '', company: '', city: '', description: text }], true);
  if (!a) throw new Error("Analyse impossible pour cette page");
  const title = a.title || u.hostname, company = a.company || '', city = a.city || '';
  const key = dedupeKey(company, title, city);
  const q = await db();
  const [ex] = await q`select id from offers where dedupe_key = ${key}`;
  if (ex) return ex.id as number;
  const name = u.hostname.replace(/^www\./, '');
  const [row] = await q`insert into offers (dedupe_key, title, company, city, url, description, sources, contact_email, status)
    values (${key}, ${title}, ${company}, ${city}, ${url}, ${text}, ${q.json([{ name: `Manuel (${name})`, url, id: url }])}, ${findEmail(text)}, 'new')
    returning id`;
  await applyAnalysis(row.id, a);
  await logEvent(row.id, 'added_by_link', url);
  return row.id as number;
}
