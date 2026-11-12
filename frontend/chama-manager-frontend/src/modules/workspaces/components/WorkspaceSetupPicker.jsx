import { useEffect } from "react";
import { AlertTriangle, Lock, Info } from "lucide-react";

import Spinner from "@/shared/components/ui/Spinner";
import { useModuleCatalog } from '../hooks/useWorkspaceModules.js';
import {
  dependencyProblems,
  dependentsOf,
  matchPreset,
  withLocked,
  withPrerequisites,
} from '../utils/moduleSelection.js';

/**
 * Workspace Setup - ONE component for the three places a chama's feature set
 * is chosen: the requester's form, the admin's approval screen and the
 * chairperson's Governance Settings (module change request).
 *
 *   1. preset picker       - a starting point, not a lock-in
 *   2. module checklist    - grouped by area, with dependency warnings
 *
 * Props
 *   value      { preset, modules: string[] }   controlled
 *   onChange   (nextValue) => void
 *   baseline   modules the chama has today. When given, rows show
 *              "switching on / off" badges (Governance Settings).
 *   blocked    { [moduleKey]: { reason } } - modules that cannot be switched
 *              off because they still have open data. They stay checked and
 *              explain why. (Governance Settings only; the server re-checks.)
 *   readOnly   render the selection without controls
 *   defaultPreset  preset key to fill in once, when `value.modules` is empty
 *              (a form that starts with no selection yet)
 *   showOrganization  show the family (Chama / SACCO / Cooperative) and type
 *              pickers. Choosing a type loads its preset; value then also
 *              carries organizationFamily + organizationType.
 *   allowRename  show a "Rename features" section; value then also carries
 *              moduleLabels { moduleKey: "Custom name" }.
 *
 * Validity (for disabling a Submit button) is dependencyProblems(catalog,
 * value.modules).length === 0 - see utils/moduleSelection.js.
 */
