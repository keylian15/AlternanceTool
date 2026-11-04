import { INTERESTS } from './config';

export type Analysis = {
  id: number;
  domain: string;
  domain_match: number;
  missions_match: number;
  network_focus: boolean;
  company_size: 'TPE' | 'PME' | 'ETI' | 'GE' | 'inconnue';
  foreign_subsidiaries: boolean | null;
  lm_required: boolean | null;
  contact_email: string | null;
  summary: string;
  title?: string;
  company?: string;
  city?: string;
};

export type AnalyzeInput = { id: number; title: string; company: string; city: string; description: string };

export class GeminiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const SHAPE = `{"results":[{"id":<id reçu>,"domain":"jeu vidéo|fullstack|IA|data|autre","domain_match":0-100,"missions_match":0-100,"network_focus":true|false,"company_size":"TPE|PME|ETI|GE|inconnue","foreign_subsidiaries":true|false|null,"lm_required":true|false|null,"contact_email":"adresse trouvée dans le texte ou null","summary":"3 à 4 phrases : missions, stack, entreprise, lieu"}]}`;

/** Analyse un lot d'offres en un seul appel (économise le quota gratuit). */
export async function analyzeMany(items: AnalyzeInput[], extract = false): Promise<Analysis[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError('GEMINI_API_KEY manquante', 500);
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const offers = items
    .map((o) => `### OFFRE id=${o.id}\nTitre: ${o.title}\nEntreprise: ${o.company}\nLieu: ${o.city}\nTexte:\n${o.description.slice(0, 3500)}`)
    .join('\n\n');

  const prompt = `Tu évalues des offres d'alternance pour un étudiant en cycle ingénieur informatique (alternance de 2 ans à partir de septembre 2027).
Centres d'intérêt : ${INTERESTS}
- domain_match : adéquation avec jeu vidéo / fullstack / IA / data (0 = hors sujet).
- missions_match : les missions décrites sont-elles réellement du développement/ingénierie (pas du support déguisé) ?
- network_focus : true si le poste est surtout réseau, télécom, sysadmin ou infrastructure.
- foreign_subsidiaries : true si l'entreprise a clairement des filiales à l'étranger, null si inconnu.
- lm_required : true si l'offre demande explicitement une lettre de motivation, null si non précisé.
${extract ? '- Pour cette offre, déduis aussi "title", "company" et "city" depuis le texte brut de la page.\n' : ''}Réponds UNIQUEMENT avec du JSON de la forme : ${SHAPE}
Résumés en français, factuels, sans promotion.

${offers}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    }),
  });
  if (!res.ok) throw new GeminiError(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status);

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  const clean = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  const arr: Analysis[] = Array.isArray(parsed) ? parsed : parsed.results;
  if (!Array.isArray(arr)) throw new GeminiError('Réponse Gemini inattendue', 502);
  return arr;
}
