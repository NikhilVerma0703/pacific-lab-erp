"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { RotateCcw, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { DesignFields } from "@/components/lab/DesignFields";
import { errorAt, SampleFormContext } from "@/components/lab/form-context";
import { useBodyRows } from "@/components/lab/LabRowsFields";
import { RoyBodyLabFields } from "@/components/lab/RoyBodyLabFields";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FormSection } from "@/components/ui/FormSection";
import { cn } from "@/lib/utils";
import type { MasterOptions } from "@/modules/master-data/types";
import { AttachmentsField } from "@/modules/samples/components/AttachmentsField";
import { BodyLabFields, BodyPart, BodySections } from "@/components/lab/BodySections";
import type { AttachmentDTO } from "@/modules/samples/queries";
import { MAX_BODIES } from "@/modules/samples/schema";
import { nextProductionNumbersAction, saveProductionAction } from "../actions";
import { emptyProductionBody, productionFormSchema, type ProductionFormData, type ProductionFormInput } from "../schema";

export interface ProductionFormPermissions {
  overrideNumbers: boolean;
  changeDate: boolean;
  addMaster: boolean;
  upload: boolean;
  removeFiles: boolean;
}

/**
 * Production Sample data entry:
 *   1 Basic Information → 2 Body 1 … n (Design with Roy Body: n + L/a/b, and the
 *   body's L, a, b) → 3 Sample Output → 4 Remarks → Save
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

  const methods = useForm<ProductionFormInput, unknown, ProductionFormData>({
    resolver: zodResolver(productionFormSchema) as Resolver<ProductionFormInput, unknown, ProductionFormData>,
    defaultValues: defaults,
    mode: "onBlur",
  });
  const { register, handleSubmit, getValues, reset, setError, formState } = methods;
  const errors = formState.errors;

  // One complete Body section per body, preserving what was typed.
  const n = useBodyRows(methods, "numberOfBodies", ["bodies"], emptyProductionBody);
  const env = useMemo(() => ({ options, allowCustom: permissions.addMaster }), [options, permissions.addMaster]);

  // Warn before leaving with unsaved changes.
  const dirty = formState.isDirty || files.map((f) => f.id).join() !== initialFiles.map((f) => f.id).join();
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const backToList = () => router.push("/production-sample");

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
            backToList();
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

  const numberInput = (name: "serialNo" | "slabNumber", id: string) => (
    <input
      id={id}
      inputMode="numeric"
      readOnly={!permissions.overrideNumbers}
      className={cn("input tabular-nums", !permissions.overrideNumbers && "bg-mute-bg text-ink-2", errorAt(errors, name) && "input-error")}
      {...register(name)}
    />
  );

  return (
    <SampleFormContext.Provider value={env}>
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
              <Field label="S. No." htmlFor="ps-serialNo" error={errorAt(errors, "serialNo")}>
                {numberInput("serialNo", "ps-serialNo")}
              </Field>
              <Field label="Slab Number" htmlFor="ps-slabNumber" error={errorAt(errors, "slabNumber")}>
                {numberInput("slabNumber", "ps-slabNumber")}
              </Field>
              <Field label="Design Name" htmlFor="ps-designName" error={errorAt(errors, "designName")}>
                <input id="ps-designName" className={cn("input", errorAt(errors, "designName") && "input-error")} autoComplete="off" {...register("designName")} />
              </Field>
              <Field label="Number of Bodies (n)" htmlFor="ps-bodies" error={errorAt(errors, "numberOfBodies")}>
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

          {/* 2 · Body 1 … n — each body: Design (+ Roy Body), its L, a, b */}
          <FormSection index={2} title="Bodies" description={n > 0 ? `${n} bod${n === 1 ? "y" : "ies"} — one section each` : undefined}>
            <BodySections
              n={n}
              idPrefix="ps"
              render={(i) => (
                <>
                  <BodyPart title="Design">
                    <DesignFields
                      prefix={`bodies.${i}.`}
                      idPrefix={`ps${i + 1}`}
                      royTitle={`Roy Body — Design (Body ${i + 1})`}
                      roy={<RoyBodyLabFields name={`bodies.${i}.designRoyBody`} idPrefix={`ps${i + 1}roy`} />}
                    />
                  </BodyPart>
                  <BodyPart title={`L, a, b Measurements — Body ${i + 1}`}>
                    <BodyLabFields name={`bodies.${i}`} label={`Body ${i + 1}`} />
                  </BodyPart>
                </>
              )}
            />
          </FormSection>

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
      </FormProvider>

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
    </SampleFormContext.Provider>
  );
}
