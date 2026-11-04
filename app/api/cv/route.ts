import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAuthed())) return new NextResponse('Unauthorized', { status: 401 });
  const q = await db();
  const [cv] = await q`select data, filename, mime from files where name = 'cv'`;
  if (!cv) return new NextResponse('Aucun CV', { status: 404 });
  return new NextResponse(new Uint8Array(cv.data), {
    headers: { 'content-type': cv.mime, 'content-disposition': `attachment; filename="${cv.filename || 'CV.pdf'}"` },
  });
}
