"use client";

import { useState, useTransition } from "react";
import { applyGeneratedThemeAction, generateThemeAction } from "@/actions/ai";
import type { Theme } from "@/lib/theme/schema";
import type { ContrastFix } from "@/lib/theme/sanitize";

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
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h2 className="text-sm font-medium text-neutral-300">Design par IA</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Non configuré sur cette instance. Renseignez <code>ANTHROPIC_API_KEY</code> pour
          activer la génération de thème.
        </p>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="ai-heading"
      className="rounded-xl border border-indigo-500/25 bg-indigo-500/[0.05] p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="ai-heading" className="text-sm font-medium text-neutral-200">
          Design par IA
        </h2>
        <span className="text-xs text-neutral-500">
          {isPro ? "Illimité" : `${remaining} génération${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"} ce mois-ci`}
        </span>
      </div>

      <p className="mt-1 text-sm text-neutral-400">
        Décrivez le style que vous voulez ; le thème est généré puis vérifié pour rester lisible.
      </p>

      <label className="mt-3 block">
        <span className="sr-only">Décrivez le style voulu</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={400}
          placeholder="minimaliste blanc et doré"
          className="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-indigo-400"
        />
      </label>

      <ul className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((example) => (
          <li key={example}>
            <button
              type="button"
              onClick={() => setDescription(example)}
              className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-neutral-400 transition hover:border-white/25 hover:text-neutral-200"
            >
              {example}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={pending || description.trim().length < 3}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {pending ? "Génération…" : generated ? "Régénérer" : "Générer"}
        </button>

        {generated ? (
          <button
            type="button"
            onClick={apply}
            disabled={pending}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-neutral-200 transition hover:bg-white/5 disabled:opacity-50"
          >
            Appliquer à ma page
          </button>
        ) : null}

        {saved ? (
          <span role="status" className="text-sm text-emerald-400">
            Thème appliqué.
          </span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      ) : null}

      {fixes.length > 0 ? (
        <div
          role="status"
          className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-200"
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
