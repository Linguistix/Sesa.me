# Comptes connectés (OAuth créateur)

Un créateur connecte son compte Spotify ou YouTube pour qu'un bloc affiche
**automatiquement sa dernière sortie**, sans mise à jour manuelle.

## Autorisation, pas authentification

Ces autorisations sont volontairement **séparées de la connexion au site**.
Connecter Spotify signifie « tu peux lire mes sorties », pas « c'est comme ça
que je m'identifie ». Confondre les deux est une erreur courante et coûteuse :
une autorisation de lecture de données ne doit jamais pouvoir devenir un
moyen de se connecter au compte.

C'est pourquoi le flux est implémenté explicitement plutôt que confié au
fournisseur d'authentification. Les jetons sont stockés dans la table
`Account`, qui a exactement la bonne forme et qu'Auth.js partagera si l'on
ajoute un jour la connexion par OAuth.

## Le flux

```
navigateur              application                    fournisseur
    │                        │                              │
    │─ GET /start ──────────▶│                              │
    │                  vérifie la session,                  │
    │                  génère state + code_verifier,        │
    │                  pose un cookie httpOnly              │
    │                        │                              │
    │◀── 302 vers /authorize ─                              │
    │──────────────────────────────────────────────────────▶│
    │                        │                     l'utilisateur accepte
    │◀───────────── 302 /callback?code=…&state=… ───────────│
    │─ GET /callback ───────▶│                              │
    │                  compare state (temps constant),      │
    │                  échange code + verifier ────────────▶│
    │                  récupère l'identité ────────────────▶│
    │                  enregistre la connexion              │
    │◀── 302 /dashboard/connections?status=connected        │
```

## PKCE et state

**PKCE** (RFC 7636) lie le code d'autorisation au navigateur qui a démarré le
flux. Conçu à l'origine pour les clients publics, il compte aussi ici : un code
intercepté sur la redirection — fuite de `Referer`, appareil partagé, extension
malveillante — ne peut pas être échangé par quelqu'un d'autre sans le
`code_verifier`.

Le **state** protège du CSRF : sans lui, un attaquant pourrait forcer la
victime à lier *son* compte Spotify au compte Sesame de la victime. La
comparaison se fait en temps constant — c'est peu coûteux à faire correctement
et c'est la vérification qui sépare l'utilisateur d'une liaison forcée.

Les deux valeurs vivent dans un **cookie `httpOnly`**, `SameSite=Lax` :

- `httpOnly`, parce que ce qu'il faut prouver est « le même navigateur », et un
  cookie que le JavaScript de la page ne peut pas lire le prouve au meilleur
  coût ;
- `Lax` et non `Strict`, parce que le cookie doit survivre à la redirection
  de premier niveau depuis le fournisseur — `Strict` le supprimerait et chaque
  callback échouerait à la validation du state ;
- durée de vie de 10 minutes : c'est un aller-retour, pas une session.

Le cookie est effacé **avant** toute opération faillible, pour qu'un verifier
périmé ne puisse pas être rejoué.

## Portées demandées

| Fournisseur | Portées | Pourquoi |
|---|---|---|
| Spotify | `user-read-private`, `user-read-email`, `user-library-read` | identifier le compte lié, lire le catalogue |
| Google | `youtube.readonly` | lire la dernière vidéo |

**Aucune portée d'écriture.** Un test échoue si l'une d'elles contient
`write`, `modify`, `manage`, `delete` ou `upload` — pour qu'un élargissement
accidentel des permissions ne passe pas inaperçu.

Google exige `access_type=offline` **et** `prompt=consent` : sans les deux, une
reconnexion ne renvoie pas de `refresh_token` et l'autorisation meurt au bout
d'une heure sans pouvoir être renouvelée.

## Rafraîchissement des jetons

`accessTokenFor()` renouvelle le jeton s'il expire dans moins de **60 secondes**
— un jeton valide au moment du contrôle peut expirer pendant la requête qui
l'utilise.

Un `refresh_token` absent de la réponse **n'écrase pas** celui qui est stocké :
beaucoup de fournisseurs ne le renvoient qu'à la première autorisation, et
l'écraser par `null` ferait silencieusement expirer la connexion une heure plus
tard, définitivement.

## Synchronisation des blocs

Un bloc dont `syncProvider` est renseigné voit son `url` et son `title`
**réécrits en base** par le moteur de synchronisation. Le rendu public n'a donc
aucun cas particulier — et surtout, **le chargement d'une page publique
n'attend jamais une API tierce**.

- Fenêtre de fraîcheur : 30 minutes pour les synchronisations automatiques.
- « Synchroniser maintenant » **ignore** cette fenêtre. Elle existe pour ne pas
  marteler le fournisseur, pas pour transformer une demande explicite en
  non-action qui annonce quand même un succès.
- Un échec **conserve le contenu déjà résolu** et n'enregistre que l'erreur,
  affichée dans l'éditeur. Une autorisation révoquée doit être visible, pas
  vider la page d'un créateur.
- Déconnecter un compte arrête la synchronisation mais **ne supprime pas le
  bloc** : perdre une mise en page parce qu'un jeton a expiré serait une
  mauvaise surprise.

Les URL renvoyées par le fournisseur sont validées (`https` + hôte attendu)
avant d'être stockées. La réponse vient d'un tiers, par le réseau ; elle est
presque certainement correcte — mais « presque certainement » n'est pas le
niveau d'exigence pour une valeur qui va devenir un `href` public.

## Configuration

```bash
SPOTIFY_CLIENT_ID=""
SPOTIFY_CLIENT_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

URI de redirection à déclarer chez le fournisseur :

```
<NEXT_PUBLIC_APP_URL>/api/connections/spotify/callback
<NEXT_PUBLIC_APP_URL>/api/connections/google/callback
```

Sans identifiants, le fournisseur n'apparaît pas dans l'interface et le sélecteur
« source automatique » n'est pas rendu. Rien d'autre ne change.

## Tests

`e2e/connections.spec.ts` s'exécute contre un **fournisseur OAuth simulé** qui
vérifie réellement PKCE (un `code_verifier` erroné est rejeté). Le code testé
est donc exactement celui qui parle à Spotify — seul l'endpoint change, via
`OAUTH_SPOTIFY_BASE_URL`.

Sont couverts : le flux complet, le state incorrect, l'absence de cookie, le
refus de l'utilisateur, la résolution du contenu, la déconnexion, et le
**rafraîchissement du jeton** — que le chemin nominal n'atteint jamais, alors
qu'un rafraîchissement cassé fait mourir toutes les connexions une heure après
leur création.
