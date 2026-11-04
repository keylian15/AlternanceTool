import { NextResponse } from 'next/server';
import { isAuthed, isCron } from '@/lib/auth';
import { runFetch, scoreBatch } from '@/lib/pipeline';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const cron = isCron(req);
  if (!cron && !(await isAuthed())) return new NextResponse('Unauthorized', { status: 401 });
  const raw = new URL(req.url).searchParams.get('days');
  const d = Number(raw);
  const days = raw === 'all' ? 0 : Number.isFinite(d) && d > 0 ? Math.min(90, Math.floor(d)) : undefined;
  const fetched = await runFetch(days);
  // le scoring automatique ne tourne que pour le cron quotidien ; en manuel, c'est le bouton « Scorer »
  const scoring = fetched.ok && cron ? await scoreBatch(10) : null;
  return NextResponse.json({ fetched, scoring });
}
