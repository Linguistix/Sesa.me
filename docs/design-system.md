# Système de design

Ce document décrit les règles qui tiennent l'interface de l'outil. Il ne parle
pas des pages publiques : celles-ci sont rendues à partir du thème du créateur
et obéissent au contrat de `src/lib/theme/` — voir `docs/ai-design.md`.

La distinction est la ligne directrice de tout ce qui suit : **le chrome de
l'outil reste silencieux pour que la page du créateur soit la seule chose
saturée à l'écran.** Un chrome qui rivalise avec la toile fait paraître le
produit moins bon qu'il n'est.

## Jetons

Tout est déclaré dans `@theme` (`src/app/globals.css`), donc chaque jeton
génère sa classe utilitaire : `--color-ink-850` devient `bg-ink-850`. Une
définition, pas de dérive entre une variable CSS et un hexadécimal codé en dur
dans un composant.

### La rampe de gris

Elle a **deux zones**, et l'écart entre les deux est délibéré :

| Plage               | Usage                                   |
| ------------------- | --------------------------------------- |
| `ink-950` … `ink-700` | surfaces, bordures, filets. Jamais de texte. |
| `ink-600` … `ink-50`  | texte uniquement.                       |

Chaque échelon de la zone texte passe WCAG AA (4,5:1) contre la surface la plus
claire sur laquelle du texte se pose jamais (`ink-750`, `#22222d`). C'est cet
invariant qui permet à un composant de choisir `text-ink-600` pour une légende
sans aller vérifier la surface en dessous.

> Cet invariant a déjà été cassé une fois : `--color-ink-500` avait été écrit
> `#55556577`, un hexadécimal de huit chiffres dont le `77` final est un octet
> alpha. Toutes les légendes concernées s'affichaient à 2,7:1 tout en ayant
> l'air parfaitement volontaire dans le code source. C'est précisément pour ça
> que `e2e/contrast.spec.ts` existe.

### L'accent

`accent-500` (`#7c6bf5`) est la teinte de marque, utilisée **comme texte** sur
fond sombre (5,03:1) et pour les bordures et les lueurs.

Un bouton plein veut l'inverse : du blanc sur `accent-500` ne fait que 3,98:1.
Assombrir le jeton unique pour corriger le bouton ternirait chaque libellé
accentué de l'interface, donc le remplissage plein a sa propre paire :

- `accent-solid` (`#6a59e2`) — 5,07:1 avec du blanc
- `accent-solid-hover` (`#7160e8`) — 4,63:1, et le survol éclaircit toujours

L'accent ne sert qu'à l'action principale et à l'état courant. Le dépenser
ailleurs est ce qui rend une interface bavarde.

### La typographie

L'interface est en **Rubik**, chargée par `next/font` (`app/layout.tsx`), qui
télécharge les fichiers au build et les sert depuis notre propre origine. Ce
n'est pas un détail de confort : une police tierce récupérée à l'exécution est
une requête qui peut se bloquer, et celle-ci bloquerait tout l'outil. L'auto-
hébergement supprime aussi le décalage de mise en page.

`--font-sans` est le seul jeton de police du chrome. La police d'affichage des
pages publiques est **celle du créateur**, via `--sesame-font-display` — une
variable différente, alimentée par son thème.

## Primitives

Rien de tout cela n'est obligatoire, mais un écran qui roule sa propre version
d'une de ces choses est un écran qui dérivera.

