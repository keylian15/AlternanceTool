# Alternance : outil de recherche et de suivi

Récupère les offres d'alternance (La Bonne Alternance, qui agrège France Travail, Hellowork, etc.), les score avec Gemini,
te les présente en cartes, prépare CV + lettre, programme l'envoi pour le prochain jour ouvré à 8h, et garde tout le suivi
(entreprise, source, ancienneté de l'offre, dates, statut, relances).

## Flux

1. Cron quotidien (05:00 UTC) : récupère les offres. 7 jours au premier lancement, ensuite depuis le dernier run réussi.
2. Filtres durs (réseau, télécom, BTS...), dédoublonnage multi-sources, puis score Gemini par lots de 10.
3. Page **Offres** : tri par score. **Passer** ou **Valider**.
4. **Valider** ouvre la dernière vérification (mail, objet, lettre) :
   - adresse mail trouvée : « Programmer l'envoi » (lendemain 8h, week-end sauté), annulable jusqu'à l'envoi ;
   - sinon : lien + CV + lettre PDF à télécharger, puis « Marquer comme envoyée ».
5. Cron d'envoi (07:00 UTC) : envoie ce qui est programmé et échu. Relance due 10 jours après.
6. **Suivi** : toutes les candidatures, statuts, notes, offres passées.
7. Offres d'autres sites (Walt, JobTeaser, Indeed, WTTJ) : colle le lien dans la page Offres.

## Mise en route

1. **Base Postgres gratuite** : crée un projet sur Neon (ou Supabase), copie l'URL de connexion *pooled* dans `DATABASE_URL`.
   Les tables se créent toutes seules au premier chargement.
2. **Gemini** : clé gratuite sur Google AI Studio, dans `GEMINI_API_KEY`. Modèle réglable avec `GEMINI_MODEL`.
3. **La Bonne Alternance** : demande un token sur https://api.apprentissage.beta.gouv.fr puis `LBA_API_TOKEN`.
4. **Gmail** : active la validation en 2 étapes, crée un mot de passe d'application, puis `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `APPLICANT_NAME`.
5. **Accès** : choisis `APP_PASSWORD`, et génère `SESSION_SECRET` et `CRON_SECRET` (`openssl rand -hex 32`).
6. **Déploiement** : pousse le dossier sur GitHub, importe-le dans Vercel, ajoute les variables d'environnement (voir `.env.example`), déploie.
7. Ouvre le site, connecte-toi, va dans **Réglages** : checklist de config, upload du CV (PDF), relecture des modèles de mail et de lettre.
8. Page **Offres** : « Récupérer les offres ». Le scoring démarre tout seul.

En local : `cp .env.example .env.local`, remplis, `npm install`, `npm run dev`.

## Points à connaître

- Le cron Vercel gratuit tourne 1 fois par jour avec une précision d'environ l'heure. Le cron d'envoi est à 07:00 UTC :
  8h en hiver, 9h en été (heure de Paris). Rien ne part avant l'heure programmée.
- L'API La Bonne Alternance n'expose pas toujours l'adresse mail de l'entreprise. Dans ce cas l'outil la cherche dans le texte de l'offre,
  sinon l'offre passe en mode « via le site » (lien + CV + lettre).
- Le connecteur (`lib/sources/lba.ts`) lit la réponse de façon tolérante. Si un champ manque après ton premier test réel,
  c'est le seul fichier à ajuster. Pour ajouter une source, crée un connecteur qui renvoie des `RawOffer` et appelle-le dans `runFetch`.
- Quota Gemini gratuit : le scoring se fait par lots ; si le quota est atteint, il reprend plus tard.
- Réglages métier (zones, codes ROME, mots exclus, pondération du score) : `lib/config.ts` et `lib/score.ts`.
