import { getAnthropic, SUMMARY_EFFORT, SUMMARY_MODEL } from "./client";

export interface WeeklySummaryInput {
  views: number;
  clicks: number;
  uniqueVisitors: number;
  ctr: number;
  previousViews: number;
  previousClicks: number;
  topSources: Array<{ label: string; count: number }>;
  topLinks: Array<{ title: string; clicks: number }>;
}

export interface WeeklySummary {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Percentage change between two periods.
 *
 * Computed here, in code, and handed to the model already finished. The model
 * is never asked to do arithmetic — the brief is explicit about this, and it
 * is the right call regardless: a summary that says "+32%" must be right, and
 * a language model computing 32% from two numbers is a needless risk when the
 * pipeline already knows the answer.
 *
 * Returns null when the previous period was zero, because "up from nothing"
 * has no meaningful percentage.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Formats the metrics as a fact sheet the model may only rephrase. */
export function buildFactSheet(input: WeeklySummaryInput): string {
  const viewChange = percentChange(input.views, input.previousViews);
  const clickChange = percentChange(input.clicks, input.previousClicks);

  const lines = [
    `vues_cette_semaine: ${input.views}`,
    `vues_semaine_precedente: ${input.previousViews}`,
    viewChange === null
      ? `evolution_vues: non calculable (aucune vue la semaine précédente)`
      : `evolution_vues: ${viewChange > 0 ? "+" : ""}${viewChange}%`,
    `clics_cette_semaine: ${input.clicks}`,
    `clics_semaine_precedente: ${input.previousClicks}`,
    clickChange === null
      ? `evolution_clics: non calculable (aucun clic la semaine précédente)`
      : `evolution_clics: ${clickChange > 0 ? "+" : ""}${clickChange}%`,
    `visiteurs_uniques: ${input.uniqueVisitors}`,
    `taux_de_clic: ${input.ctr}%`,
  ];

  if (input.topSources.length > 0) {
    lines.push(
      `sources_principales: ${input.topSources
        .slice(0, 3)
        .map((s) => `${s.label} (${s.count})`)
        .join(", ")}`,
    );
  }

  if (input.topLinks.length > 0) {
    lines.push(
      `liens_les_plus_cliques: ${input.topLinks
        .slice(0, 3)
        .map((l) => `${l.title} (${l.clicks})`)
        .join(", ")}`,
    );
  }

  return lines.join("\n");
}

const SUMMARY_SYSTEM = `Tu rédiges le résumé hebdomadaire des statistiques d'une page
link-in-bio, pour son créateur.

On te fournit une fiche de chiffres déjà calculés. Ton rôle est uniquement de
les mettre en mots.

Règles :
- N'invente aucun chiffre et n'en calcule aucun. Utilise exclusivement les
  valeurs de la fiche, telles quelles.
- Si une évolution est marquée "non calculable", ne la formule pas en
  pourcentage : dis simplement qu'il n'y a pas de point de comparaison.
- Une à deux phrases, en français, ton factuel et direct.
- Mentionne l'évolution du trafic et, si l'information est présente, sa
  source principale.
- Pas de conseils, pas de superlatifs, pas d'emoji.
- Réponds uniquement par le résumé, sans préambule.`;

/**
 * Asks the model to phrase the week's numbers.
 *
 * Returns null rather than throwing when the engine is not configured — the
 * dashboard shows its figures either way, and the sentence is a garnish.
 */
export async function summarizeWeek(input: WeeklySummaryInput): Promise<WeeklySummary | null> {
  const client = getAnthropic();
  if (!client) return null;

  // Nothing happened; a model call would produce padding, not information.
  if (input.views === 0 && input.clicks === 0) return null;

  const response = await client.messages.create({
    model: SUMMARY_MODEL,
    max_tokens: 512,
    output_config: { effort: SUMMARY_EFFORT },
    system: SUMMARY_SYSTEM,
    messages: [{ role: "user", content: buildFactSheet(input) }],
  });

  const text = response.content
    .filter((block): block is { type: "text"; text: string; citations: null } =>
      block.type === "text",
    )
    .map((block) => block.text)
    .join("")
    .trim();

  if (!text) return null;

  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
