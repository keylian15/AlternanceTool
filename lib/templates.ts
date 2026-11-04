import { getSetting } from './db';

export const DEFAULT_LM = `{{nom}}
Cycle ingénieur informatique, EILCO (Calais)

{{entreprise}}
{{ville}}

Objet : candidature en alternance, {{poste}}

Madame, Monsieur,

En cycle ingénieur informatique à l'EILCO, je recherche une alternance de deux ans (2e et 3e années) à partir de septembre 2027. Votre offre « {{poste}} » a retenu toute mon attention.

En parallèle de ma formation, je développe un jeu multijoueur sous Unreal Engine 5, j'administre un serveur de jeu pour un groupe d'amis et j'ai travaillé sur un projet de segmentation d'images avec des modèles de vision (SAM). Ces projets m'ont appris à concevoir, déployer et maintenir un système complet, de l'interface jusqu'au serveur.

{{phrase_international}}

Je suis disponible pour vous présenter mon parcours et mes motivations lors d'un entretien. Mon CV est joint à ce message.

Dans l'attente de votre retour, je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.

{{nom}}`;

export const DEFAULT_SUBJECT = 'Candidature alternance ingénieur informatique, {{poste}} (septembre 2027)';

export const DEFAULT_BODY = `Madame, Monsieur,

Je vous adresse ma candidature pour l'offre « {{poste}} » ainsi que mon CV et ma lettre de motivation en pièces jointes.

Je reste disponible pour tout échange.

Cordialement,
{{nom}}`;

export const INTERNATIONAL_SENTENCE =
  "Ma formation comprend une période à l'étranger en 3e année : la présence internationale de {{entreprise}} rend votre offre d'autant plus intéressante pour moi.";

export type Vars = { poste: string; entreprise: string; ville: string; international?: boolean };

export function render(tpl: string, v: Vars): string {
  const nom = process.env.APPLICANT_NAME || '';
  const phrase = v.international ? INTERNATIONAL_SENTENCE : '';
  return tpl
    .replace(/\{\{phrase_international\}\}/g, phrase)
    .replace(/\{\{nom\}\}/g, nom)
    .replace(/\{\{poste\}\}/g, v.poste)
    .replace(/\{\{entreprise\}\}/g, v.entreprise)
    .replace(/\{\{ville\}\}/g, v.ville)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function getTemplates() {
  const [lm, subject, body] = await Promise.all([
    getSetting('lm_template', DEFAULT_LM),
    getSetting('mail_subject', DEFAULT_SUBJECT),
    getSetting('mail_body', DEFAULT_BODY),
  ]);
  return { lm, subject, body };
}
