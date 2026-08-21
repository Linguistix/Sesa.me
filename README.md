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
| Cache / limites | Redis (optionnel, avec repli mémoire et disjoncteur) |
| Stockage | S3-compatible (R2, B2, MinIO) en téléversement direct |
| Tests | Vitest (unitaires) + Playwright (bout en bout) |

## Démarrage

**Prérequis** : Node 20+ et un PostgreSQL accessible. Rien d'autre — Redis,
Stripe, le stockage objet et l'IA sont tous optionnels.

```bash
npm install
cp .env.example .env
```

Renseignez ensuite **trois variables** dans `.env` — les seules obligatoires :

```bash
DATABASE_URL="postgresql://user:motdepasse@localhost:5432/sesame"
AUTH_SECRET="…"                              # openssl rand -base64 32
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Puis :

```bash
npx prisma migrate deploy     # crée le schéma
npm run db:seed               # compte de démo
npm run dev
```

### La démo

| | |
|---|---|
| Page publique | <http://localhost:3000/camille> |
| Connexion | <http://localhost:3000/login> |
| Identifiants | `demo@sesa.me` / `demo1234` |

La page de démo contient un exemple de chaque type de bloc : liens, titre de
section, texte, lecteur Spotify intégré, galerie photo, formulaire de contact
et un lien protégé par mot de passe (`secret123`).

Sans les variables optionnelles, les fonctionnalités concernées s'affichent
comme non configurées au lieu d'échouer : le panneau « Design IA », la page
Abonnement et la page Comptes connectés le signalent explicitement. Tout le
reste — éditeur, glisser-déposer, thèmes préconçus, QR code, statistiques,
formulaires — fonctionne.

<details>
<summary>Pas de PostgreSQL sous la main ?</summary>

```bash
docker run -d --name sesame-db -p 5432:5432 \
  -e POSTGRES_USER=sesame -e POSTGRES_PASSWORD=sesame -e POSTGRES_DB=sesame \
  postgres:16

# DATABASE_URL="postgresql://sesame:sesame@localhost:5432/sesame"
```
</details>

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
| `npm run test:redis` | Tests d'intégration Redis (serveur Redis local requis) |
| `npm run lint` | ESLint (flat config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Crée et applique une migration |
| `npm run db:seed` | Insère le compte de démonstration |

Les tests Playwright supposent une application déjà lancée sur `BASE_URL`
(`http://localhost:3000` par défaut). Les suites qui touchent au stockage ou à
l'OAuth s'appuient sur deux serveurs de test locaux — voir
[`test-harness/`](test-harness/README.md) :

```bash
redis-server --daemonize yes
node test-harness/fake-s3.mjs &
node test-harness/mock-oauth.mjs &
npm run build && npm start &
npm run test:e2e
```

Sans ces services, les suites concernées vérifient la dégradation prévue
plutôt que d'échouer.

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
    cache.ts           Cache partagé (Redis ou mémoire) devant la lecture DB
    oauth/             Flux OAuth créateur (PKCE, state) — voir docs/connections.md
    storage.ts         Téléversement direct S3/R2 — voir docs/storage.md
    redis.ts           Client partagé + disjoncteur
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
| [`docs/connections.md`](docs/connections.md) | OAuth créateur, PKCE, rafraîchissement, blocs synchronisés |
| [`docs/storage.md`](docs/storage.md) | Téléversement direct, signature, CORS |

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
- Les téléversements passent par une URL présignée dont la **signature couvre
  le type et la taille** — sans quoi une URL émise pour un PNG accepterait du
  `text/html`. SVG est refusé.
- Les autorisations OAuth créateur sont des accès **en lecture seule**, séparés
  de l'authentification : une autorisation de données ne peut pas devenir une
  connexion.

## Accessibilité

Contraste WCAG AA garanti par construction (et corrigé automatiquement),
navigation clavier complète — y compris le réordonnancement des blocs via
dnd-kit —, attributs `alt` sur les images, et respect de `prefers-reduced-motion`.

## Déploiement

Cinq intégrations sont optionnelles. Sans elles l'application démarre et
fonctionne ; les fonctionnalités concernées se signalent comme non configurées.

| Intégration | Variables | Sans elle |
|---|---|---|
| **Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | la page Abonnement indique que la facturation n'est pas configurée |
| **IA** | `ANTHROPIC_API_KEY` | pas de génération de thème ni de résumé hebdomadaire ; l'éditeur manuel et les thèmes préconçus fonctionnent |
| **Stockage** | `S3_*` — voir [`docs/storage.md`](docs/storage.md) | les champs d'image acceptent une URL au lieu d'un téléversement |
| **Redis** | `REDIS_URL` | limites de débit et cache par processus au lieu d'être partagés |
| **OAuth créateur** | `SPOTIFY_*`, `GOOGLE_*` — voir [`docs/connections.md`](docs/connections.md) | pas de bloc synchronisé automatiquement |

Deux points de configuration ne sont pas dans le code et se règlent chez le
fournisseur :

- **CORS sur le bucket** — obligatoire, sinon chaque téléversement direct
  échoue au préflight, avant même d'atteindre le stockage. Politique exacte
  dans [`docs/storage.md`](docs/storage.md).
- **URI de redirection OAuth** — à déclarer chez Spotify et Google :
  `<NEXT_PUBLIC_APP_URL>/api/connections/<provider>/callback`.

### Redis en production

`REDIS_URL` est optionnel mais recommandé dès qu'il y a plus d'un processus :
les compteurs de limitation en mémoire sont par instance, donc la limite
effective se multiplie par le nombre d'instances.

Un disjoncteur protège le chemin critique : après trois échecs consécutifs,
Redis est ignoré pendant dix secondes plutôt que de faire payer un timeout à
chaque requête. Mesuré, une panne Redis sans disjoncteur faisait passer une
page de 15 ms à 2,8 s.

## Feuille de route

- [x] **Phase 1 — MVP** : page publique, CRUD des blocs, glisser-déposer,
      thèmes préconçus, QR code, liens protégés
- [x] **Phase 2 — Monétisation** : analytics, raccourcisseur de liens, Pro, Stripe,
      export RGPD
- [x] **Phase 3 — IA** : génération de thème (§4), résumés analytics
- [x] **Phase 4 — Intégrations** : Spotify/Apple Music/SoundCloud/YouTube/Twitch,
      deep links natifs, formulaires, galerie photo, multi-langue FR/EN/ES,
      domaine personnalisé
- [x] **Infrastructure** : OAuth créateur avec blocs auto-synchronisés,
      téléversement direct S3/R2, Redis partagé (limites + cache)
