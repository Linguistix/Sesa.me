# Sesame

Plateforme link-in-bio : une page publique unique par créateur (`sesa.me/mon-nom`)
qui rassemble ses liens, sa musique, sa boutique et ses formulaires.

## Stack

| Couche | Choix |
|---|---|
| Frontend | Next.js 16 (App Router, RSC) + Tailwind CSS 4 |
| Backend | Server Actions + Route Handlers |
| Base de données | PostgreSQL 16 + Prisma 7 (driver adapter `pg`) |
| Auth | Auth.js v5, sessions JWT |
| Tests | Vitest (unitaires) + Playwright (bout en bout) |

## Démarrage

```bash
npm install
cp .env.example .env          # renseigner DATABASE_URL et AUTH_SECRET
npx prisma migrate deploy     # ou `npm run db:migrate` en développement
npm run db:seed               # compte de démo : demo@sesa.me / demo1234
npm run dev
```

La page de démo est alors sur <http://localhost:3000/camille>.

### Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Chaîne de connexion PostgreSQL |
| `AUTH_SECRET` | Secret de signature des sessions (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_APP_URL` | URL publique — sert aux QR codes et aux métadonnées |
| `ANALYTICS_SALT` | Sel du hash visiteur (analytics sans donnée personnelle) |
| `ANTHROPIC_API_KEY` | *Optionnel* — active la génération de thème et les résumés |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | *Optionnel* — active la facturation |

Sans les variables optionnelles, l'application démarre et fonctionne : les
fonctionnalités concernées se signalent comme non configurées.

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | `prisma generate` puis build de production |
| `npm test` | Tests unitaires (Vitest) |
| `npm run test:e2e` | Tests bout en bout (Playwright, serveur déjà démarré) |
| `npm run lint` | ESLint (flat config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Crée et applique une migration |
| `npm run db:seed` | Insère le compte de démonstration |

Les tests Playwright supposent une application déjà lancée sur `BASE_URL`
(`http://localhost:3000` par défaut) :

```bash
npm run build && npm start &
npm run test:e2e
```

## Architecture

```
src/
  app/                 Routes (App Router)
    [slug]/            Page publique, rendue statiquement puis revalidée
    u/[code]/          Raccourcisseur de liens + deep linking natif
    dashboard/         Éditeur, apparence, stats, réponses, domaine, abonnement
    api/               QR code, événements, formulaires, Stripe, export, Auth.js
  actions/             Server Actions (mutations) — hors de l'arbre de routage
  server/              Accès aux données, autorisation
  lib/
    theme/             Le contrat de thème : schéma, contraste, presets, rendu
    ai/                Moteur de design et résumés — voir docs/ai-design.md
    analytics/         Identification visiteur sans donnée personnelle
    embeds/            Détection des lecteurs (liste blanche de fournisseurs)
    i18n/              Négociation de langue et catalogues FR/EN/ES
  components/
    public/            Rendu de la page publique (sans JS superflu)
    dashboard/         Éditeur, glisser-déposer, aperçu en direct
```

### Le contrat de thème

`src/lib/theme/` est le cœur du produit et la cible de la génération par IA
prévue en phase 3 :

- **`schema.ts`** — le schéma Zod qu'un thème doit respecter. Les polices sont
  une liste blanche, pas du texte libre.
- **`contrast.ts`** — luminance relative et ratios WCAG 2.1, plus une réparation
  qui déplace la clarté d'une couleur en conservant sa teinte.
- **`sanitize.ts`** — `sanitizeTheme()` est le **seul** chemin autorisé entre une
  donnée de thème non fiable et le rendu : validation stricte, repli silencieux
  vers le thème par défaut en cas d'échec, puis correction automatique de tout
  couple de couleurs sous 4.5:1.
- **`render.ts`** — traduit un thème validé en variables CSS. Le moteur de rendu
  *interprète* la configuration ; il n'exécute jamais de HTML ou de CSS produit
  par un modèle.

Les thèmes préconçus passent le même audit d'accessibilité que la sortie de
l'IA — `presets.test.ts` échoue si l'un d'eux descend sous WCAG AA.

### Documentation

| Document | Contenu |
|---|---|
| [`docs/ai-design.md`](docs/ai-design.md) | Moteur de design par IA, chaîne de garanties, quotas |
| [`docs/analytics.md`](docs/analytics.md) | Pipeline d'événements, vie privée, passage à l'échelle |
| [`docs/integrations.md`](docs/integrations.md) | Lecteurs, deep linking, formulaires, i18n, domaines |

## Sécurité

- Les liens protégés par mot de passe ne transmettent **jamais** leur URL au
  navigateur : elle reste côté serveur jusqu'à ce que `POST /api/links/:id/unlock`
  valide le mot de passe (bcrypt).
- Les URL de liens sont restreintes à `http(s)` — `javascript:` et `data:`
  seraient du XSS stocké.
- Chaque mutation vérifie la propriété de la page dans sa clause `where`, donc un
  identifiant deviné ne modifie aucune ligne.
- Les slugs réservés (`api`, `dashboard`, `_next`, …) ne peuvent pas être
  revendiqués : ils partagent l'espace de noms des routes racine.
- Les lecteurs intégrés proviennent d'une liste blanche de fournisseurs et leur
  URL est **reconstruite** à partir d'identifiants validés — jamais reprise
  telle quelle. Les iframes sont `sandbox`ées et chargées paresseusement.
- Les soumissions de formulaire sont validées contre la définition **stockée**,
  jamais contre ce que le navigateur envoie : les champs non déclarés sont
  écartés.
- Un domaine personnalisé ne sert la page qu'une fois la propriété prouvée par
  un enregistrement TXT.

## Accessibilité

Contraste WCAG AA garanti par construction (et corrigé automatiquement),
navigation clavier complète — y compris le réordonnancement des blocs via
dnd-kit —, attributs `alt` sur les images, et respect de `prefers-reduced-motion`.

## Ce qui reste ouvert

- **OAuth créateur** (§1.5) — connecter un compte Spotify ou YouTube pour
  afficher automatiquement la dernière sortie. L'infrastructure est en place
  (modèle `Account`, Auth.js configuré pour accueillir des providers), mais
  cela demande d'enregistrer une application chez chaque fournisseur.
- **Stockage de fichiers** (R2/S3) — les avatars et images de galerie sont
  aujourd'hui des URL externes. Le passage à un téléversement direct est un
  travail d'infrastructure, pas de produit.
- **Redis** — le limiteur de débit est en mémoire, correct pour un processus
  unique. `createRedisRateLimiter()` existe déjà derrière la même interface
  pour un déploiement multi-instances.

## Feuille de route

- [x] **Phase 1 — MVP** : page publique, CRUD des blocs, glisser-déposer,
      thèmes préconçus, QR code, liens protégés
- [x] **Phase 2 — Monétisation** : analytics, raccourcisseur de liens, Pro, Stripe,
      export RGPD
- [x] **Phase 3 — IA** : génération de thème (§4), résumés analytics
- [x] **Phase 4 — Intégrations** : Spotify/Apple Music/SoundCloud/YouTube/Twitch,
      deep links natifs, formulaires, galerie photo, multi-langue FR/EN/ES,
      domaine personnalisé
