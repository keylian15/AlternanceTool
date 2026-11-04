import nodemailer from 'nodemailer';

export async function sendMail(opts: {
  to: string; subject: string; text: string;
  attachments: { filename: string; content: Buffer; contentType: string }[];
}): Promise<void> {
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD manquants');
  const t = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  await t.sendMail({
    from: process.env.APPLICANT_NAME ? `${process.env.APPLICANT_NAME} <${user}>` : user,
    to: opts.to, subject: opts.subject, text: opts.text, attachments: opts.attachments,
  });
}
