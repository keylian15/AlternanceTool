import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { ROMES, ZONES } from '@/lib/config';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/* Diagnostic : /api/debug/lba?zone=Lille (ajoute &noromes=1 pour tester sans filtre de métier) */
export async function GET(req: Request) {
  if (!(await isAuthed())) return new NextResponse('Unauthorized', { status: 401 });
  const token = process.env.LBA_API_TOKEN;
  if (!token) return NextResponse.json({ error: 'LBA_API_TOKEN manquant' });
  const sp = new URL(req.url).searchParams;
  const z = ZONES.find((x) => x.name.toLowerCase() === (sp.get('zone') ?? 'Lille').toLowerCase()) ?? ZONES[0];
  const qs = new URLSearchParams({ latitude: String(z.lat), longitude: String(z.lon), radius: String(z.radius) });
  if (!sp.get('noromes')) qs.set('romes', ROMES.join(','));
  const url = `https://api.apprentissage.beta.gouv.fr/api/job/v1/search?${qs}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  const text = await res.text();
  let data: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  try { data = JSON.parse(text); } catch { /* réponse non JSON */ }
  const jobs: any[] = data?.jobs ?? []; // eslint-disable-line @typescript-eslint/no-explicit-any
  return NextResponse.json({
    url, status: res.status, topLevelKeys: data ? Object.keys(data) : null,
    jobs: jobs.length, recruiters: data?.recruiters?.length ?? null, warnings: data?.warnings ?? null,
    sample: jobs.slice(0, 3).map((j) => ({
      title: j?.offer?.title, company: j?.workplace?.name, partner: j?.identifier?.partner_label,
      created: j?.offer?.publication?.creation, expires: j?.offer?.publication?.expiration, romes: j?.offer?.rome_codes,
    })),
    raw: data ? undefined : text.slice(0, 500),
  });
}
