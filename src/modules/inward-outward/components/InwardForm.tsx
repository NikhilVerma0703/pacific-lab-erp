"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { RotateCcw, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Controller, FormProvider, useForm, useFormContext, useWatch, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { ColourQuantityFields } from "@/components/forms/ColourQuantityFields";
import { DateNumberFields, type DateNumbers } from "@/components/forms/DateNumberFields";
import { errorAt } from "@/components/forms/errors";
import { ReadingRowsFields } from "@/components/forms/ReadingRowsFields";
import { SubPart, VeinTypeFields } from "@/components/forms/VeinTypeFields";
import { ChoiceChips } from "@/components/ui/ChoiceChips";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FormSection } from "@/components/ui/FormSection";
import { MasterPicker } from "@/components/ui/MasterPicker";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/utils";
import { MAX_BODIES } from "@/modules/forms/fields";
import { MASTER } from "@/modules/master-data/catalog";
import type { MasterOptions } from "@/modules/master-data/types";
import { AttachmentsField } from "@/modules/samples/components/AttachmentsField";
import type { AttachmentDTO } from "@/modules/samples/queries";
import { nextInwardNumbersAction, saveInwardAction } from "../actions";
import { DESIGN_TYPES, designType, type DesignTypeKey } from "@/modules/forms/design-types";
import type { InwardFormPermissions } from "../page-helpers";
import { inwardFormSchema, inwardLayout, visibleInwardInput, type InwardFormData, type InwardFormInput } from "../schema";

const zod = zodResolver(inwardFormSchema) as Resolver<InwardFormInput, unknown, InwardFormData>;
/** Validate only what the form shows. */
const resolver: Resolver<InwardFormInput, unknown, InwardFormData> = (values, context, options) => zod(visibleInwardInput(values), context, options);

type Env = { options: MasterOptions; allowCustom: boolean };

/**
 * Sample Inward / Outward data entry:
 *   1 Sample Details → 2 Design Type and Bodies (Plain Body – Yes / No; the
 *   design types with their own fields; Number of Bodies (N) once) →
 *   3 L, a, b Measurements (Body 1 … N, Roy Body 1 … n, Chessboard Body 1 … n)
 *   → Sample Output → Remarks → Save
 */
