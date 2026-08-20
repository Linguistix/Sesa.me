# Pipeline analytics

## Ce qui est mesuré, et ce qui ne l'est pas

Une visite produit une ligne dans `analytics_events` :

| Colonne | Contenu | Provenance |
|---|---|---|
| `type` | `PAGE_VIEW` ou `LINK_CLICK` | — |
| `source` | hôte du référent (`instagram.com`) | jamais l'URL complète |
| `country` | code ISO à deux lettres | en-tête géo du CDN |
| `device` | `mobile` / `tablet` / `desktop` | classification grossière de l'`User-Agent` |
| `visitorHash` | pseudonyme tournant | SHA-256(sel serveur + jour + page + IP + UA) |

**Aucune adresse IP n'est stockée.** Elle n'existe que le temps de calculer le
hash, qui est salé côté serveur et change chaque jour : le même visiteur produit
un identifiant différent demain, donc rien ne permet de le suivre dans le temps.

Ce que l'on ne collecte pas : cookies, empreinte de navigateur, chemin du
référent, résolution d'écran, identifiant publicitaire.

## Pourquoi la mesure se fait côté navigateur

Les pages publiques sont servies depuis le cache ISR. Un cache hit n'exécute
aucun code serveur — une vue ne peut donc pas être comptée pendant le rendu.
Le composant `AnalyticsTracker` envoie un *beacon* vers `POST /api/events`.

Conséquence assumée : les bloqueurs de publicité suppriment une partie des
vues. Les **liens courts** (`/u/<code>`) ne sont pas concernés, puisque le clic
est enregistré par le redirecteur côté serveur, avant la redirection.

Cet endpoint est nécessairement public. Ses défenses :

- limitation de débit par IP (`analyticsLimiter`) ;
- vérification que `linkId` appartient bien à `pageId` — sans quoi n'importe qui
  pourrait attribuer des clics à n'importe quelle page ;
- réponse `204` systématique, y compris en cas de rejet, pour ne pas transformer
  l'endpoint en outil d'énumération d'identifiants.

## Consentement

Le bandeau demande le consentement avant toute mesure, et respecte
`navigator.globalPrivacyControl` ainsi que `Do Not Track` : si l'un des deux est
actif, rien n'est envoyé et le bandeau ne s'affiche pas — la question a déjà été
tranchée au niveau du navigateur.

## Agrégation

Le tableau de bord lit `analytics_events` via des requêtes groupées
(`src/server/analytics.ts`). Les index couvrent les trois axes utilisés :

```
@@index([pageId, createdAt])          -- séries temporelles, ventilations
@@index([linkId, createdAt])          -- performance par lien
@@index([pageId, type, createdAt])    -- compteurs vues / clics
```

La série quotidienne est complétée par des zéros côté application plutôt que par
un `generate_series` en SQL : une journée sans trafic doit apparaître comme un
creux, pas disparaître du graphique.

## Passage à l'échelle

La table est **append-only** et n'est jamais mise à jour, ce qui la rend
directement partitionnable. Dans l'ordre, quand le volume l'exige :

1. **Partitionnement par mois** sur `createdAt` (`PARTITION BY RANGE`). Les
   requêtes du tableau de bord portent toutes sur une fenêtre glissante, donc
   l'élagage de partitions les rend quasi constantes quel que soit l'historique.
   La purge devient un `DROP PARTITION` au lieu d'un `DELETE` massif.
2. **Agrégats pré-calculés** : une table `daily_stats (pageId, date, views,
   clicks)` alimentée par un travail périodique. Le tableau de bord lit alors des
   dizaines de lignes au lieu de millions ; les événements bruts ne servent plus
   qu'aux analyses ad hoc.
3. **ClickHouse** si la charge dépasse ce que Postgres absorbe confortablement.
   `src/server/analytics.ts` isole déjà toutes les lectures derrière des
   fonctions typées (`summarize`, `dailySeries`, `linkPerformance`, …) : seul le
   corps de ces fonctions change, pas leurs appelants.

Rien de tout cela n'est nécessaire au démarrage, et l'ajouter trop tôt coûterait
plus qu'il ne rapporte — d'où le choix d'une table simple et bien indexée.

## Rétention

`PLAN_LIMITS[plan].analyticsRetentionDays` borne la fenêtre consultable (30 jours
en Gratuit, 365 en Pro). La borne est appliquée **côté serveur**, à la fois dans
la page et dans l'export CSV, pour qu'elle ne puisse pas être contournée en
modifiant la query string.