| Composant | Rôle |
| --------- | ---- |
| `Button`, `ButtonLink`, `ButtonAnchor` (`ui/Button`) | Actions. `variant` : `primary` \| `secondary` \| `ghost` \| `danger`. Le variant `danger` est volontairement discret — bordure seule, rouge au survol : une suppression doit être trouvable, pas criarde. |
| `Panel` (`ui/Panel`) | Une surface surélevée. La séparation vient d'un filet plus d'un cran de fond, pas d'une ombre lourde : à ces niveaux de noir une grande ombre lit comme une bavure. `as` accepte `section`/`article`/`aside` quand le panneau est aussi un repère. |
| `PageHeader`, `SectionHeader` (`ui/Panel`) | Les deux niveaux de titre. Avant leur existence chaque page écrivait son `h1` et choisissait sa marge basse, donc passer d'un écran à l'autre décalait la première ligne de quelques pixels. |
| `PageBody` (`ui/Panel`) | La colonne de contenu. `reading` (formulaires, prose) ou `wide` (tableaux, graphiques). |
| `Badge`, `EmptyState` (`ui/Panel`) | États et « il n'y a rien ici », composés plutôt que nus. `EmptyState bare` retire le liseré pointillé quand l'état vide est déjà dans un `Panel`. |
| `Field`, `TextInput`, `TextArea`, `Select`, `Switch` (`ui/Field`) | Champs. `Field` câble `htmlFor`, `aria-describedby` et `aria-invalid` par render prop, donc un champ ne peut pas être livré sans son label associé. |
| `Logo` (`ui/Logo`) | La marque. Une définition, trois emplacements. |

### Le mobile

Deux règles issues d'un même bug. `globals.css` contenait
`html, body { overflow-x: hidden }`, qui a l'air d'une protection anodine
contre une barre de défilement horizontale et n'est ni anodin ni une
protection :

1. `overflow-x: hidden` force `overflow-y` à `auto`. `html` et `body`
   deviennent des conteneurs de défilement — et un conteneur de défilement
   entre un élément collant et la fenêtre est ce contre quoi `position: sticky`
   se mesure. **Rien ne collait** dans l'application, en-tête compris.
2. Il masquait les débordements au lieu de les corriger. La barre d'onglets du
   tableau de bord faisait 462 px pour un écran de 412 : le dernier onglet
   était inatteignable, sans barre de défilement pour le signaler.

Donc : pas de clip à la racine. Un contenu trop large est un bug à corriger sur
l'élément — l'utilitaire `.rail` donne un défilement horizontal réel avec un
dégradé de bord qui *annonce* le geste. `e2e/mobile.spec.ts` mesure les deux.

Attention aussi au conteneur bloquant : dans une grille CSS, un *grid item*
n'est collant que dans sa propre zone. `ThemePicker` passe en flex sous `lg`
pour cette seule raison — c'est ce qui permet à l'aperçu de suivre les
contrôles.

## Les garde-fous

Deux suites vérifient ce que le regard ne voit pas :

- **`e2e/contrast.spec.ts`** mesure chaque élément portant du texte dans un vrai
  navigateur, à partir des styles calculés — le seul endroit où la cascade, la
  composition alpha et les couleurs héritées sont toutes résolues. Il compose
  les couches translucides comme le fait le compositeur, replie l'opacité de
  l'élément, ignore les contrôles désactivés (WCAG 1.4.3 les exempte) et saute
  les dégradés, dont le ratio n'a pas de valeur unique.
- **`e2e/mobile.spec.ts`** vérifie qu'aucune boîte dans le flux n'est plus
  large que l'écran d'un téléphone, que chaque onglet reste atteignable au
  doigt, et que l'aperçu reste visible pendant qu'on manipule les contrôles.
  Ce dernier point est géométrique et non scripté : `scrollIntoViewIfNeeded()`
  fait défiler un conteneur qu'un doigt ne peut pas atteindre, donc la version
  scriptée passait contre le bug même qu'elle devait attraper.
- **`e2e/editor-layout.spec.ts`** vérifie la géométrie. Une assertion sur du
  texte ou un rôle ne peut pas attraper un calque couvrant : un overlay en
  `pointer-events-none` laisse chaque élément « visible » et cliquable tout en
  peignant par-dessus. C'est exactement le bug qui avait rendu l'éditeur
  inutilisable, invisible pour les 45 autres tests.

Changer une valeur de jeton sans lancer ces deux-là est la façon dont les
teintes « discrètes » repassent silencieusement sous le seuil.
