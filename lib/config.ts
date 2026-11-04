/** Zones de recherche : villes accessibles en train depuis Calais (ou depuis Douai). */
export const ZONES = [
  { name: 'Calais', lat: 50.9513, lon: 1.8587, radius: 25 },
  { name: 'Dunkerque', lat: 51.0343, lon: 2.3768, radius: 15 },
  { name: 'Boulogne-sur-Mer', lat: 50.7264, lon: 1.6147, radius: 15 },
  { name: 'Saint-Omer', lat: 50.75, lon: 2.252, radius: 15 },
  { name: 'Lille', lat: 50.6292, lon: 3.0573, radius: 20 },
  { name: 'Douai', lat: 50.3708, lon: 3.08, radius: 15 },
  { name: 'Lens', lat: 50.4328, lon: 2.831, radius: 12 },
  { name: 'Arras', lat: 50.291, lon: 2.7775, radius: 12 },
];

/** Codes ROME : études/développement, expertise SI, MOA, multimédia (jeu vidéo), data. */
export const ROMES = ['M1805', 'M1802', 'M1806', 'E1205', 'E1104', 'M1403'];

/** Intitulés informatiques : sert de 2e critère quand le code métier de l'offre n'est pas dans ROMES. */
export const IT_TITLE =
  /(d[ée]velopp(?:eu|eur|euse|ement)|informatique|logiciel|software|full[\s-]?stack|front[\s-]?end|back[\s-]?end|devops|\bdata\b|\bdonn[ée]es\b|\bia\b|intelligence artificielle|machine learning|deep learning|\bml\b|programmeu|jeux? vid[ée]o|\bgame|unity|unreal|python|\bjava\b|javascript|\breact\b|angular|\.net|\bcloud\b|\bweb\b|syst[èe]mes? d['’]information|cybers[ée]curit|ing[ée]nieur (?:d['’]?\s?)?(?:[ée]tudes|logiciel|syst[èe]me|recherche)|\br&d\b|tech lead|\bqa\b|\btesteur\b)/i;

/** Exclusion immédiate sur l'intitulé (avant tout appel IA). "réseaux de neurones" est épargné. */
export const EXCLUDE_TITLE =
  /\b(r[ée]seaux?(?!\s+(de\s+neurones|neuronaux))|sysadmin|administrateur\s+(syst[èe]mes?|r[ée]seaux?)|t[ée]l[ée]coms?|helpdesk|support\s+informatique|technicien|bts|cap|bac\s*pro)\b/i;

/** Ordre de préférence des sources (sert à choisir le lien principal d'une offre). */
export const SOURCE_PRIORITY = [
  'la bonne alternance', 'walt', 'ulco', 'hellowork', 'jobteaser',
  '1jeune1solution', 'france travail', 'indeed', 'welcome to the jungle',
];

export const INTERESTS =
  "jeu vidéo, développement fullstack, intelligence artificielle, data. Pas de réseau/télécom/administration système. " +
  "Préférence pour les moyennes et grandes entreprises, avec filiales à l'étranger en bonus (une partie de la 3e année se fait à l'étranger).";

export const SEND_FOLLOWUP_DAYS = 10;
