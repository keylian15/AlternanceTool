import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const clean = (s: string) =>
  s.replace(/[\u202f\u00a0]/g, ' ').replace(/[^\x09\x0A\x20-\x7E\u00A0-\u00FF\u2018\u2019\u201C\u201D\u2013\u2014\u2026\u20AC\u0152\u0153]/g, '?');

/** Génère un PDF A4 simple à partir du texte de la lettre. */
export async function letterToPdf(text: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const size = 11, lead = 15, margin = 62;
  let page = pdf.addPage([595, 842]);
  const maxW = 595 - margin * 2;
  let y = 842 - margin;

  for (const para of clean(text).split('\n')) {
    const words = para.split(' ');
    let line = '';
    const flush = (l: string) => {
      if (y < margin) { page = pdf.addPage([595, 842]); y = 842 - margin; }
      if (l) page.drawText(l, { x: margin, y, size, font, color: rgb(0.08, 0.08, 0.1) });
      y -= lead;
    };
    if (!para.trim()) { flush(''); continue; }
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxW && line) { flush(line); line = w; } else line = test;
    }
    flush(line);
  }
  return pdf.save();
}
