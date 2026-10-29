"use client";

import { useId, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { savePrivacy } from "@/actions/setup";
import {
  PRIVACY_PRESETS,
  VISIBILITY_LABELS,
  matchPreset,
  type PrivacyPreset,
  type PrivacySettings,
} from "@/lib/setup";
import { cn } from "@/lib/utils";

type Visibility = PrivacySettings["profile_visibility"];
const LEVELS = Object.keys(VISIBILITY_LABELS) as Visibility[];

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="grid gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-[13px] text-ink-2">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-5 shrink-0 accent-[var(--brand)]"
      />
    </label>
  );
}

/**
 * Screen 9 (and Settings → Privacy): three presets, with every setting adjustable under
 * "Customise". `onSaved` decides where to go next.
 */
export function PrivacyForm({
  initial,
  submitLabel,
  onSavedHref,
}: {
  initial: PrivacySettings;
  submitLabel: string;
  onSavedHref: string;
}) {
  const id = useId();
  const [settings, setSettings] = useState<PrivacySettings>(initial);
  const preset = matchPreset(settings);
  const [customise, setCustomise] = useState(preset === "custom");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof PrivacySettings>(key: K, value: PrivacySettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    setBusy(true);
    const result = await savePrivacy(settings);
    if (!result.ok) {
      setBusy(false);
      return setError(result.error);
    }
    // Full navigation: finishing setup changes where the middleware sends you.
    window.location.assign(onSavedHref);
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="grid gap-3" role="radiogroup" aria-label="Privacy preset">
        {(
          Object.entries(PRIVACY_PRESETS) as [
            PrivacyPreset,
            (typeof PRIVACY_PRESETS)[PrivacyPreset],
          ][]
        ).map(([name, p]) => {
          const on = preset === name;
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setSettings(p.settings)}
              className={cn(
                "flex items-start gap-3 rounded-lg border-2 bg-surface p-4 text-left transition-colors",
                on ? "border-brand" : "border-line hover:border-ink-2/50",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-pill border-2",
                  on ? "border-brand bg-brand text-brand-ink" : "border-line",
                )}
              >
                {on && <Check className="size-3" />}
              </span>
              <span className="grid gap-0.5">
                <span className="font-bold">
                  {p.label}
                  {name === "open" && (
                    <span className="ml-2 text-xs font-semibold text-brand">
                      Most people pick this
                    </span>
                  )}
                </span>
                <span className="text-sm text-ink-2">{p.description}</span>
              </span>
            </button>
          );
        })}
        {preset === "custom" && (
          <p className="text-sm text-ink-2">You&apos;re using custom settings.</p>
        )}
      </div>

      <button
        type="button"
        aria-expanded={customise}
        onClick={() => setCustomise((c) => !c)}
        className="justify-self-start text-sm font-semibold text-brand"
      >
        {customise ? "Hide details" : "Customise"}
      </button>

      {customise && (
        <div className="grid gap-4 rounded-lg border border-line bg-surface p-4">
          {(
            [
              ["profile_visibility", "Who can see your profile"],
              ["photo_visibility", "Who can see your photo"],
              ["allow_dms_from", "Who can message you"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} id={`${id}-${key}`} label={label}>
              {(aria) => (
                <NativeSelect
                  {...aria}
                  value={settings[key]}
                  onChange={(e) => set(key, e.target.value as Visibility)}
                >
                  {LEVELS.map((v) => (
                    <option key={v} value={v}>
                      {VISIBILITY_LABELS[v]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          ))}
          <Toggle
            label="Show my hometown"
            hint="Helps people from your city find you."
            checked={settings.show_hometown}
            onChange={(v) => set("show_hometown", v)}
          />
          <Toggle
            label="Show me in the batch directory"
            hint="Turn off to be findable only by your handle."
            checked={settings.show_in_directory}
            onChange={(v) => set("show_in_directory", v)}
          />
          <p className="text-[13px] text-ink-2">
            &ldquo;Connections&rdquo; are people you&apos;ve connected with. Connecting arrives in a
            later update; until then that setting means only you.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" block disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
