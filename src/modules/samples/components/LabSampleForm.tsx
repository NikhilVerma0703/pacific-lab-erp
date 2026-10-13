"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { History, RotateCcw, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Controller, FormProvider, useForm, useFormContext, useWatch, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { ColourQuantityFields } from "@/components/forms/ColourQuantityFields";
import { errorAt } from "@/components/forms/errors";
import { MaterialBodiesFields } from "@/components/forms/MaterialDetailsFields";
import { StageRowsFields } from "@/components/forms/StageRowsFields";
import { VeinTypeFields } from "@/components/forms/VeinTypeFields";
import { ChoiceChips } from "@/components/ui/ChoiceChips";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FormSection } from "@/components/ui/FormSection";
import { MasterPicker } from "@/components/ui/MasterPicker";
import { Segmented } from "@/components/ui/Segmented";
import { cn, formatDate } from "@/lib/utils";
import type { DesignLayout } from "@/modules/forms/design";
import { DESIGN_TYPES, type DesignTypeKey } from "@/modules/forms/design-types";
import { MAX_BODIES } from "@/modules/forms/fields";
import { MASTER } from "@/modules/master-data/catalog";
import type { MasterOption, MasterOptions, MasterRef } from "@/modules/master-data/types";
import { inwardDesignSuggestionsAction, nextLabNumbersAction, saveLabSampleAction } from "../actions";
import { postPolishRows, type DesignSuggestion } from "../design-suggestion";
import type { LabFormPermissions } from "../page-helpers";
import type { AttachmentDTO } from "../queries";
import { labFormSchema, labLayout, visibleLabInput, type LabFormData, type LabFormInput } from "../schema";
import { AttachmentsField } from "./AttachmentsField";

const zod = zodResolver(labFormSchema) as Resolver<LabFormInput, unknown, LabFormData>;
/** Validate only what the form shows. */
const resolver: Resolver<LabFormInput, unknown, LabFormData> = (values, context, options) => zod(visibleLabInput(values), context, options);

type Env = { options: MasterOptions; allowCustom: boolean };

/** Titles of the design types' own sections. */
const TYPE_SECTION: Record<DesignTypeKey, string> = {
  ROY_BODY: "Roy Body Details",
  KREOS: "Kreos Vein Details",
  CARRARA: "Carrara Details",
  VEIN: "Vein Details",
  CHESSBOARD: "Chessboard Details",
};

/**
 * Lab Sample data entry:
 *   Basic Information → Design Type and Number of Bodies (Plain Body – Yes /
 *   No; the design types; N once) → Material Details (Body 1 … N) → one
 *   section per selected design type (Roy Body Details with Roy Body 1 … n,
 *   Kreos Vein Details, Carrara Details, Vein Details, Chessboard Details with
 *   Chessboard Body 1 … n) → L, a, b Measurements (Post Press / Post Polish per
 *   body) → Sample Output → Remarks → Save
 */
