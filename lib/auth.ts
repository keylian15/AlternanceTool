import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { checkToken } from './token';

export async function isAuthed(): Promise<boolean> {
  return checkToken(cookies().get('session')?.value);
}

export async function guard(): Promise<void> {
  if (!(await isAuthed())) redirect('/login');
}

export function isCron(req: Request): boolean {
  const s = process.env.CRON_SECRET;
  return !!s && req.headers.get('authorization') === `Bearer ${s}`;
}
