import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { db } from '@/lib/db';
import { letterToPdf } from '@/lib/pdf';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await isAuthed())) return new NextResponse('Unauthorized', { status: 401 });
  const id = Number(new URL(req.url).searchParams.get('offer'));
  const q = await db();
  const [a] = await q`select lm_text from applications where offer_id = ${id}`;
  if (!a?.lm_text) return new NextResponse('Aucune lettre enregistrée pour cette offre', { status: 404 });
  const pdf = await letterToPdf(a.lm_text);
  return new NextResponse(new Uint8Array(pdf), {
    headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="Lettre de motivation.pdf"' },
  });
}
