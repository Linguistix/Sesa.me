"use client";

import { useState, useTransition } from "react";
import { applyGeneratedThemeAction, generateThemeAction } from "@/actions/ai";
import type { Theme } from "@/lib/theme/schema";
import type { ContrastFix } from "@/lib/theme/sanitize";
import { Button } from "@/components/ui/Button";

const EXAMPLES = [
  "minimaliste blanc et doré",
  "sombre avec néons violets",
  "papier kraft, chaleureux, artisanal",
  "brutaliste noir et jaune",
  "pastel doux et arrondi",
];

/**
 * The AI design panel.
 *
 * Generation produces a preview; nothing reaches the live page until the user
 * accepts it. The contrast corrections applied after generation are shown
 * rather than hidden — a user who asked for gold on cream deserves to know
 * their gold was darkened, and why.
 */
export function AiDesigner({
  configured,
  initialRemaining,
  isPro,
  onPreview,
}: {
  configured: boolean;
  initialRemaining: number;
  isPro: boolean;
  onPreview: (theme: Theme) => void;
}) {
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fixes, setFixes] = useState<ContrastFix[]>([]);
  const [generated, setGenerated] = useState<Theme | null>(null);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [saved, setSaved] = useState(false);

  function generate() {
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await generateThemeAction(description);

      if (result.error) {
        setError(result.error);
        if (typeof result.remaining === "number") setRemaining(result.remaining);
        return;
      }

      if (result.theme) {
        setGenerated(result.theme);
        setFixes(result.fixes ?? []);
        onPreview(result.theme);
        if (typeof result.remaining === "number") setRemaining(result.remaining);
      }
    });
  }

  function apply() {
    if (!generated) return;
    startTransition(async () => {
      const result = await applyGeneratedThemeAction(generated);
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  if (!configured) {
    return (
      <div className="rounded-xl bg-ink-880 p-4 ring-1 ring-inset ring-white/7">
        <h2 className="text-sm font-semibold text-ink-100">Design par IA</h2>
        <p className="mt-1 text-sm text-ink-400">
          Non configuré sur cette instance. Renseignez <code>ANTHROPIC_API_KEY</code> pour
          activer la génération de thème.
        </p>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="ai-heading"
      className="relative overflow-hidden rounded-xl bg-ink-880 p-4 ring-1 ring-inset ring-accent-400/25"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent-500/12 blur-3xl"
      />

      <div className="relative flex items-baseline justify-between gap-3">
        <h2 id="ai-heading" className="text-sm font-semibold text-ink-50">
          Design par IA
        </h2>
        <span className="text-xs text-ink-500">
          {isPro ? "Illimité" : `${remaining} génération${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"} ce mois-ci`}
        </span>
      </div>

      <p className="relative mt-1 text-sm text-ink-400">
        Décrivez le style que vous voulez ; le thème est généré puis vérifié pour rester lisible.
      </p>

      <label className="relative mt-3 block">
        <span className="sr-only">Décrivez le style voulu</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={400}
          placeholder="minimaliste blanc et doré"
          className="w-full rounded-md bg-ink-900 px-3 py-2 text-base text-ink-50 outline-none ring-1 ring-inset ring-white/10 transition placeholder:text-ink-600 focus:ring-2 focus:ring-accent-500"
        />
      </label>

      <ul className="relative mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((example) => (
          <li key={example}>
            <button
              type="button"
              onClick={() => setDescription(example)}
              className="rounded-full px-2.5 py-1 text-xs text-ink-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/6 hover:text-ink-100 hover:ring-white/20"
            >
              {example}
            </button>
          </li>
        ))}
      </ul>

      <div className="relative mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="primary"
          onClick={generate}
          disabled={pending || description.trim().length < 3}
        >
          {pending ? "Génération…" : generated ? "Régénérer" : "Générer"}
        </Button>

        {generated ? (
          <Button type="button" variant="secondary" onClick={apply} disabled={pending}>
            Appliquer à ma page
          </Button>
        ) : null}

        {saved ? (
          <span role="status" className="text-sm text-positive-400">
            Thème appliqué.
          </span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="relative mt-3 text-sm text-critical-400">
          {error}
        </p>
      ) : null}

      {fixes.length > 0 ? (
        <div
          role="status"
          className="relative mt-3 rounded-md bg-caution-500/10 p-3 text-xs text-caution-400 ring-1 ring-inset ring-caution-400/25"
        >
          <p className="font-medium">
            Contraste ajusté automatiquement pour respecter WCAG AA :
          </p>
          <ul className="mt-1 list-inside list-disc">
            {fixes.map((fix) => (
              <li key={fix.pair}>
                {fix.pair} — {fix.before} → {fix.after} ({fix.ratioBefore}:1 → {fix.ratioAfter}:1)
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
