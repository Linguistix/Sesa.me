# Intégrations et croissance (phase 4)

## Lecteurs intégrés

`src/lib/embeds/providers.ts` reconnaît Spotify, Apple Music, SoundCloud,
YouTube et Twitch.

Le principe est identique à celui du moteur de design : **l'URL fournie par
l'utilisateur n'est jamais transmise telle quelle**. Elle est analysée, ses
identifiants sont validés contre `^[A-Za-z0-9_-]{1,64}$`, puis l'URL d'embed est
*reconstruite*. Une URL qui ne correspond à aucune forme connue n'est pas
intégrée du tout : le bloc redevient un bouton ordinaire.

C'est ce qui empêche une URL arbitraire de devenir le `src` d'une iframe.

Les iframes portent par ailleurs :

- `sandbox` — le lecteur est du code tiers, il n'obtient que ce dont il a besoin ;
- `loading="lazy"` — trois lecteurs chargés immédiatement représenteraient
  plusieurs centaines de kilo-octets de JavaScript tiers avant le premier
  rendu, ce qui ferait sauter le budget d'une seconde ;
- `youtube-nocookie.com` pour YouTube, qui diffère le dépôt de cookies jusqu'à
  la lecture effective.

## Deep linking natif

Le problème concret : un lien ouvert depuis une bio Instagram s'exécute dans le
navigateur intégré d'Instagram. Ce navigateur **ignore les Universal Links**,
donc un lien `https://open.spotify.com/...` reste piégé dans la webview au lieu
d'ouvrir Spotify — visiteur non connecté, pas de bibliothèque, pas de lecture.

Deux mécanismes existent, et ils ne sont pas interchangeables :

| Mécanisme | Comportement si l'app est absente |
|---|---|
| Universal Links (iOS) / App Links (Android) — l'URL https telle quelle | repli silencieux vers le navigateur |
| Schéma personnalisé (`spotify:`, `vnd.youtube:`) | **échec visible** : onglet blanc ou erreur |

Le schéma personnalisé n'est donc utilisé **que** là où son échec peut être
détecté et rattrapé : dans le redirecteur de liens courts, quand
`isInAppBrowser()` reconnaît la webview d'Instagram, TikTok, Facebook, Snapchat
ou Twitter. Une page intermédiaire tente alors le schéma natif et le met en
course avec un minuteur de 1,2 s qui redirige vers l'URL https.

`pagehide` et `visibilitychange` annulent ce repli : un navigateur qui a réussi
le passage de main peut encore déclencher le minuteur au retour du visiteur, ce
qui le renverrait vers le site web qu'il venait justement de quitter.

Partout ailleurs, l'URL https est servie inchangée — elle atteint déjà l'app
installée via les Universal Links, et forcer un schéma n'ajouterait qu'un mode
de défaillance.

## Formulaires

Un propriétaire de page conçoit ses propres champs, donc la définition est une
donnée (`fieldsJson`) et non du code.

**Chaque soumission est validée contre la définition stockée**, jamais contre ce
que le navigateur a envoyé. Les clés non déclarées sont écartées plutôt que
rejetées : un onglet resté ouvert sur une version antérieure du formulaire doit
tout de même délivrer le reste, pas échouer devant un visiteur.

Les messages d'erreur sont construits en français à la construction du
validateur, et pas seulement sur `.min(1)` : un champ absent produirait sinon le
message interne de Zod, en anglais, devant l'utilisateur.

Le webhook sortant (Brevo, Mailchimp, n'importe quel endpoint) est *best-effort*
et déclenché après l'écriture en base : une panne chez un tiers ne doit pas
perdre une soumission déjà acquise.

Limite de débit plus stricte que pour l'analytics — 5 par minute et par IP :
ces lignes seront lues par un humain, un flot de spam coûte de l'attention.

## Galerie photo

Grille cliquable, lightbox plein écran. Le clavier n'est pas un ornement : une
lightbox qui capture le focus sans porte de sortie est pire que pas de lightbox.
Échap ferme, les flèches naviguent, et le défilement de la page derrière est
bloqué pendant l'ouverture.

## Multi-langue

Trois locales : FR, EN, ES.

`negotiateLocale()` implémente l'ordre des q-values plutôt que de prendre la
première entrée : un navigateur qui envoie `de,en;q=0.9,fr;q=0.8` doit obtenir
l'anglais — pas le français, et pas la locale par défaut sous prétexte que
l'allemand n'est pas supporté.

Quand aucune langue du visiteur n'est supportée, la page bascule sur la locale
du **créateur** plutôt que sur la valeur par défaut de l'application : la page
d'un créateur français se lit mieux en français pour un visiteur dont nous ne
parlons pas la langue.

Le catalogue est typé sur les clés du catalogue français, donc **ajouter une clé
sans la traduire est une erreur de compilation**, pas une chaîne qui retombe
silencieusement en français devant un utilisateur.

Conséquence assumée : lire `Accept-Language` sort la page publique du cache
statique complet. Servir une page française à un visiteur hispanophone pour
gagner quelques millisecondes irait à l'encontre de ce à quoi sert le budget de
performance.

## Domaine personnalisé

Réservé au plan Pro. Le flux est délibérément en deux temps :

1. **Rattachement** — le nom d'hôte est validé plus strictement que la RFC : pas
   de point final, pas de label unique, pas de littéral IP, pas de port. Une
   valeur qui arrive ici devient une clé de routage, et l'ambiguïté y coûte plus
   cher que le rejet d'un nom exotique mais légal.
2. **Vérification** — un enregistrement TXT `_sesame-challenge.<domaine>` doit
   contenir le jeton généré. Tant qu'il n'est pas vérifié, **le domaine ne sert
   pas la page** : accepter un nom d'hôte sur parole permettrait à n'importe qui
   de revendiquer un domaine qu'il ne contrôle pas.

Changer de nom d'hôte réinitialise la vérification — prouver un domaine n'est
pas prouver le suivant.

La résolution `Host` → slug se fait dans la route racine plutôt que dans un
middleware, pour rester dans le runtime Node où Prisma fonctionne.