export function LabSampleForm({
  mode,
  sampleId,
  defaults,
  attachments: initialFiles,
  options,
  designNameOptions,
  permissions,
  maxUploadMb,
}: {
  mode: "create" | "edit";
  sampleId?: string;
  defaults: LabFormInput;
  attachments: AttachmentDTO[];
  options: MasterOptions;
  /** Design Names saved in the Sample Inward / Outward Database. */
  designNameOptions: MasterOption[];
  permissions: LabFormPermissions;
  maxUploadMb: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [files, setFiles] = useState<AttachmentDTO[]>(initialFiles);
  const [baseline, setBaseline] = useState(defaults);
  const [confirm, setConfirm] = useState<null | "reset" | "cancel">(null);
  const env: Env = { options, allowCustom: permissions.addMaster };

  const methods = useForm<LabFormInput, unknown, LabFormData>({ resolver, defaultValues: defaults, mode: "onBlur" });
  const { control, register, handleSubmit, getValues, setValue, reset, setError, formState } = methods;
  const errors = formState.errors;

  const watched = useWatch({ control, name: ["plainBody", "designTypes", "numberOfBodies", "royBody.count", "chessboard.count"] });
  const layout = labLayout({
    plainBody: watched[0],
    designTypes: watched[1],
    numberOfBodies: watched[2],
    royBody: { count: watched[3] },
    chessboard: { count: watched[4] },
  });

  // Warn before leaving with unsaved changes.
  const dirty = formState.isDirty || files.map((f) => f.id).join() !== initialFiles.map((f) => f.id).join();
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const backToList = () => router.push("/samples#recent");

  function scrollToError() {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".input-error, [role=alert]")?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  function submit() {
    handleSubmit(
      () => {
        const raw = { ...getValues(), attachmentIds: files.map((f) => f.id) };
        start(async () => {
          // Untouched suggestions are re-allocated by the server, so two people
          // saving at once never collide on a stale suggestion.
          const r = await saveLabSampleAction(raw, {
            id: sampleId,
            autoSerial: mode === "create" && raw.serialNo === baseline.serialNo,
            autoSlab: mode === "create" && raw.slabNumber === baseline.slabNumber,
          });
          if (!r.ok) {
            toast.error(r.error);
            const entries = Object.entries(r.fieldErrors ?? {});
            entries.forEach(([path, message]) => setError(path as Parameters<typeof setError>[0], { type: "server", message }));
            if (entries.length) scrollToError();
            return;
          }
          toast.success(r.message ?? "Saved.");
          if (mode === "edit") {
            backToList();
            router.refresh();
            return;
          }
          // New sample: clear the form and suggest the next numbers.
          const next = await nextLabNumbersAction();
          const fresh = { ...baseline, serialNo: String(next.serialNo), slabNumber: String(next.slabNumber), sampleDate: getValues("sampleDate") };
          setBaseline(fresh);
          reset(fresh);
          setFiles([]);
          router.refresh();
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      },
      () => {
        toast.error("Some values need fixing — see the highlighted fields.");
        scrollToError();
      },
    )();
  }

  let section = 0;
  const next = () => ++section;

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onKeyDown={(e) => {
          // Enter in a text box must not save the whole sample by accident.
          const t = e.target as HTMLElement;
          if (e.key === "Enter" && t.tagName === "INPUT") e.preventDefault();
        }}
        noValidate
        className="space-y-4"
      >
        {/* Basic Information */}
        <FormSection index={next()} title="Basic Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Date" htmlFor="lab-date" error={errorAt(errors, "sampleDate")}>
              <input
                id="lab-date"
                type="date"
                readOnly={!permissions.changeDate}
                className={cn("input", !permissions.changeDate && "pointer-events-none bg-mute-bg text-ink-2", errorAt(errors, "sampleDate") && "input-error")}
                {...register("sampleDate")}
              />
            </Field>
            <Field label="S.No." htmlFor="lab-serialNo" error={errorAt(errors, "serialNo")}>
              <NumberBox id="lab-serialNo" name="serialNo" editable={permissions.overrideNumbers} invalid={!!errorAt(errors, "serialNo")} />
            </Field>
            <Field label="Slab Number" htmlFor="lab-slabNumber" error={errorAt(errors, "slabNumber")}>
              <NumberBox id="lab-slabNumber" name="slabNumber" editable={permissions.overrideNumbers} invalid={!!errorAt(errors, "slabNumber")} />
            </Field>
            <Field label="Design Name" htmlFor="lab-designName" error={errorAt(errors, "designName.label")}>
              <Controller
                control={control}
                name="designName"
                render={({ field }) => (
                  <MasterPicker
                    id="lab-designName"
                    options={designNameOptions}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    allowCustom={permissions.addMaster}
                    invalid={!!errorAt(errors, "designName.label")}
                    noun="design name"
                    placeholder="Select or type design name"
                  />
                )}
              />
            </Field>
          </div>
          <InwardSuggestions
            onUse={(sg) => {
              const before = getValues();
              const opts = { shouldDirty: true } as const;
              setValue("plainBody", sg.plainBody === null ? "" : sg.plainBody ? "YES" : "NO", opts);
              setValue("designTypes", sg.designTypes, opts);
              setValue("numberOfBodies", sg.numberOfBodies ? String(sg.numberOfBodies) : "", opts);
              if (sg.royCount) setValue("royBody.count", String(sg.royCount), opts);
              if (sg.chessCount) setValue("chessboard.count", String(sg.chessCount), opts);
              // Inward / Outward readings → Post Polish; Post Press stays empty.
              setValue("readings", postPolishRows(sg.readings, sg.numberOfBodies), opts);
              setValue("royReadings", postPolishRows(sg.royReadings, sg.royCount), opts);
              setValue("chessboardReadings", postPolishRows(sg.chessboardReadings, sg.chessCount), opts);
              toast.success(`Filled from Inward / Outward S.No. ${sg.source.serialNo} — ${sg.designName} – ${sg.design}. Check and edit as needed.`, {
                action: { label: "Undo", onClick: () => reset(before, { keepDefaultValues: true }) },
              });
            }}
          />
        </FormSection>

        {/* Design Type and Number of Bodies */}
        <FormSection index={next()} title="Design Type and Number of Bodies">
          <div className="space-y-5">
            <Field label="Plain Body" htmlFor="lab-plainBody">
              <Controller
                control={control}
                name="plainBody"
                render={({ field }) => (
                  <Segmented
                    id="lab-plainBody"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    options={[
                      { value: "YES", label: "Plain Body – Yes" },
                      { value: "NO", label: "Plain Body – No" },
                    ]}
                  />
                )}
              />
            </Field>

            {watched[0] === "NO" && (
              <Field label="Design Types" htmlFor="lab-designTypes" hint="Select every design type of the sample — each opens its own section below.">
                <Controller
                  control={control}
                  name="designTypes"
                  render={({ field }) => (
                    <ChoiceChips
                      id="lab-designTypes"
                      options={DESIGN_TYPES.map((t) => ({ value: t.key, label: t.label }))}
                      value={field.value ?? []}
                      onChange={field.onChange}
                    />
                  )}
                />
              </Field>
            )}

            {layout.showBodies && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="Number of Bodies (N)"
                  htmlFor="lab-bodies"
                  error={errorAt(errors, "numberOfBodies")}
                  hint={layout.types.length > 1 ? "Shared by every selected design type." : undefined}
                >
                  <input
                    id="lab-bodies"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_BODIES}
                    className={cn("input tabular-nums", errorAt(errors, "numberOfBodies") && "input-error")}
                    {...register("numberOfBodies")}
                  />
                </Field>
              </div>
            )}
          </div>
        </FormSection>

        {/* Material Details of Body 1 … N */}
        {layout.showBodies && (
          <FormSection index={next()} title="Material Details" description={layout.n ? `${layout.n} bod${layout.n === 1 ? "y" : "ies"} — Material Choices and Pigments / Additives for each` : undefined}>
            {layout.n < 1 ? (
              <Hint>Enter Number of Bodies (N) — a Material Details section for each body appears here.</Hint>
            ) : (
              <MaterialBodiesFields name="materials" n={layout.n} bodyLabel="Body" idPrefix="lab-mat" env={env} />
            )}
          </FormSection>
        )}

        {/* One section per selected design type */}
        {layout.types.map((t) => (
          <FormSection key={t} index={next()} title={TYPE_SECTION[t]}>
            <TypeFields type={t} layout={layout} env={env} />
          </FormSection>
        ))}

        {/* L, a, b Measurements — Body 1 … N once, then the special bodies */}
        {layout.showBodies && (
          <FormSection index={next()} title="L, a, b Measurements" description={measurementsSummary(layout)}>
            <div className="space-y-6">
              <ReadingGroup title="Bodies" hint="Enter Number of Bodies (N) — a row for each body appears here." n={layout.n}>
                <StageRowsFields name="readings" n={layout.n} rowLabel="Body" idPrefix="lab-body" />
              </ReadingGroup>
              {layout.has("ROY_BODY") && (
                <ReadingGroup title="Roy Bodies" hint="Enter Number of Roy Body (n) in Roy Body Details." n={layout.royN} tone="accent">
                  <StageRowsFields name="royReadings" n={layout.royN} rowLabel="Roy Body" idPrefix="lab-roylab" />
                </ReadingGroup>
              )}
              {layout.has("CHESSBOARD") && (
                <ReadingGroup title="Chessboard Bodies" hint="Enter Number of Chessboard Body (n) in Chessboard Details." n={layout.chessN} tone="accent">
                  <StageRowsFields name="chessboardReadings" n={layout.chessN} rowLabel="Chessboard Body" idPrefix="lab-chesslab" />
                </ReadingGroup>
              )}
            </div>
          </FormSection>
        )}

        {/* Sample Output */}
        <FormSection index={next()} title="Sample Output">
          <p className="label">Sample Output Photo / Document</p>
          <AttachmentsField
            files={files}
            onChange={setFiles}
            sampleId={sampleId}
            canUpload={permissions.upload}
            canRemove={permissions.removeFiles}
            maxMb={maxUploadMb}
          />
        </FormSection>

        {/* Remarks */}
        <FormSection index={next()} title="Remarks">
          <Field label="Remarks" htmlFor="lab-remarks" error={errorAt(errors, "remarks")}>
            <textarea
              id="lab-remarks"
              rows={4}
              className={cn("input", errorAt(errors, "remarks") && "input-error")}
              placeholder="Observations or notes on this sample"
              {...register("remarks")}
            />
          </Field>
        </FormSection>

        {/* Save */}
        <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-xl lg:border">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-ghost"
              disabled={pending}
              onClick={() => (dirty ? setConfirm("cancel") : mode === "edit" ? backToList() : null)}
            >
              <X className="size-4" /> Cancel
            </button>
            {mode === "create" && (
              <button type="button" className="btn-ghost" disabled={pending || !dirty} onClick={() => setConfirm("reset")}>
                <RotateCcw className="size-4" /> Reset
              </button>
            )}
            <span className="flex-1" />
            <button type="submit" className="btn-primary" disabled={pending}>
              <Save className="size-4" /> {pending ? "Saving…" : mode === "edit" ? "Save Changes" : "Save"}
            </button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "reset" ? "Clear the form?" : "Discard changes?"}
        message={confirm === "reset" ? "Everything typed in this form will be cleared." : "Your unsaved changes will be lost."}
        confirmLabel={confirm === "reset" ? "Clear form" : "Discard"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const which = confirm;
          setConfirm(null);
          if (mode === "edit") {
            backToList();
            return;
          }
          reset(baseline);
          setFiles([]);
          if (which === "cancel") window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </FormProvider>
  );
}

