# Stockage d'objets

Les avatars et les images de galerie sont téléversés **directement du
navigateur vers le bucket**, via une URL présignée. Le fichier ne transite
jamais par le serveur applicatif : une photo de 8 Mo n'a pas à traverser une
fonction serverless soumise à une limite de taille de corps, ni à être payée
deux fois en bande passante.

Compatible S3 : Cloudflare R2, Backblaze B2, MinIO ou S3 lui-même. C'est la
raison de `S3_ENDPOINT` et de `forcePathStyle` — R2 et MinIO adressent les
buckets par chemin, S3 par sous-domaine.

## Le flux

```
navigateur                 application                     bucket
    │                           │                            │
    │── POST /api/uploads/presign ──▶                        │
    │   {purpose, contentType, contentLength}                │
    │                           │                            │
    │                    vérifie la session,                 │
    │                    valide type + taille,               │
    │                    génère la clé                       │
    │                           │                            │
    │◀── {uploadUrl, publicUrl, headers} ──                  │
    │                           │                            │
    │────────────── PUT uploadUrl (le fichier) ─────────────▶│
    │                           │                            │
    │◀───────────────────── 200 ─────────────────────────────│
```

## Ce que la signature protège

Trois éléments sont **inclus dans la signature**, et chacun ferme un trou
qu'une URL présignée naïve laisse ouvert :

| Élément | Sans lui |
|---|---|
| **La clé**, générée côté serveur depuis l'id de session | un utilisateur pourrait écrire sous le préfixe d'un autre et écraser son avatar |
| **`Content-Type`** | une URL émise pour un PNG accepterait un corps `text/html` — du XSS stocké sur le domaine qui sert le bucket |
| **`Content-Length`** | le plafond de taille ne serait qu'une vérification côté client, contournable |

> ⚠️ **`Content-Type` n'est pas signé par défaut.** Le présignateur du SDK AWS
> le sort de la signature — il ne signe que `content-length;host`. Il faut le
> forcer explicitement :
>
> ```ts
> getSignedUrl(client, command, {
>   expiresIn: 120,
>   signableHeaders: new Set(["content-type", "content-length"]),
> });
> ```
>
> `e2e/uploads.spec.ts` vérifie que `X-Amz-SignedHeaders` contient bien les
> deux, précisément pour que cette protection ne disparaisse pas
> silencieusement lors d'une mise à jour du SDK.

La durée de vie de l'URL est de **120 secondes** : assez pour téléverser, trop
court pour qu'une URL qui fuite reste un identifiant d'écriture durable.

## Formats acceptés

`image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif`.

**SVG est délibérément exclu.** Un SVG est un document qui peut embarquer du
script, et ces fichiers sont servis depuis une URL que la page intègre :
l'accepter reviendrait à offrir du XSS stocké contre chaque visiteur. Le coût
est qu'un créateur ne peut pas téléverser un logo vectoriel ; c'est le bon
arbitrage.

Plafonds : **2 Mo** pour un avatar (rendu à 96 px, il n'a jamais besoin d'être
lourd), **8 Mo** pour une image de galerie (vue en plein écran dans la
lightbox).

## Configuration du bucket

### CORS — obligatoire

Un téléversement direct depuis le navigateur est une requête **cross-origin**,
et un `PUT` avec un `Content-Type` d'image n'est pas une « simple request » :
le navigateur envoie donc un préflight `OPTIONS`. **Sans politique CORS sur le
bucket, tous les téléversements échouent** — et l'échec est silencieux côté
serveur, puisqu'il se produit avant que la requête n'atteigne le stockage.

```json
[
  {
    "AllowedOrigins": ["https://sesa.me"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 86400
  }
]
```

`AllowedOrigins` doit lister l'origine exacte de l'application — pas `*`, sinon
n'importe quel site peut faire téléverser ses visiteurs vers votre bucket avec
une URL présignée dérobée.

### Lecture publique

Les objets sous `uploads/` doivent être lisibles publiquement, directement ou
via un CDN placé devant (`S3_PUBLIC_URL`). Les clés étant aléatoires, une image
remplacée est une nouvelle clé — ce qui rend l'en-tête
`Cache-Control: public, max-age=31536000, immutable` correct et sûr.

### En-têtes de réponse recommandés

Servez `X-Content-Type-Options: nosniff` depuis le CDN. Le type est déjà
contraint à la signature, mais le sniffing est une défense en profondeur qui ne
coûte rien.

## Sans configuration

`S3_BUCKET`, `S3_ACCESS_KEY_ID` et `S3_SECRET_ACCESS_KEY` sont optionnels. Sans
eux, `isStorageConfigured()` est faux, le bouton de téléversement n'est pas
rendu, et les champs d'image acceptent une URL externe comme auparavant. Rien
d'autre ne change.

## Suppression

`deleteByPublicUrl()` ne supprime que ce qui nous appartient : l'URL doit être
sur notre origine, contenir `/uploads/`, **et** commencer par le préfixe de
l'utilisateur qui demande la suppression. Les champs d'image acceptant aussi
des URL externes, une suppression ne doit jamais être dirigée vers l'hôte de
quelqu'un d'autre.
