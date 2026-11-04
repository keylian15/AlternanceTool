import { ROMES, ZONES } from '../config';

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
    source: partner && !/bonne alternance/i.test(partner) ? String(partner) : 'La Bonne Alternance',
    sourceId: id,
    title: String(title),
    company: String(j?.workplace?.name ?? j?.workplace?.legal_name ?? j?.company?.name ?? ''),
    city: String(j?.workplace?.location?.address ?? j?.place?.city ?? '').replace(/\d{5}\s*/g, '').trim(),
    url: String(j?.apply?.url ?? FALLBACK_URL),
    description: String(j?.offer?.description ?? j?.description ?? ''),
    publishedAt: j?.offer?.publication?.creation ?? null,
    expiresAt: j?.offer?.publication?.expiration ?? null,
    email: j?.apply?.email ?? null,
  };
}

/** Interroge l'API La Bonne Alternance pour chaque zone (agrège aussi France Travail, Hellowork, etc.). */
export async function fetchLba(): Promise<RawOffer[]> {
  const token = process.env.LBA_API_TOKEN;
  if (!token) throw new Error('LBA_API_TOKEN manquant');
  const results = await Promise.all(
    ZONES.map(async (z) => {
      const qs = new URLSearchParams({
        latitude: String(z.lat), longitude: String(z.lon), radius: String(z.radius), romes: ROMES.join(','),
      });
      const res = await fetch(`${BASE}?${qs}`, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`LBA ${z.name}: HTTP ${res.status} ${(await res.text()).slice(0, 150)}`);
      const data = await res.json();
      return ((data?.jobs ?? []) as any[]).map(parse).filter((o): o is RawOffer => !!o);
    }),
  );
  return results.flat();
}
