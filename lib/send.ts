import { db, logEvent } from './db';
import { sendMail } from './mail';
import { letterToPdf } from './pdf';
import { SEND_FOLLOWUP_DAYS } from './config';

/** Envoie les candidatures programmées dont l'heure est passée. */
export async function runSend() {
  const q = await db();
  const due = await q`select a.id, a.offer_id from applications a
                      where a.status = 'scheduled' and a.scheduled_send_at <= now() order by a.scheduled_send_at`;
  let sent = 0;
  const errors: string[] = [];
  for (const d of due) {
    // verrou atomique : évite un double envoi si deux exécutions se chevauchent
    const [app] = await q`update applications set status = 'sending', updated_at = now()
                          where id = ${d.id} and status = 'scheduled' returning *`;
    if (!app) continue;
    try {
      const [cv] = await q`select data, filename, mime from files where name = 'cv'`;
      if (!cv) throw new Error('CV manquant (Réglages)');
      if (!app.to_email) throw new Error('Adresse mail manquante');
      const attachments = [{ filename: cv.filename || 'CV.pdf', content: Buffer.from(cv.data), contentType: cv.mime }];
      if (app.lm_text?.trim()) {
        const pdf = await letterToPdf(app.lm_text);
        attachments.push({ filename: 'Lettre de motivation.pdf', content: Buffer.from(pdf), contentType: 'application/pdf' });
      }
      await sendMail({ to: app.to_email, subject: app.subject ?? 'Candidature alternance', text: app.body ?? '', attachments });
      await q`update applications set status = 'sent', sent_at = now(), error = null, updated_at = now(),
              follow_up_at = now() + ${SEND_FOLLOWUP_DAYS + ' days'}::interval where id = ${app.id}`;
      await logEvent(app.offer_id, 'sent', app.to_email);
      sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await q`update applications set status = 'scheduled', error = ${msg}, updated_at = now() where id = ${app.id}`;
      await logEvent(app.offer_id, 'send_error', msg);
      errors.push(msg);
    }
  }
  return { due: due.length, sent, errors };
}
