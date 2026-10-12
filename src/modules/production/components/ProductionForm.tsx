"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { RotateCcw, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Controller, FormProvider, useForm, useFormContext, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { BodyReadingsFields, useBodyCount } from "@/components/forms/BodyReadingsFields";
import { errorAt } from "@/components/forms/errors";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FormSection } from "@/components/ui/FormSection";
import { MasterPicker } from "@/components/ui/MasterPicker";
import { cn } from "@/lib/utils";
import { MAX_BODIES } from "@/modules/forms/fields";
import { MASTER } from "@/modules/master-data/catalog";
import type { MasterOptions } from "@/modules/master-data/types";
import { AttachmentsField } from "@/modules/samples/components/AttachmentsField";
import type { AttachmentDTO } from "@/modules/samples/queries";
import { nextProductionNumbersAction, saveProductionAction } from "../actions";
import type { ProductionFormPermissions } from "../page-helpers";
import { productionFormSchema, visibleProductionInput, type ProductionFormData, type ProductionFormInput } from "../schema";

const zod = zodResolver(productionFormSchema) as Resolver<ProductionFormInput, unknown, ProductionFormData>;
/** Validate only what the form shows: Body 1 … N. */
const resolver: Resolver<ProductionFormInput, unknown, ProductionFormData> = (values, context, options) =>
  zod(visibleProductionInput(values), context, options);

/**
 * Production Sample data entry:
 *   1 Basic Information (Date, S.No., Slab Number, Design Name, Number of Bodies (N))
 *   2 L, a, b Measurements (Body 1 … N — Post Press and Post Polish, each L, a, b)
 *   3 Sample Output → 4 Remarks → Save
 */
export function ProductionForm({
  mode,
  entryId,
  defaults,
  attachments: initialFiles,
  options,
  permissions,
  maxUploadMb,
}: {
  mode: "create" | "edit";
  entryId?: string;
  defaults: ProductionFormInput;
  attachments: AttachmentDTO[];
  options: MasterOptions;
  permissions: ProductionFormPermissions;
  maxUploadMb: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [files, setFiles] = useState<AttachmentDTO[]>(initialFiles);
  const [baseline, setBaseline] = useState(defaults);
  const [confirm, setConfirm] = useState<null | "reset" | "cancel">(null);

  const methods = useForm<ProductionFormInput, unknown, ProductionFormData>({ resolver, defaultValues: defaults, mode: "onBlur" });
  const { control, register, handleSubmit, getValues, reset, setError, formState } = methods;
  const errors = formState.errors;

  // Warn before leaving with unsaved changes.
  const dirty = formState.isDirty || files.map((f) => f.id).join() !== initialFiles.map((f) => f.id).join();
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const backToRegister = () => router.push("/production-sample#register");

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
          const r = await saveProductionAction(raw, {
            id: entryId,
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
            backToRegister();
            router.refresh();
            return;
          }
          // New entry: clear the form and suggest the next numbers.
          const next = await nextProductionNumbersAction();
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
        {/* 1 · Basic Information */}
        <FormSection index={1} title="Basic Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Field label="Date" htmlFor="ps-date" error={errorAt(errors, "sampleDate")}>
              <input
                id="ps-date"
                type="date"
                readOnly={!permissions.changeDate}
                className={cn("input", !permissions.changeDate && "pointer-events-none bg-mute-bg text-ink-2", errorAt(errors, "sampleDate") && "input-error")}
                {...register("sampleDate")}
              />
            </Field>
            <Field label="S.No." htmlFor="ps-serialNo" error={errorAt(errors, "serialNo")}>
              <NumberBox id="ps-serialNo" name="serialNo" editable={permissions.overrideNumbers} invalid={!!errorAt(errors, "serialNo")} />
            </Field>
            <Field label="Slab Number" htmlFor="ps-slabNumber" error={errorAt(errors, "slabNumber")}>
              <NumberBox id="ps-slabNumber" name="slabNumber" editable={permissions.overrideNumbers} invalid={!!errorAt(errors, "slabNumber")} />
            </Field>
            <Field label="Design Name" htmlFor="ps-designName" error={errorAt(errors, "designName.label") ?? errorAt(errors, "designName")}>
              <Controller
                control={control}
                name="designName"
                render={({ field }) => (
                  <MasterPicker
                    id="ps-designName"
                    options={options[MASTER.DESIGN_NAME]}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    allowCustom={permissions.addMaster}
                    invalid={!!(errorAt(errors, "designName.label") ?? errorAt(errors, "designName"))}
                    noun="design name"
                    placeholder="Select or type design name"
                  />
                )}
              />
            </Field>
            <Field label="Number of Bodies (N)" htmlFor="ps-bodies" error={errorAt(errors, "numberOfBodies")}>
              <input
                id="ps-bodies"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_BODIES}
                className={cn("input tabular-nums", errorAt(errors, "numberOfBodies") && "input-error")}
                {...register("numberOfBodies")}
              />
            </Field>
          </div>
        </FormSection>

        {/* 2 · L, a, b Measurements — Body 1 … N */}
        <MeasurementsSection />

        {/* 3 · Sample Output */}
        <FormSection index={3} title="Sample Output">
          <p className="label">Sample Output Photo / Document</p>
          <AttachmentsField
            files={files}
            onChange={setFiles}
            productionSampleId={entryId}
            canUpload={permissions.upload}
            canRemove={permissions.removeFiles}
            maxMb={maxUploadMb}
          />
        </FormSection>

        {/* 4 · Remarks */}
        <FormSection index={4} title="Remarks">
          <Field label="Remarks" htmlFor="ps-remarks" error={errorAt(errors, "remarks")}>
            <textarea
              id="ps-remarks"
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

/** S.No. / Slab Number — suggested by the system; typed over only by roles allowed to. */
function NumberBox({ id, name, editable, invalid }: { id: string; name: "serialNo" | "slabNumber"; editable: boolean; invalid: boolean }) {
  const { register } = useFormContext<ProductionFormInput>();
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

/** Section 2: one L, a, b block per body, following Number of Bodies (N). */
function MeasurementsSection() {
  const n = useBodyCount("numberOfBodies");
  return (
    <FormSection
      index={2}
      title="L, a, b Measurements"
      description={n > 0 ? `${n} bod${n === 1 ? "y" : "ies"} — Post Press and Post Polish for each` : undefined}
    >
      <BodyReadingsFields n={n} idPrefix="ps" />
    </FormSection>
  );
}
