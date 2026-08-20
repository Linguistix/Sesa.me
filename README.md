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

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | `prisma generate` puis build de production |
| `npm test` | Tests unitaires (Vitest) |
| `npm run test:e2e` | Tests bout en bout (Playwright, serveur déjà démarré) |
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
    dashboard/         Éditeur, apparence, partage — protégé par `auth()`
    api/               QR code, déverrouillage de lien, Auth.js
  actions/             Server Actions (mutations) — hors de l'arbre de routage
  server/              Accès aux données, autorisation
  lib/
    theme/             Le contrat de thème : schéma, contraste, presets, rendu
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

## Accessibilité

Contraste WCAG AA garanti par construction (et corrigé automatiquement),
navigation clavier complète — y compris le réordonnancement des blocs via
dnd-kit —, attributs `alt` sur les images, et respect de `prefers-reduced-motion`.

## Feuille de route

- [x] **Phase 1 — MVP** : page publique, CRUD des blocs, glisser-déposer,
      thèmes préconçus, QR code, liens protégés
- [ ] **Phase 2 — Monétisation** : analytics, raccourcisseur de liens, Pro, Stripe
- [ ] **Phase 3 — IA** : génération de thème, résumés analytics
- [ ] **Phase 4 — Intégrations** : Spotify/YouTube/Twitch, deep links,
      formulaires, galerie, multi-langue, domaine personnalisé
