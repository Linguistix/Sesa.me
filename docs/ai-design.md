# Moteur de design par IA

## Le principe

L'utilisateur décrit un style en français ; le système produit une
configuration de thème. **Le modèle n'écrit jamais de HTML ni de CSS.** Il
remplit un objet dont chaque champ est connu à l'avance, et c'est le moteur de
rendu de l'application qui interprète cet objet.

Cette distinction est la raison pour laquelle une sortie de modèle peut être
appliquée directement à une page publique sans risque : il n'existe aucun
chemin par lequel du texte généré deviendrait du code exécuté.

## La chaîne de garanties

Chaque génération traverse trois étapes, dans cet ordre :

### 1. Sortie structurée

L'appel passe `output_config.format` avec un JSON Schema
(`src/lib/ai/prompt.ts`). Le modèle renvoie donc un objet, pas de la prose.

Le prompt système énonce aussi la règle de contraste et la liste des polices —
mais **il s'agit d'une optimisation, pas d'une garantie** : elle fait en sorte
que le cas courant ne nécessite aucune correction. La garantie vient des deux
étapes suivantes.

### 2. Validation stricte

`sanitizeTheme()` re-parse la sortie avec Zod (`src/lib/theme/schema.ts`).
Tout ce qui n'est pas conforme — hexadécimal invalide, police hors liste, clé
manquante, champ en trop — déclenche un **repli silencieux vers le thème par
défaut**. Une page dégradée mais correcte vaut mieux qu'une page cassée.

La liste blanche des polices est une frontière de sécurité, pas une préférence
esthétique : un nom de police est interpolé dans une URL Google Fonts et dans
une déclaration CSS.

### 3. Vérification programmatique du contraste

`enforceContrast()` recalcule le ratio WCAG 2.1 de chaque couple de couleurs
réellement lu à l'écran, et corrige ceux qui passent sous 4.5:1 (3:1 pour les
grands textes).

La correction déplace la **luminosité** en conservant la **teinte** : un
utilisateur qui demande du doré obtient un doré lisible, jamais un gris. Les
fonds sont considérés comme fixes et seuls les premiers plans bougent, parce
que le fond porte l'essentiel de l'ambiance demandée.

Les corrections appliquées sont **affichées à l'utilisateur**, avec les ratios
avant et après. Une correction silencieuse serait vécue comme un bug.

> Les thèmes préconçus passent exactement le même audit
> (`presets.test.ts`) : rien ne s'affiche qui n'ait été vérifié.

## Ce que testent les garde-fous

`src/lib/ai/__tests__/guardrails.test.ts` traite le modèle comme une entrée
hostile. Chaque cas correspond à une sortie qu'un modèle pourrait produire :

| Cas | Comportement attendu |
|---|---|
| Blanc sur blanc | réparé, pas rejeté |
| Doré sur crème illisible | doré conservé, assombri jusqu'à 4.5:1 |
| Prose au lieu de JSON | repli silencieux |
| JSON de mauvaise forme | repli silencieux |
| Police hors liste | repli silencieux |
| Injection CSS via un nom de police | rejetée ; aucune accolade dans le rendu |
| Injection d'URL via un nom de police | rejetée ; l'URL reste sur `fonts.googleapis.com` |
| Clé supplémentaire non prévue | ignorée ; absente du rendu |

## Quotas et coûts

Chaque appel écrit une ligne dans `ai_generations`, ce qui remplit deux rôles :

- **Le quota.** Le plan Gratuit est limité à 3 générations par mois calendaire
  (`PLAN_LIMITS`). Le compteur est vérifié *avant* l'appel, et la ligne est
  écrite *même en cas d'échec* — sinon une boucle d'erreurs serait gratuite
  pour l'utilisateur et facturée à la plateforme.
- **L'affinage du prompt.** `prompt` et `output` sont conservés bruts, de sorte
  qu'une mauvaise génération puisse être reliée à ce qui a réellement été
  demandé au modèle.

La génération de thème est une tâche de correspondance contrainte, pas du
raisonnement ouvert : le schéma fait l'essentiel du travail. Elle tourne donc
en `effort: "low"`, ce qui garde la latence compatible avec un aperçu instantané
et le coût compatible avec des générations offertes.

## Résumé analytics en langage naturel

Même logique, appliquée à l'envers : **le modèle ne calcule rien.**

`buildFactSheet()` (`src/lib/ai/summary.ts`) construit une fiche de chiffres
déjà calculés — évolutions en pourcentage comprises, via `percentChange()` — et
le prompt système interdit explicitement d'en inventer ou d'en dériver
d'autres. Un résumé qui annonce « +32 % » doit être exact ; faire calculer 32 %
à un modèle de langage serait un risque gratuit alors que le pipeline connaît
déjà la réponse.

Quand une évolution n'est pas calculable (période précédente à zéro), la fiche
le dit explicitement plutôt que d'émettre une division par zéro déguisée, et le
prompt demande de ne pas la formuler en pourcentage.

Le résumé est un ornement : s'il échoue ou si la clé API est absente, le
tableau de bord affiche ses chiffres normalement.

## Sans clé API

`ANTHROPIC_API_KEY` est optionnelle. Sans elle, `getAnthropic()` renvoie `null`,
le panneau « Design par IA » indique que la fonctionnalité n'est pas configurée,
le résumé hebdomadaire est omis, et tout le reste de l'application — y compris
l'éditeur de thème manuel et les thèmes préconçus — fonctionne à l'identique.
