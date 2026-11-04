import { NextResponse } from 'next/server';
import { isAuthed, isCron } from '@/lib/auth';
import { runSend } from '@/lib/send';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!isCron(req) && !(await isAuthed())) return new NextResponse('Unauthorized', { status: 401 });
  return NextResponse.json(await runSend());
}