export default function WorkspaceSetupPicker({
  value,
  onChange,
  baseline = null,
  blocked = {},
  readOnly = false,
  defaultPreset = null,
  showOrganization = false,
  allowRename = false,
}) {
  const { data: catalog, isLoading, isError, refetch } = useModuleCatalog();

  // Fill an empty selection from the default preset exactly once.
  const empty = !value?.modules || value.modules.length === 0;
  useEffect(() => {
    if (!catalog || readOnly || !defaultPreset || !empty) return;
    const preset = catalog.presets.find((p) => p.key === defaultPreset);
    if (preset) onChange?.({ ...value, preset: preset.key, modules: preset.modules });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, defaultPreset, empty, readOnly]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );
  }

  if (isError || !catalog) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
        Couldn&apos;t load the workspace options.{" "}
        <button type="button" onClick={() => refetch()} className="font-bold underline">
          Try again
        </button>
      </div>
    );
  }

  const selected = withLocked(catalog, value?.modules || []);
  const activePreset = value?.preset && value.preset !== "custom" ? value.preset : matchPreset(catalog, selected);
  const problems = dependencyProblems(catalog, selected);
  const labelOf = (key) => catalog.modules.find((m) => m.key === key)?.label || key;

  const emit = (modules, preset, extra = {}) => {
    const next = withLocked(catalog, modules);
    onChange?.({ ...value, preset: preset ?? matchPreset(catalog, next), modules: next, ...extra });
  };

  const families = catalog.organizations || [];
  const family = families.find((f) => f.key === (value?.organizationFamily || "chama")) || families[0];
  const labels = value?.moduleLabels || {};

  // With the organization selector on, only show presets that belong to the
  // chosen family (a SACCO never sees Merry-go-round, a chama never sees
  // Housing SACCO). Without it (e.g. Governance Settings) show everything.
  const familyPresetKeys = new Set([
    ...family?.types.map((t) => t.preset) || [],
    ...(family?.key === "chama" ? ["standard"] : []),
  ]);
  const visiblePresets = showOrganization && family
    ? catalog.presets.filter((p) => familyPresetKeys.has(p.key))
    : catalog.presets;

  const pickFamily = (familyKey) => {
    if (readOnly) return;
    const next = families.find((f) => f.key === familyKey);
    if (next) pickType(next, next.types[0]);
  };

  // Choosing a type loads that type's starting modules; the admin then adds,
  // removes or renames from there.
  const pickType = (familyObj, type) => {
    if (readOnly || !type) return;
    const preset = catalog.presets.find((p) => p.key === type.preset);
    const keepBlocked = Object.keys(blocked).filter((k) => (baseline || []).includes(k));
    emit([...(preset?.modules || []), ...keepBlocked], preset?.key, {
      organizationFamily: familyObj.key,
      organizationType: type.key,
    });
  };

  const setLabel = (key, text) => {
    const next = { ...labels };
    if (text.trim()) next[key] = text; else delete next[key];
    onChange?.({ ...value, moduleLabels: next });
  };

  const pickPreset = (preset) => {
    if (readOnly) return;
    // A preset cannot override a module that is still blocked on: keep those on.
    const keepBlocked = Object.keys(blocked).filter((k) => (baseline || []).includes(k));
    emit([...preset.modules, ...keepBlocked], preset.key);
  };

  const toggle = (key) => {
    if (readOnly) return;
    const isOn = selected.includes(key);
    emit(isOn ? selected.filter((k) => k !== key) : [...selected, key]);
  };

  const fixMissing = (key) => {
    // Turn the missing prerequisites (and theirs) on.
    const need = problems.find((p) => p.key === key)?.missing || [];
    emit([...selected, ...need.flatMap((k) => withPrerequisites(catalog, k))]);
  };

  const dropDependents = (key) => {
    const drop = new Set([key, ...dependentsOf(catalog, key, selected)]);
    emit(selected.filter((k) => !drop.has(k)));
  };

  return (
    <div className="space-y-5">
      {/* 0. Organization family + type */}
      {showOrganization && family && (
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
            Organization type
          </h4>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {families.map((f) => (
              <button
                key={f.key}
                type="button"
                disabled={readOnly}
                aria-pressed={family.key === f.key}
                onClick={() => pickFamily(f.key)}
                className={`rounded-2xl border p-3 text-xs font-bold transition ${
                  family.key === f.key
                    ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 dark:bg-emerald-950/30"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <select
            value={value?.organizationType || family.types[0]?.key}
            disabled={readOnly}
            onChange={(e) => pickType(family, family.types.find((t) => t.key === e.target.value))}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {family.types.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Picking a type loads its default features. You can add, remove or rename any of them below.
          </p>
        </div>
      )}

      {/* 1. Preset picker */}
      <div>
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
          Start from a preset
        </h4>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          A preset only chooses the starting features. Adjust any of them below.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {visiblePresets.map((preset) => {
            const active = activePreset === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                disabled={readOnly}
                onClick={() => pickPreset(preset)}
                aria-pressed={active}
                className={`rounded-2xl border p-3 text-left text-xs transition ${
                  active
                    ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 dark:bg-emerald-950/30"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900"
                } ${readOnly ? "cursor-default" : ""}`}
              >
                <span className="block font-bold text-slate-900 dark:text-white">{preset.label}</span>
                <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                  {preset.modules.length} features
                </span>
              </button>
            );
          })}
        </div>

        {activePreset === "custom" && (
          <p className="mt-2 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
            Custom selection - doesn&apos;t match a preset exactly.
          </p>
        )}
      </div>

      {/* Dependency warnings */}
      {problems.length > 0 && (
        <div
          role="alert"
          className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <p className="flex items-center gap-2 font-bold">
            <AlertTriangle size={14} /> Some features need others to work
          </p>
          <ul className="space-y-1.5">
            {problems.map((problem) => (
              <li key={problem.key} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>{labelOf(problem.key)}</strong> needs {problem.missing.map(labelOf).join(", ")}.
                </span>
                {!readOnly && (
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fixMissing(problem.key)}
                      className="rounded-lg bg-amber-600 px-2.5 py-1 font-bold text-white hover:bg-amber-700"
                    >
                      Turn on {problem.missing.map(labelOf).join(", ")}
                    </button>
                    <button
                      type="button"
                      onClick={() => dropDependents(problem.key)}
                      className="rounded-lg border border-amber-400 px-2.5 py-1 font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40"
                    >
                      Turn off {labelOf(problem.key)}
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 2. Module checklist, grouped by area */}
      <div className="space-y-4">
        {catalog.groups.map((group) => {
          const modules = catalog.modules.filter((m) => m.group === group.key);
          if (modules.length === 0) return null;
          const onCount = modules.filter((m) => selected.includes(m.key)).length;

          return (
            <fieldset key={group.key}>
              <legend className="flex w-full items-center justify-between text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                <span>{group.label}</span>
                <span className="font-semibold normal-case tracking-normal text-slate-400">
                  {onCount} of {modules.length} on
                </span>
              </legend>

              <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {modules.map((module) => {
                  const isOn = selected.includes(module.key);
                  const block = blocked[module.key];
                  const wasOn = baseline ? baseline.includes(module.key) : null;
                  const change = wasOn === null || wasOn === isOn ? null : isOn ? "on" : "off";
                  const lockedOn = module.locked || Boolean(block && isOn);
                  const needs = (module.requires || []).filter((k) => !selected.includes(k));

                  return (
                    <label
                      key={module.key}
                      className={`flex items-start gap-3 p-3 text-xs ${
                        lockedOn || readOnly ? "cursor-default" : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600"
                        checked={isOn}
                        disabled={lockedOn || readOnly}
                        onChange={() => toggle(module.key)}
                      />

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">{module.label}</span>
                          {module.locked && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800">
                              <Lock size={10} /> Always on
                            </span>
                          )}
                          {change && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                change === "on"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                              }`}
                            >
                              Switching {change}
                            </span>
                          )}
                        </span>

                        <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                          {module.description}
                        </span>

                        {allowRename && isOn && !module.locked && (
                          <input
                            value={labels[module.key] || ""}
                            maxLength={60}
                            disabled={readOnly}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setLabel(module.key, e.target.value)}
                            placeholder={`Rename "${module.label}" (optional)`}
                            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        )}

                        {isOn && needs.length > 0 && (
                          <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                            <AlertTriangle size={11} /> Needs {needs.map(labelOf).join(", ")}
                          </span>
                        )}

                        {block && isOn && (
                          <span className="mt-1 flex items-start gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                            <Info size={11} className="mt-px shrink-0" />
                            Can&apos;t be switched off right now: {block.reason}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
