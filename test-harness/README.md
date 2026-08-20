# Harnais de test

Deux serveurs locaux qui remplacent des services externes pendant les tests
bout en bout. Ils ne sont **jamais** utilisés en production — l'application
n'en a aucune connaissance ; seules des variables d'environnement pointent
vers eux.

## `mock-oauth.mjs` — fournisseur OAuth 2.0

Port 9100. Implémente `/authorize`, `/token`, et la tranche de l'API Spotify
que le moteur de synchronisation appelle (`/me`, `/me/albums`).

**Il vérifie réellement PKCE** : un `code_verifier` dont le SHA-256 ne
correspond pas au `code_challenge` stocké est rejeté avec `invalid_verifier`,
et un code d'autorisation est à usage unique. C'est ce qui rend le test du
flux non vacuous — le code testé est exactement celui qui parle à Spotify,
seul l'endpoint change.

Le point de terminaison `/me/albums` renvoie délibérément un vieil album
**après** un plus récent, pour que le test prouve que le tri est le nôtre et
non celui du fournisseur.

```bash
node test-harness/mock-oauth.mjs
```

```bash
SPOTIFY_CLIENT_ID="mock-client-id"
SPOTIFY_CLIENT_SECRET="mock-client-secret"
OAUTH_SPOTIFY_BASE_URL="http://127.0.0.1:9100"
OAUTH_SPOTIFY_API_URL="http://127.0.0.1:9100"
```

## `fake-s3.mjs` — stockage compatible S3

Port 9000. Accepte les `PUT` présignés, sert les `GET`, et **répond au
préflight CORS** — ce qui n'est pas un détail : sans politique CORS, un
téléversement direct depuis le navigateur échoue avant d'atteindre le
stockage, et c'est précisément le piège que ce harnais a permis de découvrir.

Il ne vérifie pas les signatures AWS (MinIO le ferait). Ce qu'il valide est ce
qui nous appartient : le flux HTTP complet, les en-têtes envoyés, et le
contenu stocké puis relu. La correction de la signature est la responsabilité
du SDK ; que `content-type` y figure bien est vérifié séparément en lisant
`X-Amz-SignedHeaders`.

```bash
node test-harness/fake-s3.mjs
```

```bash
S3_BUCKET="sesame-media"
S3_ENDPOINT="http://127.0.0.1:9000"
S3_ACCESS_KEY_ID="testkey"
S3_SECRET_ACCESS_KEY="testsecret123"
```

## Lancer la suite complète

```bash
redis-server --daemonize yes                 # limites + cache partagés
node test-harness/fake-s3.mjs &
node test-harness/mock-oauth.mjs &
npm run build && npm start &
npm run test:e2e
```

Les suites qui n'ont pas besoin d'un service donné passent sans lui : sans
`S3_*` l'uploader n'est pas rendu, sans `SPOTIFY_*` le sélecteur de source
automatique non plus, et les tests correspondants vérifient précisément cette
dégradation.
