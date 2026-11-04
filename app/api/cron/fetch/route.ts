import { NextResponse } from 'next/server';
import { isAuthed, isCron } from '@/lib/auth';
import { runFetch, scoreBatch } from '@/lib/pipeline';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!isCron(req) && !(await isAuthed())) return new NextResponse('Unauthorized', { status: 401 });
  const fetched = await runFetch();
  const scoring = fetched.ok ? await scoreBatch(10) : null;
  return NextResponse.json({ fetched, scoring });
}
