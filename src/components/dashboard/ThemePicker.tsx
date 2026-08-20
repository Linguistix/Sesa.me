"use client";

import { useState, useTransition } from "react";
import { applyThemeAction } from "@/actions/page";
import { THEME_PRESETS } from "@/lib/theme/presets";
import { ALLOWED_FONTS, type Theme } from "@/lib/theme/schema";
import { auditContrast } from "@/lib/theme/sanitize";
import { PageRenderer, type RenderablePage } from "@/components/public/PageRenderer";
import { PhonePreview } from "./PhonePreview";
import { Field, inputClass } from "./LinkForm";

/**
 * Theme editing with an instant local preview.
 *
 * Every change updates React state first — the preview re-renders from the
 * same component the public page uses, so what you see really is the page —
 * and only the explicit save writes to the database.
 */
export function ThemePicker({
  initialTheme,
  previewPage,
}: {
  initialTheme: Theme;
  previewPage: Omit<RenderablePage, "theme">;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const failures = auditContrast(theme);

  function patch(update: Partial<Theme>) {
    setTheme((current) => ({ ...current, ...update }));
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      await applyThemeAction(theme);
      setSaved(true);
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-8">
        <section aria-labelledby="presets-heading">
          <h2 id="presets-heading" className="mb-3 text-sm font-medium text-neutral-400">
            Thèmes préconçus
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {THEME_PRESETS.map((preset) => (
              <li key={preset.id}>
                <button
                  type="button"
                  onClick={() => {
                    setTheme(preset.theme);
                    setSaved(false);
                  }}
                  className="w-full overflow-hidden rounded-xl border border-white/10 text-left transition hover:border-white/30 focus-visible:border-indigo-400"
                  aria-label={`Appliquer le thème ${preset.name}`}
                >
                  <span
                    className="flex h-16 items-end gap-1 p-2"
                    style={{ background: preset.theme.palette.background }}
                  >
                    <Swatch color={preset.theme.palette.accent} />
                    <Swatch color={preset.theme.palette.surface} />
                    <Swatch color={preset.theme.palette.text_primary} />
                  </span>
                  <span className="block px-3 py-2 text-xs text-neutral-300">{preset.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="colors-heading">
          <h2 id="colors-heading" className="mb-3 text-sm font-medium text-neutral-400">
            Couleurs
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(
              [
                ["background", "Fond"],
                ["surface", "Surface"],
                ["accent", "Accent"],
                ["text_primary", "Texte"],
                ["text_muted", "Texte secondaire"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.palette[key]}
                    onChange={(e) => patch({ palette: { ...theme.palette, [key]: e.target.value } })}
                    className="h-9 w-9 shrink-0 cursor-pointer rounded border border-white/15 bg-transparent"
                    aria-label={label}
                  />
                  <input
                    value={theme.palette[key]}
                    onChange={(e) => patch({ palette: { ...theme.palette, [key]: e.target.value } })}
                    className={inputClass}
                  />
                </div>
              </Field>
            ))}
          </div>

          {failures.length > 0 ? (
            <div
              role="status"
              className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200"
            >
              <p className="font-medium">Contraste insuffisant (WCAG AA) :</p>
              <ul className="mt-1 list-inside list-disc">
                {failures.map((f) => (
                  <li key={f.pair}>
                    {f.pair} — {f.ratio}:1 (minimum {f.required}:1)
                  </li>
                ))}
              </ul>
              <p className="mt-1 opacity-80">
                Ces couleurs seront ajustées automatiquement à l&apos;enregistrement.
              </p>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="type-heading">
          <h2 id="type-heading" className="mb-3 text-sm font-medium text-neutral-400">
            Typographie
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Police des titres">
              <select
                value={theme.typography.display_font}
                onChange={(e) =>
                  patch({
                    typography: { ...theme.typography, display_font: e.target.value as Theme["typography"]["display_font"] },
                  })
                }
                className={inputClass}
              >
                {ALLOWED_FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Police du texte">
              <select
                value={theme.typography.body_font}
                onChange={(e) =>
                  patch({
                    typography: { ...theme.typography, body_font: e.target.value as Theme["typography"]["body_font"] },
                  })
                }
                className={inputClass}
              >
                {ALLOWED_FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Graisse">
              <select
                value={theme.typography.weight}
                onChange={(e) =>
                  patch({
                    typography: { ...theme.typography, weight: e.target.value as Theme["typography"]["weight"] },
                  })
                }
                className={inputClass}
              >
                <option value="light">Fine</option>
                <option value="regular">Normale</option>
                <option value="medium">Moyenne</option>
                <option value="bold">Grasse</option>
              </select>
            </Field>
          </div>
        </section>

        <section aria-labelledby="buttons-heading">
          <h2 id="buttons-heading" className="mb-3 text-sm font-medium text-neutral-400">
            Boutons et mise en page
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Forme">
              <select
                value={theme.button_style.shape}
                onChange={(e) =>
                  patch({
                    button_style: { ...theme.button_style, shape: e.target.value as Theme["button_style"]["shape"] },
                  })
                }
                className={inputClass}
              >
                <option value="rounded">Arrondi</option>
                <option value="pill">Pilule</option>
                <option value="square">Carré</option>
              </select>
            </Field>

            <Field label="Remplissage">
              <select
                value={theme.button_style.fill}
                onChange={(e) =>
                  patch({
                    button_style: { ...theme.button_style, fill: e.target.value as Theme["button_style"]["fill"] },
                  })
                }
                className={inputClass}
              >
                <option value="solid">Plein</option>
                <option value="outline">Contour</option>
                <option value="glass">Verre</option>
              </select>
            </Field>

            <Field label="Disposition">
              <select
                value={theme.layout}
                onChange={(e) => patch({ layout: e.target.value as Theme["layout"] })}
                className={inputClass}
              >
                <option value="centered">Centré</option>
                <option value="left">Aligné à gauche</option>
                <option value="grid">Grille</option>
              </select>
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap gap-4">
            <Toggle
              label="Ombre portée"
              checked={theme.button_style.shadow}
              onChange={(v) => patch({ button_style: { ...theme.button_style, shadow: v } })}
            />
            <Toggle
              label="Bordure"
              checked={theme.button_style.border}
              onChange={(v) => patch({ button_style: { ...theme.button_style, border: v } })}
            />
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {pending ? "Enregistrement…" : "Enregistrer le thème"}
          </button>
          {saved ? (
            <span role="status" className="text-sm text-emerald-400">
              Thème appliqué.
            </span>
          ) : null}
        </div>
      </div>

      <aside className="lg:sticky lg:top-20 lg:h-fit">
        <h2 className="mb-3 text-sm font-medium text-neutral-400">Aperçu en direct</h2>
        <PhonePreview>
          <PageRenderer preview page={{ ...previewPage, theme }} />
        </PhonePreview>
      </aside>
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="h-5 w-5 rounded-full border border-black/20"
      style={{ background: color }}
    />
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-indigo-500"
      />
      {label}
    </label>
  );
}
