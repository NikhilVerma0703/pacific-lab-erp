"use client";

import { Check, ChevronDown, Plus, Search, Undo2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { MasterOption, MasterRef } from "@/modules/master-data/types";
import { cleanLabel, normalizeKey } from "@/lib/normalize";
import { cn } from "@/lib/utils";

/**
 * Searchable dropdown over a master list, single- or multi-select, with the
 * reusable OTHER mechanism: pick "Other…" (or type something that is not on
 * the list) to enter a new value, and choose whether it joins the list.
 *
 * Typed values are matched case-/space-insensitively against the list first,
 * so "glass " picks the existing "GLASS" instead of creating a twin.
 */
type CommonProps = {
  id?: string;
  options: MasterOption[];
  placeholder?: string;
  allowCustom?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  /** Name of the list, used in prompts ("Add new Resin"). */
  noun?: string;
};

type SingleProps = CommonProps & {
  multiple?: false;
  value: MasterRef | null;
  onChange: (v: MasterRef | null) => void;
};

type MultiProps = CommonProps & {
  multiple: true;
  value: MasterRef[];
  onChange: (v: MasterRef[]) => void;
};

const OTHER = "__other__";
const ADD = "__add__";

export function MasterPicker(props: SingleProps | MultiProps) {
  const { options, placeholder = "Select…", allowCustom = true, invalid, disabled, noun = "value" } = props;
  const autoId = useId();
  const inputId = props.id ?? autoId;
  const listId = `${inputId}-list`;

  const selected: MasterRef[] = props.multiple ? props.value : props.value ? [props.value] : [];

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // Single-select: OTHER switches the control into a text box.
  const singleCustom = !props.multiple && !!props.value && !props.value.id;
  const [customDraft, setCustomDraft] = useState<string | null>(null); // multi: OTHER text box

  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on outside click/tap.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setQuery("");
  }, [open]);

  const isSelected = (o: MasterOption) => selected.some((s) => s.id === o.id);

  const filtered = useMemo(() => {
    const q = normalizeKey(query);
    const list = options.filter((o) => o.isActive || isSelected(o));
    return q ? list.filter((o) => normalizeKey(o.label).includes(q)) : list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, query, props.value]);

  const exact = query.trim()
    ? options.find((o) => normalizeKey(o.label) === normalizeKey(query))
    : undefined;

  type Row = { key: string; label: React.ReactNode; option?: MasterOption };
  const rows: Row[] = filtered.map((o) => ({ key: o.id, label: o.label, option: o }));
  if (allowCustom && query.trim() && !exact) {
    rows.push({ key: ADD, label: <>Add “{cleanLabel(query)}”</> });
  }
  if (allowCustom && !query.trim()) rows.push({ key: OTHER, label: "Other (type a new value)…" });

  useEffect(() => setActive(0), [query, open]);

  /** Resolve a typed label to an existing option when one matches. */
  function refFromText(text: string): MasterRef | null {
    const label = cleanLabel(text);
    if (!label) return null;
    const match = options.find((o) => normalizeKey(o.label) === normalizeKey(label));
    return match ? { id: match.id, label: match.label } : { label, save: true };
  }

  function emit(next: MasterRef[]) {
    if (props.multiple) props.onChange(next);
    else props.onChange(next[0] ?? null);
  }

  function addRef(ref: MasterRef) {
    if (props.multiple) {
      const dup = props.value.some((v) =>
        ref.id ? v.id === ref.id : normalizeKey(v.label) === normalizeKey(ref.label),
      );
      if (!dup) props.onChange([...props.value, ref]);
    } else {
      props.onChange(ref);
    }
  }

  function choose(row: Row) {
    if (row.key === OTHER) {
      setOpen(false);
      if (props.multiple) setCustomDraft("");
      else props.onChange({ label: "", save: true });
      return;
    }
    if (row.key === ADD) {
      const ref = refFromText(query);
      if (ref) addRef(ref);
      setQuery("");
      if (!props.multiple) setOpen(false);
      return;
    }
    const o = row.option!;
    if (props.multiple) {
      if (isSelected(o)) props.onChange(props.value.filter((v) => v.id !== o.id));
      else props.onChange([...props.value, { id: o.id, label: o.label }]);
      setQuery("");
    } else {
      props.onChange({ id: o.id, label: o.label });
      setOpen(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rows[active]) choose(rows[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  // ── Single-select in OTHER mode: a plain text box ───────────────────────────
  if (!props.multiple && singleCustom) {
    const v = props.value!;
    return (
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <input
            id={inputId}
            className={cn("input", invalid && "input-error")}
            placeholder={`Type new ${noun}`}
            value={v.label}
            autoFocus={v.label === ""}
            disabled={disabled}
            maxLength={80}
            onChange={(e) => props.onChange({ ...v, label: e.target.value })}
            onBlur={(e) => {
              // Snap to an existing value if the typed text already exists.
              const ref = refFromText(e.target.value);
              if (ref?.id) props.onChange(ref);
            }}
          />
          <button
            type="button"
            className="btn-secondary shrink-0 px-3"
            onClick={() => props.onChange(null)}
            title="Back to the list"
            aria-label="Back to the list"
            disabled={disabled}
          >
            <Undo2 className="size-4" />
          </button>
        </div>
        <SaveToggle checked={v.save !== false} onChange={(save) => props.onChange({ ...v, save })} />
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={cn(
          "input flex cursor-pointer flex-wrap items-center gap-1.5 py-1.5 pr-9",
          invalid && "input-error",
          disabled && "pointer-events-none bg-mute-bg",
        )}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        {props.multiple ? (
          selected.length ? (
            selected.map((s, i) => (
              <span
                key={s.id ?? `new-${i}`}
                className={cn(
                  "inline-flex max-w-full items-center gap-1 rounded-md py-1 pr-1 pl-2 text-[13px] font-medium",
                  s.id ? "bg-info-bg text-info-fg" : "bg-warn-bg text-warn-fg",
                )}
              >
                <span className="truncate">{s.label}</span>
                {!s.id && <span className="text-[10px] font-bold uppercase">new</span>}
                <button
                  type="button"
                  aria-label={`Remove ${s.label}`}
                  className="inline-flex size-6 items-center justify-center rounded hover:bg-black/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    emit(selected.filter((_, j) => j !== i));
                  }}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))
          ) : (
            <span className="py-1 text-ink-3">{placeholder}</span>
          )
        ) : (
          <span className={cn("truncate py-1", !selected[0] && "text-ink-3")}>
            {selected[0]?.label ?? placeholder}
          </span>
        )}
        <button
          type="button"
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          aria-label={placeholder}
          disabled={disabled}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              setOpen(true);
            }
          }}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink-3"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>

      {!props.multiple && selected[0] && !disabled && (
        <button
          type="button"
          aria-label="Clear"
          className="absolute top-1/2 right-8 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded text-ink-3 hover:bg-mute-bg"
          onClick={() => props.onChange(null)}
        >
          <X className="size-4" />
        </button>
      )}

      {open && (
        <div className="absolute z-40 mt-1 w-full min-w-[220px] overflow-hidden rounded-lg border border-line-2 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search className="size-4 shrink-0 text-ink-3" />
            <input
              ref={searchRef}
              className="h-11 w-full bg-transparent text-[15px] outline-none"
              placeholder={allowCustom ? `Search or type a new ${noun}` : "Search…"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              aria-controls={listId}
              aria-activedescendant={rows[active] ? `${listId}-${active}` : undefined}
            />
          </div>
          <ul id={listId} role="listbox" aria-multiselectable={props.multiple} className="max-h-64 overflow-y-auto py-1">
            {rows.length === 0 && <li className="px-3 py-3 text-sm text-ink-3">No matches.</li>}
            {rows.map((row, i) => {
              const sel = row.option ? isSelected(row.option) : false;
              const special = row.key === OTHER || row.key === ADD;
              return (
                <li
                  key={row.key}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={sel}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => choose(row)}
                  onMouseMove={() => setActive(i)}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 px-3 text-[15px]",
                    i === active && "bg-info-bg",
                    special && "border-t border-line font-semibold text-accent",
                  )}
                >
                  {special ? (
                    <Plus className="size-4 shrink-0" />
                  ) : (
                    <Check className={cn("size-4 shrink-0", sel ? "text-brand" : "invisible")} />
                  )}
                  <span className="truncate">{row.label}</span>
                  {row.option && !row.option.isActive && (
                    <span className="badge ml-auto bg-mute-bg text-mute-fg">disabled</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {props.multiple && customDraft !== null && (
        <div className="mt-2 flex gap-2">
          <input
            className="input"
            autoFocus
            maxLength={80}
            placeholder={`Type new ${noun}`}
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const ref = refFromText(customDraft);
                if (ref) addRef(ref);
                setCustomDraft(null);
              } else if (e.key === "Escape") setCustomDraft(null);
            }}
          />
          <button
            type="button"
            className="btn-secondary shrink-0"
            onClick={() => {
              const ref = refFromText(customDraft);
              if (ref) addRef(ref);
              setCustomDraft(null);
            }}
          >
            Add
          </button>
          <button type="button" className="btn-ghost shrink-0 px-3" aria-label="Cancel" onClick={() => setCustomDraft(null)}>
            <X className="size-4" />
          </button>
        </div>
      )}

      {props.multiple && props.value.some((v) => !v.id) && (
        <div className="mt-1.5 space-y-1">
          {props.value.map((v, i) =>
            v.id ? null : (
              <SaveToggle
                key={`save-${i}`}
                label={<>Save “{v.label}” to the list for future use</>}
                checked={v.save !== false}
                onChange={(save) =>
                  props.onChange(props.value.map((x, j) => (j === i ? { ...x, save } : x)))
                }
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function SaveToggle({
  checked,
  onChange,
  label = "Save to the list for future use",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
}) {
  return (
    <label className="flex min-h-8 cursor-pointer items-center gap-2 text-[13px] text-ink-2">
      <input
        type="checkbox"
        className="size-4 accent-[var(--color-accent)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
