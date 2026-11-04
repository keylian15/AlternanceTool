'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { guard } from '@/lib/auth';
import { makeToken } from '@/lib/token';
import { db, logEvent, setSetting } from '@/lib/db';
import { addByLink } from '@/lib/pipeline';
import { nextSendSlot } from '@/lib/schedule';
import { SEND_FOLLOWUP_DAYS } from '@/lib/config';

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const back = (path: string, err: string): never => redirect(`${path}?err=${encodeURIComponent(err)}`);

export async function login(fd: FormData) {
  await new Promise((r) => setTimeout(r, 400));
  const pass = process.env.APP_PASSWORD;
  if (!pass || s(fd, 'password') !== pass) back('/login', 'Mot de passe incorrect');
  cookies().set('session', await makeToken(), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 30 * 86400,
  });
  redirect('/');
}

export async function logout() {
  cookies().delete('session');
  redirect('/login');
}

export async function passOffer(fd: FormData) {
  await guard();
  const id = Number(s(fd, 'id'));
  const q = await db();
  await q`update offers set status = 'passed' where id = ${id}`;
  await logEvent(id, 'passed');
  revalidatePath('/');
}

export async function validateOffer(fd: FormData) {
  await guard();
  const id = Number(s(fd, 'id'));
  const q = await db();
  await q`update offers set status = 'validated' where id = ${id}`;
  await q`insert into applications(offer_id) values (${id}) on conflict (offer_id) do nothing`;
  await logEvent(id, 'validated');
  redirect(`/offres/${id}`);
}

export async function addLink(fd: FormData) {
  await guard();
  let id: number | null = null;
  let err = '';
  try {
    id = await addByLink(s(fd, 'url'));
  } catch (e) {
    err = e instanceof Error ? e.message : 'Ajout impossible';
  }
  if (err) back('/', err);
  revalidatePath('/');
  redirect('/');
}

async function saveFields(fd: FormData) {
  const id = Number(s(fd, 'offer_id'));
  const q = await db();
  await q`insert into applications(offer_id) values (${id}) on conflict (offer_id) do nothing`;
  await q`update applications set to_email = ${s(fd, 'to_email') || null}, subject = ${s(fd, 'subject')},
          body = ${String(fd.get('body') ?? '')}, lm_text = ${String(fd.get('lm_text') ?? '')}, updated_at = now()
          where offer_id = ${id}`;
  return { id, q };
}

export async function saveDraft(fd: FormData) {
  await guard();
  const { id } = await saveFields(fd);
  redirect(`/offres/${id}`);
}

export async function scheduleSend(fd: FormData) {
  await guard();
  const { id, q } = await saveFields(fd);
  const email = s(fd, 'to_email');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) back(`/offres/${id}`, 'Adresse mail invalide');
  const [cv] = await q`select 1 as ok from files where name = 'cv'`;
  if (!cv) back(`/offres/${id}`, 'Ajoute ton CV dans Réglages avant de programmer un envoi');
  const slot = nextSendSlot();
  await q`update applications set status = 'scheduled', method = 'mail', scheduled_send_at = ${slot}, error = null,
          validated_at = now(), updated_at = now() where offer_id = ${id}`;
  await logEvent(id, 'scheduled', slot.toISOString());
  redirect('/suivi');
}

export async function markSentManual(fd: FormData) {
  await guard();
  const { id, q } = await saveFields(fd);
  await q`update applications set status = 'sent', method = 'link', sent_at = now(), updated_at = now(),
          follow_up_at = now() + ${SEND_FOLLOWUP_DAYS + ' days'}::interval where offer_id = ${id}`;
  await logEvent(id, 'sent_manual');
  redirect('/suivi');
}

export async function cancelApplication(fd: FormData) {
  await guard();
  const id = Number(s(fd, 'offer_id'));
  const q = await db();
  await q`update applications set status = 'draft', scheduled_send_at = null, updated_at = now()
          where offer_id = ${id} and status = 'scheduled'`;
  await logEvent(id, 'cancelled');
  redirect(`/offres/${id}`);
}

const STATUSES = ['draft', 'scheduled', 'sent', 'replied', 'interview', 'rejected', 'cancelled'];

export async function updateTracking(fd: FormData) {
  await guard();
  const offerId = Number(s(fd, 'offer_id'));
  const status = s(fd, 'status');
  if (!STATUSES.includes(status)) return;
  const q = await db();
  await q`update applications set status = ${status}, notes = ${s(fd, 'notes')}, updated_at = now(),
          follow_up_at = case when ${status} = 'sent' then coalesce(follow_up_at, now() + ${SEND_FOLLOWUP_DAYS + ' days'}::interval)
                              else null end where offer_id = ${offerId}`;
  await logEvent(offerId, 'status', status);
  revalidatePath('/suivi');
}

export async function uploadCv(fd: FormData) {
  await guard();
  const f = fd.get('cv');
  if (!(f instanceof File) || f.size === 0) back('/reglages', 'Aucun fichier choisi');
  const file = f as File;
  if (file.size > 3.5 * 1024 * 1024) back('/reglages', 'Fichier trop lourd (3,5 Mo max)');
  if (file.type !== 'application/pdf') back('/reglages', 'Le CV doit être un PDF');
  const q = await db();
  const data = Buffer.from(await file.arrayBuffer());
  await q`insert into files(name, mime, filename, data) values ('cv', ${file.type}, ${file.name}, ${data})
          on conflict (name) do update set mime = excluded.mime, filename = excluded.filename, data = excluded.data, updated_at = now()`;
  redirect('/reglages');
}

export async function saveTemplates(fd: FormData) {
  await guard();
  await setSetting('lm_template', String(fd.get('lm_template') ?? ''));
  await setSetting('mail_subject', s(fd, 'mail_subject'));
  await setSetting('mail_body', String(fd.get('mail_body') ?? ''));
  redirect('/reglages');
}
