"use client";

import { useState, useTransition } from "react";
import { applyThemeAction } from "@/actions/page";
import { THEME_PRESETS } from "@/lib/theme/presets";
import { ALLOWED_FONTS, type Theme } from "@/lib/theme/schema";
import { auditContrast } from "@/lib/theme/sanitize";
import { PageRenderer, type RenderablePage } from "@/components/public/PageRenderer";
import { PhonePreview } from "./PhonePreview";
import { AiDesigner } from "./AiDesigner";
import { Field, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Panel, SectionHeader } from "@/components/ui/Panel";

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
  ai,
}: {
  initialTheme: Theme;
  previewPage: Omit<RenderablePage, "theme">;
  ai: { configured: boolean; remaining: number; isPro: boolean };
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const failures = auditContrast(theme);
  const dirty = JSON.stringify(theme) !== JSON.stringify(initialTheme);

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
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_auto] xl:gap-12">
      <div className="flex min-w-0 flex-col gap-10">
        <AiDesigner
          configured={ai.configured}
          initialRemaining={ai.remaining}
          isPro={ai.isPro}
          onPreview={(next) => {
            setTheme(next);
            setSaved(false);
          }}
        />

        <section aria-labelledby="presets-heading">
          <SectionHeader
            id="presets-heading"
            title="Thèmes"
            description="Un point de départ. Tout reste ajustable ensuite."
          />

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {THEME_PRESETS.map((preset) => {
              const active = JSON.stringify(preset.theme) === JSON.stringify(theme);
              return (
                <li key={preset.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setTheme(preset.theme);
                      setSaved(false);
                    }}
                    aria-label={`Appliquer le thème ${preset.name}`}
                    aria-pressed={active}
                    className={[
                      "group w-full overflow-hidden rounded-lg text-left transition-all duration-[120ms]",
                      "ring-1 ring-inset",
                      active
                        ? "ring-2 ring-accent-400"
                        : "ring-white/8 hover:ring-white/20",
                    ].join(" ")}
                  >
                    {/*
                      A miniature of the real thing rather than three swatches:
                      a creator picks a theme by how the page looks, and the
                      shape of the buttons is half of that.
                    */}
                    <span
                      className="flex h-24 flex-col items-center justify-center gap-1.5 px-4"
                      style={{
                        background:
                          preset.theme.background_effect.kind === "gradient"
                            ? `linear-gradient(${preset.theme.background_effect.angle}deg, ${preset.theme.palette.background}, ${preset.theme.background_effect.secondary ?? preset.theme.palette.surface})`
                            : preset.theme.palette.background,
                      }}
                    >
                      <span
                        aria-hidden
                        className="h-5 w-5 shrink-0"
                        style={{
                          background: preset.theme.palette.accent,
                          borderRadius:
                            preset.theme.avatar_shape === "square"
                              ? "2px"
                              : preset.theme.avatar_shape === "rounded"
                                ? "6px"
                                : "9999px",
                        }}
                      />
                      <span
                        aria-hidden
                        className="h-1 w-10 rounded-full"
                        style={{ background: preset.theme.palette.text_primary, opacity: 0.8 }}
                      />
                      {[0, 1].map((i) => (
                        <span
                          key={i}
                          aria-hidden
                          className="h-3.5 w-full"
                          style={{
                            background:
                              preset.theme.button_style.fill === "solid"
                                ? preset.theme.palette.accent
                                : preset.theme.palette.surface,
                            border:
                              preset.theme.button_style.fill === "outline"
                                ? `1px solid ${preset.theme.palette.accent}`
                                : "1px solid transparent",
                            borderRadius:
                              preset.theme.button_style.shape === "pill"
                                ? "9999px"
                                : preset.theme.button_style.shape === "square"
                                  ? "0"
                                  : "4px",
                          }}
                        />
                      ))}
                    </span>

                    <span className="flex items-center justify-between gap-2 bg-ink-880 px-3 py-2">
                      <span className="truncate text-xs text-ink-200">{preset.name}</span>
                      {active ? (
                        <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3 shrink-0 text-accent-400">
                          <path d="m2.5 6.5 2.5 2.5 4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="colors-heading">
          <SectionHeader id="colors-heading" title="Couleurs" />

          <Panel inset>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                  {({ id }) => (
                    <div className="flex items-center gap-2">
                      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md ring-1 ring-inset ring-white/12">
                        <input
                          type="color"
                          value={theme.palette[key]}
                          onChange={(e) =>
                            patch({ palette: { ...theme.palette, [key]: e.target.value } })
                          }
                          aria-label={`${label} — sélecteur de couleur`}
                          className="absolute -inset-2 h-[calc(100%+1rem)] w-[calc(100%+1rem)] cursor-pointer border-0 bg-transparent p-0"
                        />
                      </span>
                      <input
                        id={id}
                        value={theme.palette[key]}
                        onChange={(e) =>
                          patch({ palette: { ...theme.palette, [key]: e.target.value } })
                        }
                        spellCheck={false}
                        className="h-9 w-full min-w-0 rounded-md bg-ink-900 px-3 font-mono text-xs uppercase text-ink-100 ring-1 ring-inset ring-white/10 outline-none transition focus:ring-2 focus:ring-accent-500"
                      />
                    </div>
                  )}
                </Field>
              ))}
            </div>

            {failures.length > 0 ? (
              <div
                role="status"
                className="mt-4 rounded-md bg-caution-500/10 p-3 text-xs text-caution-400 ring-1 ring-inset ring-caution-400/25"
              >
                <p className="font-medium">Contraste insuffisant (WCAG AA)</p>
                <ul className="mt-1.5 space-y-0.5">
                  {failures.map((f) => (
                    <li key={f.pair} className="tabular">
                      {f.pair} — {f.ratio}:1 (minimum {f.required}:1)
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 opacity-80">
                  Ces couleurs seront ajustées automatiquement à l&apos;enregistrement.
                </p>
              </div>
            ) : null}
          </Panel>
        </section>

        <section aria-labelledby="type-heading">
          <SectionHeader id="type-heading" title="Typographie" />
          <Panel inset>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Police des titres">
                {({ id }) => (
                  <Select
                    id={id}
                    value={theme.typography.display_font}
                    onChange={(e) =>
                      patch({
                        typography: {
                          ...theme.typography,
                          display_font: e.target.value as Theme["typography"]["display_font"],
                        },
                      })
                    }
                  >
                    {ALLOWED_FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field label="Police du texte">
                {({ id }) => (
                  <Select
                    id={id}
                    value={theme.typography.body_font}
                    onChange={(e) =>
                      patch({
                        typography: {
                          ...theme.typography,
                          body_font: e.target.value as Theme["typography"]["body_font"],
                        },
                      })
                    }
                  >
                    {ALLOWED_FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field label="Graisse">
                {({ id }) => (
                  <Select
                    id={id}
                    value={theme.typography.weight}
                    onChange={(e) =>
                      patch({
                        typography: {
                          ...theme.typography,
                          weight: e.target.value as Theme["typography"]["weight"],
                        },
                      })
                    }
                  >
                    <option value="light">Fine</option>
                    <option value="regular">Normale</option>
                    <option value="medium">Moyenne</option>
                    <option value="bold">Grasse</option>
                  </Select>
                )}
              </Field>
            </div>
          </Panel>
        </section>

        <section aria-labelledby="buttons-heading">
          <SectionHeader id="buttons-heading" title="Boutons et mise en page" />
          <Panel inset>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Forme">
                {({ id }) => (
                  <Select
                    id={id}
                    value={theme.button_style.shape}
                    onChange={(e) =>
                      patch({
                        button_style: {
                          ...theme.button_style,
                          shape: e.target.value as Theme["button_style"]["shape"],
                        },
                      })
                    }
                  >
                    <option value="rounded">Arrondi</option>
                    <option value="pill">Pilule</option>
                    <option value="square">Carré</option>
                  </Select>
                )}
              </Field>

              <Field label="Remplissage">
                {({ id }) => (
                  <Select
                    id={id}
                    value={theme.button_style.fill}
                    onChange={(e) =>
                      patch({
                        button_style: {
                          ...theme.button_style,
                          fill: e.target.value as Theme["button_style"]["fill"],
                        },
                      })
                    }
                  >
                    <option value="solid">Plein</option>
                    <option value="outline">Contour</option>
                    <option value="glass">Verre</option>
                  </Select>
                )}
              </Field>

              <Field label="Disposition">
                {({ id }) => (
                  <Select
                    id={id}
                    value={theme.layout}
                    onChange={(e) => patch({ layout: e.target.value as Theme["layout"] })}
                  >
                    <option value="centered">Centré</option>
                    <option value="left">Aligné à gauche</option>
                    <option value="grid">Grille</option>
                  </Select>
                )}
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap gap-5">
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
          </Panel>
        </section>
      </div>

      <aside className="lg:sticky lg:top-32">
        <PhonePreview label="Aperçu en direct">
          <PageRenderer preview page={{ ...previewPage, theme }} />
        </PhonePreview>

        {/*
          The save control lives with the preview, not at the bottom of a long
          column of settings — that is where the eye is when a change lands.
        */}
        <div className="mt-5 flex flex-col items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={save}
            disabled={pending || !dirty}
            className="w-full"
          >
            {pending ? "Enregistrement…" : dirty ? "Appliquer à ma page" : "À jour"}
          </Button>

          {saved && !dirty ? (
            <span role="status" className="flex items-center gap-1.5 text-xs text-positive-400">
              <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3">
                <path d="m2.5 6.5 2.5 2.5 4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Thème appliqué
            </span>
          ) : dirty ? (
            <span className="text-xs text-ink-500">Modifications non enregistrées</span>
          ) : null}
        </div>
      </aside>
    </div>
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
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded accent-[var(--color-accent-500)]"
      />
      {label}
    </label>
  );
}
