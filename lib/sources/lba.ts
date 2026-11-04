import { IT_TITLE, ROMES, ZONES } from '../config';

export type RawOffer = {
  source: string;
  sourceId: string;
  title: string;
  company: string;
  city: string;
  url: string;
  description: string;
  publishedAt: string | null;
  expiresAt: string | null;
  email: string | null;
  romeCodes: string[];
};

const BASE = 'https://api.apprentissage.beta.gouv.fr/api/job/v1/search';
const FALLBACK_URL = 'https://labonnealternance.apprentissage.beta.gouv.fr/recherche-emploi';

/* eslint-disable @typescript-eslint/no-explicit-any */
function parse(j: any): RawOffer | null {
  const title = j?.offer?.title ?? j?.title;
  if (!title) return null;
  const id = String(j?.identifier?.id ?? j?.id ?? title);
  const partner = j?.identifier?.partner_label;
  return {
    source: partner && !/bonne alternance|offres_emploi_lba/i.test(partner) ? String(partner) : 'La Bonne Alternance',
    sourceId: id,
    title: String(title),
    company: String(j?.workplace?.name ?? j?.workplace?.legal_name ?? j?.company?.name ?? ''),
    city: String(j?.workplace?.location?.address ?? j?.place?.city ?? '').replace(/\d{5}\s*/g, '').trim(),
    url: String(j?.apply?.url ?? FALLBACK_URL),
    description: String(j?.offer?.description ?? j?.description ?? ''),
    publishedAt: j?.offer?.publication?.creation ?? null,
    expiresAt: j?.offer?.publication?.expiration ?? null,
    email: j?.apply?.email ?? null,
    romeCodes: Array.isArray(j?.offer?.rome_codes) ? j.offer.rome_codes.map(String) : [],
  };
}

/** Une offre est gardée si son code métier est dans ROMES, ou si son intitulé est clairement informatique. */
export const isRelevant = (o: RawOffer) => o.romeCodes.some((r) => ROMES.includes(r)) || IT_TITLE.test(o.title);

/**
 * Interroge l'API La Bonne Alternance pour chaque zone (agrège aussi France Travail, Hellowork, etc.).
 * Le filtre « romes » de l'API renvoyait 0 résultat : on récupère tout autour de la zone et on filtre ici.
 */
export async function fetchLba() {
  const token = process.env.LBA_API_TOKEN;
  if (!token) throw new Error('LBA_API_TOKEN manquant');
  const results = await Promise.all(
    ZONES.map(async (z) => {
      const qs = new URLSearchParams({ latitude: String(z.lat), longitude: String(z.lon), radius: String(z.radius) });
      const res = await fetch(`${BASE}?${qs}`, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`LBA ${z.name}: HTTP ${res.status} ${(await res.text()).slice(0, 150)}`);
      const data = await res.json();
      const all = ((data?.jobs ?? []) as any[]).map(parse).filter((o): o is RawOffer => !!o);
      return { all: all.length, kept: all.filter(isRelevant) };
    }),
  );
  const perZone: Record<string, { received: number; kept: number }> = {};
  ZONES.forEach((z, i) => { perZone[z.name] = { received: results[i].all, kept: results[i].kept.length }; });
  return {
    offers: results.flatMap((r) => r.kept),
    perZone,
    received: results.reduce((n, r) => n + r.all, 0),
  };
}
