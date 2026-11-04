import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { scoreBatch } from '@/lib/pipeline';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST() {
  if (!(await isAuthed())) return new NextResponse('Unauthorized', { status: 401 });
  return NextResponse.json(await scoreBatch(10));
}