/** A selected design type's own section. */
function TypeFields({ type, layout, env }: { type: DesignTypeKey; layout: DesignLayout; env: Env }) {
  const { register, formState } = useFormContext<LabFormInput>();
  const errors = formState.errors;

  if (type === "ROY_BODY" || type === "CHESSBOARD") {
    const roy = type === "ROY_BODY";
    const path = roy ? ("royBody.count" as const) : ("chessboard.count" as const);
    const t = DESIGN_TYPES.find((x) => x.key === type)!;
    const n = roy ? layout.royN : layout.chessN;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t.special!.countLabel} htmlFor={`lab-${type}-n`} error={errorAt(errors, path)}>
            <input
              id={`lab-${type}-n`}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_BODIES}
              className={cn("input tabular-nums", errorAt(errors, path) && "input-error")}
              {...register(path)}
            />
          </Field>
        </div>
        {n < 1 ? (
          <Hint>Enter {t.special!.countLabel} — a Material Details section for each {t.special!.bodyLabel} appears here.</Hint>
        ) : (
          <MaterialBodiesFields
            name={roy ? "royBody.materials" : "chessboard.materials"}
            n={n}
            bodyLabel={t.special!.bodyLabel}
            idPrefix={roy ? "lab-roy" : "lab-chess"}
            env={env}
          />
        )}
      </div>
    );
  }
  if (type === "CARRARA") {
    return (
      <ColourQuantityFields name="carrara.colours" idPrefix="lab-carrara" label="Carrara Colors Used" options={env.options[MASTER.PIGMENT]} allowCustom={env.allowCustom} />
    );
  }
  return (
    <VeinTypeFields
      type={type}
      name={type === "KREOS" ? "kreos" : "vein"}
      idPrefix={type === "KREOS" ? "lab-kreos" : "lab-vein"}
      options={env.options}
      allowCustom={env.allowCustom}
    />
  );
}