export function InwardForm({
  mode,
  entryId,
  defaults,
  attachments: initialFiles,
  options,
  numbers: initialNumbers,
  permissions,
  maxUploadMb,
}: {
  mode: "create" | "edit";
  entryId?: string;
  defaults: InwardFormInput;
  attachments: AttachmentDTO[];
  options: MasterOptions;
  permissions: InwardFormPermissions;
  maxUploadMb: number;
  /** S.No. / Slab Number for the date in `defaults` (from the saved records). */
  numbers: DateNumbers;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [files, setFiles] = useState<AttachmentDTO[]>(initialFiles);
  const [baseline, setBaseline] = useState(defaults);
  // S.No. / Slab Number the server suggested for the form's date.
  const [numbers, setNumbers] = useState<DateNumbers>(initialNumbers);
  const [numbersKey, setNumbersKey] = useState(0);
  const [confirm, setConfirm] = useState<null | "reset" | "cancel">(null);
  const env: Env = { options, allowCustom: permissions.addMaster };

  const methods = useForm<InwardFormInput, unknown, InwardFormData>({ resolver, defaultValues: defaults, mode: "onBlur" });
  const { control, register, handleSubmit, getValues, reset, setError, formState } = methods;
  const errors = formState.errors;

  const watched = useWatch({ control, name: ["plainBody", "designTypes", "numberOfBodies", "royBody", "chessboard"] });
  const layout = inwardLayout({ plainBody: watched[0], designTypes: watched[1], numberOfBodies: watched[2], royBody: watched[3], chessboard: watched[4] });

  // Warn before leaving with unsaved changes.
  const dirty = formState.isDirty || files.map((f) => f.id).join() !== initialFiles.map((f) => f.id).join();
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const backToRegister = () => router.push("/inward-outward#register");

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
          // saving at once never collide on a stale one; typed numbers are kept.
          const r = await saveInwardAction(raw, {
            id: entryId,
            autoSerial: mode === "create" && String(raw.serialNo) === String(numbers.serialNo),
            autoSlab: mode === "create" && numbers.slabNumber !== null && String(raw.slabNumber) === String(numbers.slabNumber),
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
            backToRegister();
            router.refresh();
            return;
          }
          // New entry: clear the form and suggest the next numbers.
          const day = String(getValues("entryDate") ?? "");
          const next = await nextInwardNumbersAction(day);
          const fresh = { ...baseline, entryDate: day, serialNo: String(next.serialNo), slabNumber: next.slabNumber === null ? "" : String(next.slabNumber) };
          setBaseline(fresh);
          setNumbers(next);
          setNumbersKey((k) => k + 1);
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
          // Enter in a text box must not save the whole entry by accident.
          const t = e.target as HTMLElement;
          if (e.key === "Enter" && t.tagName === "INPUT") e.preventDefault();
        }}
        noValidate
        className="space-y-4"
      >
        {/* 1 · Sample Details */}
        <FormSection index={next()} title="Sample Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <DateNumberFields
              key={numbersKey}
              idPrefix="io"
              dateName="entryDate"
              mode={mode}
              initial={numbers}
              fetchNumbers={(d) => nextInwardNumbersAction(d, entryId)}
              onNumbers={setNumbers}
              canChangeDate={true}
              canOverride={permissions.overrideNumbers}
            />
            <Field label="Company Name" htmlFor="io-company" error={errorAt(errors, "company.label")}>
              <Controller
                control={control}
                name="company"
                render={({ field }) => (
                  <MasterPicker
                    id="io-company"
                    options={options[MASTER.COMPANY]}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    allowCustom={permissions.addMaster}
                    invalid={!!errorAt(errors, "company.label")}
                    noun="company"
                    placeholder="Select or type company"
                  />
                )}
              />
            </Field>
            <Field label="Design Name" htmlFor="io-designName" error={errorAt(errors, "designName.label")}>
              <Controller
                control={control}
                name="designName"
                render={({ field }) => (
                  <MasterPicker
                    id="io-designName"
                    options={options[MASTER.DESIGN_NAME]}
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
        </FormSection>

        {/* 2 · Design Type and Bodies */}
        <FormSection index={next()} title="Design Type and Bodies">
          <div className="space-y-5">
            <Field label="Plain Body" htmlFor="io-plainBody">
              <Controller
                control={control}
                name="plainBody"
                render={({ field }) => (
                  <Segmented
                    id="io-plainBody"
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
              <Field label="Design Types" htmlFor="io-designTypes" hint="Select every design type on the sample — each opens its own fields below.">
                <Controller
                  control={control}
                  name="designTypes"
                  render={({ field }) => (
                    <ChoiceChips
                      id="io-designTypes"
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
                  htmlFor="io-bodies"
                  error={errorAt(errors, "numberOfBodies")}
                  hint={layout.types.length > 1 ? "Shared by every selected design type." : undefined}
                >
                  <input
                    id="io-bodies"
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

            {layout.types.map((t) => (
              <TypePart key={t} type={t} env={env} />
            ))}
          </div>
        </FormSection>

        {/* 3 · L, a, b Measurements — Body 1 … N once, then the special bodies */}
        {layout.showBodies && (
          <FormSection index={next()} title="L, a, b Measurements" description={measurementsSummary(layout)}>
            <div className="space-y-6">
              <ReadingGroup title="Bodies" hint="Enter Number of Bodies (N) — an L, a, b row for each body appears here." n={layout.n}>
                <ReadingRowsFields name="bodies" n={layout.n} rowLabel="Body" idPrefix="io-body" />
              </ReadingGroup>
              {layout.has("ROY_BODY") && (
                <ReadingGroup title="Roy Bodies" hint="Enter Number of Roy Body (n) in the Roy Body part above." n={layout.royN} tone="accent">
                  <ReadingRowsFields name="royBodies" n={layout.royN} rowLabel="Roy Body" idPrefix="io-roy" />
                </ReadingGroup>
              )}
              {layout.has("CHESSBOARD") && (
                <ReadingGroup title="Chessboard Bodies" hint="Enter Number of Chessboard Body (n) in the Chessboard part above." n={layout.chessN} tone="accent">
                  <ReadingRowsFields name="chessboardBodies" n={layout.chessN} rowLabel="Chessboard Body" idPrefix="io-chess" />
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
            inwardEntryId={entryId}
            canUpload={permissions.upload}
            canRemove={permissions.removeFiles}
            maxMb={maxUploadMb}
          />
        </FormSection>

        {/* Remarks */}
        <FormSection index={next()} title="Remarks">
          <Field label="Remarks" htmlFor="io-remarks" error={errorAt(errors, "remarks")}>
            <textarea
              id="io-remarks"
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
              onClick={() => (dirty ? setConfirm("cancel") : mode === "edit" ? backToRegister() : null)}
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
            backToRegister();
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

function measurementsSummary(l: ReturnType<typeof inwardLayout>): string | undefined {
  const parts: string[] = [];
  if (l.n) parts.push(`${l.n} bod${l.n === 1 ? "y" : "ies"}`);
  if (l.royN) parts.push(`${l.royN} Roy Bod${l.royN === 1 ? "y" : "ies"}`);
  if (l.chessN) parts.push(`${l.chessN} Chessboard Bod${l.chessN === 1 ? "y" : "ies"}`);
  return parts.length ? `${parts.join(" · ")} — one L, a, b reading each` : undefined;
}

function ReadingGroup({ title, hint, n, tone = "brand", children }: { title: string; hint: string; n: number; tone?: "brand" | "accent"; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="flex items-center gap-2 text-[13px] font-bold tracking-wide text-ink-2 uppercase">
        <span className={cn("size-2 rounded-full", tone === "brand" ? "bg-brand" : "bg-accent")} />
        {title}
      </h3>
      {n < 1 ? <p className="rounded-lg border border-dashed border-line-2 bg-mute-bg/40 px-4 py-4 text-[14px] text-ink-2">{hint}</p> : children}
    </section>
  );
}

/** One selected design type's own fields, in its own subsection. */
function TypePart({ type, env }: { type: DesignTypeKey; env: Env }) {
  const { register, formState } = useFormContext<InwardFormInput>();
  const errors = formState.errors;
  const t = designType(type);
  let body: React.ReactNode = null;
  if (type === "ROY_BODY" || type === "CHESSBOARD") {
    const path = type === "ROY_BODY" ? ("royBody.count" as const) : ("chessboard.count" as const);
    body = (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t.special!.countLabel} htmlFor={`io-${type}-n`} error={errorAt(errors, path)} hint={`L, a, b for each ${t.special!.bodyLabel} are in L, a, b Measurements.`}>
          <input
            id={`io-${type}-n`}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_BODIES}
            className={cn("input tabular-nums", errorAt(errors, path) && "input-error")}
            {...register(path)}
          />
        </Field>
      </div>
    );
  } else if (type === "CARRARA") {
    body = (
      <SubPart title="Carrara Colors">
        <ColourQuantityFields name="carrara.colours" idPrefix="io-carrara" label="Carrara Colors Used" options={env.options[MASTER.PIGMENT]} allowCustom={env.allowCustom} />
      </SubPart>
    );
  } else {
    body = (
      <SubPart title={type === "KREOS" ? "Kreos Vein Details" : "Vein Details"}>
        <VeinTypeFields type={type} name={type === "KREOS" ? "kreos" : "vein"} idPrefix={type === "KREOS" ? "io-kreos" : "io-vein"} options={env.options} allowCustom={env.allowCustom} />
      </SubPart>
    );
  }
  return (
    <section aria-label={t.label} className="rounded-xl border border-brand/25 bg-shell">
      <h3 className="rounded-t-xl bg-brand px-4 py-2.5 text-[14px] font-bold tracking-widest text-white uppercase">{t.label}</h3>
      <div className="space-y-4 p-3 sm:p-4">{body}</div>
    </section>
  );
}