function measurementsSummary(l: DesignLayout): string | undefined {
  const parts: string[] = [];
  if (l.n) parts.push(`${l.n} bod${l.n === 1 ? "y" : "ies"}`);
  if (l.royN) parts.push(`${l.royN} Roy Bod${l.royN === 1 ? "y" : "ies"}`);
  if (l.chessN) parts.push(`${l.chessN} Chessboard Bod${l.chessN === 1 ? "y" : "ies"}`);
  return parts.length ? `${parts.join(" · ")} — Post Press and Post Polish L, a, b for each` : undefined;
}

/** S.No. / Slab Number — suggested by the system; typed over only by roles allowed to. */
function NumberBox({ id, name, editable, invalid }: { id: string; name: "serialNo" | "slabNumber"; editable: boolean; invalid: boolean }) {
  const { register } = useFormContext<LabFormInput>();
  return (
    <input
      id={id}
      inputMode="numeric"
      readOnly={!editable}
      className={cn("input tabular-nums", !editable && "bg-mute-bg text-ink-2", invalid && "input-error")}
      {...register(name)}
    />
  );
}

function ReadingGroup({ title, hint, n, tone = "brand", children }: { title: string; hint: string; n: number; tone?: "brand" | "accent"; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="flex items-center gap-2 text-[13px] font-bold tracking-wide text-ink-2 uppercase">
        <span className={cn("size-2 rounded-full", tone === "brand" ? "bg-brand" : "bg-accent")} />
        {title}
      </h3>
      {n < 1 ? <Hint>{hint}</Hint> : children}
    </section>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line-2 bg-mute-bg/40 px-4 py-4 text-[14px] text-ink-2">{children}</p>;
}

/**
 * Beside Design Name: the designs saved for that name in the Sample Inward /
 * Outward Database ("A – Plain Body", "A – Roy Body + Carrara" …). Using one
 * fills Design Type, Number of Bodies (N), n and the readings as Post Polish
 * L, a, b — all still editable. Read-only for the inward records.
 */
function InwardSuggestions({ onUse }: { onUse: (s: DesignSuggestion) => void }) {
  const { control } = useFormContext<LabFormInput>();
  const name = useWatch({ control, name: "designName" }) as MasterRef | null | undefined;
  const label = name?.label?.trim() ?? "";
  const lookup = name?.id ?? label.toLowerCase();
  const [state, setState] = useState<{ key: string; list: DesignSuggestion[] } | null>(null);

  useEffect(() => {
    if (!lookup) return;
    let alive = true;
    const t = setTimeout(async () => {
      const list = await inwardDesignSuggestionsAction(name ? { id: name.id, label } : null);
      if (alive) setState({ key: lookup, list });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookup]);

  if (!lookup || state?.key !== lookup) return null;
  return (
    <section aria-label="Existing physical samples" className="mt-4 rounded-lg border border-accent/40 bg-accent-bg/40 p-3 sm:p-4">
      <h3 className="flex items-center gap-2 text-[13px] font-bold">
        <History className="size-4 text-accent" aria-hidden="true" /> Existing physical samples — Sample Inward / Outward
      </h3>
      {state.list.length === 0 ? (
        <p className="mt-1 text-[13px] text-ink-2">No Inward / Outward entry has this Design Name — fill in the form below.</p>
      ) : (
        <>
          <p className="mt-0.5 text-[12px] text-ink-2">Use one to fill Design Type, Number of Bodies and the Post Polish L, a, b from that entry. Everything stays editable.</p>
          <ul className="mt-2 grid gap-2 lg:grid-cols-2">
            {state.list.map((sg) => (
              <li key={sg.key} className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">
                    {sg.designName} – {sg.design}
                  </p>
                  <p className="text-[12px] text-ink-2">
                    N = {sg.numberOfBodies ?? "—"}
                    {sg.royCount ? ` · Roy Bodies ${sg.royCount}` : ""}
                    {sg.chessCount ? ` · Chessboard Bodies ${sg.chessCount}` : ""} · S.No. {sg.source.serialNo} · {formatDate(sg.source.entryDate)}
                    {sg.records > 1 ? ` (latest of ${sg.records})` : ""}
                  </p>
                </div>
                <button type="button" className="btn-secondary btn-sm shrink-0" onClick={() => onUse(sg)} aria-label={`Use ${sg.designName} – ${sg.design}`}>
                  Use
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
