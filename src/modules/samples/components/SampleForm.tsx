"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileCheck2, RotateCcw, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Controller, FormProvider, useForm, useWatch, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FormSection } from "@/components/ui/FormSection";
import { MasterPicker } from "@/components/ui/MasterPicker";
import { cn } from "@/lib/utils";
import { MASTER, VALUE_CODE } from "@/modules/master-data/catalog";
import type { MasterOptions } from "@/modules/master-data/types";
import { DesignFields } from "@/components/lab/DesignFields";
import { errorAt, hasCode, SampleFormContext } from "@/components/lab/form-context";
import { FormulationFields } from "@/components/lab/FormulationFields";
import { useBodyRows } from "@/components/lab/LabRowsFields";
import { Segmented } from "@/components/ui/Segmented";
import { nextNumbersAction } from "../next-numbers";
import { saveSampleAction } from "../actions";
import type { AttachmentDTO } from "../queries";
import { MAX_BODIES, sampleFormSchema, type SampleFormData, type SampleFormInput } from "../schema";
import { AttachmentsField } from "./AttachmentsField";
import { LabMeasurementsFields } from "./LabMeasurementsFields";

export interface SampleFormPermissions {
  overrideNumbers: boolean;
  changeDate: boolean;
  addMaster: boolean;
  upload: boolean;
  removeFiles: boolean;
}

interface Props {
  mode: "create" | "edit";
  sampleId?: string;
  defaults: SampleFormInput;
  attachments: AttachmentDTO[];
  options: MasterOptions;
  permissions: SampleFormPermissions;
  maxUploadMb: number;
  /** Status of the record being edited (drafts get a banner). */
  status?: "DRAFT" | "SUBMITTED";
}

export function SampleForm({ mode, sampleId, defaults, attachments: initialFiles, options, permissions, maxUploadMb, status }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [files, setFiles] = useState<AttachmentDTO[]>(initialFiles);
  const [baseline, setBaseline] = useState(defaults);
  const [confirm, setConfirm] = useState<null | "reset" | "cancel">(null);

  const methods = useForm<SampleFormInput, unknown, SampleFormData>({
    resolver: zodResolver(sampleFormSchema) as Resolver<SampleFormInput, unknown, SampleFormData>,
    defaultValues: defaults,
    mode: "onBlur",
  });
  const { control, register, handleSubmit, getValues, reset, setError, formState } = methods;
  const errors = formState.errors;

  // ── watched values that drive the layout ───────────────────────────────────
  const sampleType = useWatch({ control, name: "sampleType" });
  const physicalPresent = useWatch({ control, name: "physicalSamplePresent" });
  const hasVein = useWatch({ control, name: "hasVein" });
  const veinMethods = useWatch({ control, name: "veinMethods" });

  const isCreative = hasCode([sampleType], options[MASTER.SAMPLE_TYPE], VALUE_CODE.CREATIVE_SAMPLE);
  const isInspired = hasCode([sampleType], options[MASTER.SAMPLE_TYPE], VALUE_CODE.INSPIRED_SAMPLE);
  const showVeinRoy = hasVein !== "NO" && hasCode(veinMethods ?? [], options[MASTER.VEIN_METHOD], VALUE_CODE.ROY_BODY);

  // One L/a/b row per body on each side, preserving what was typed.
  const n = useBodyRows(methods, "numberOfBodies", ["postPress", "postPolish"]);

  // Warn before leaving with unsaved changes.
  const dirty = formState.isDirty || files.map((f) => f.id).join() !== initialFiles.map((f) => f.id).join();
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const env = useMemo(() => ({ options, allowCustom: permissions.addMaster }), [options, permissions.addMaster]);

  function submit(saveAs: "DRAFT" | "SUBMITTED") {
    return handleSubmit(
      () => {
        const raw = { ...getValues(), attachmentIds: files.map((f) => f.id) };
        start(async () => {
          // Untouched suggestions are re-allocated by the server, so two people
          // saving at once never collide on a stale suggestion.
          const r = await saveSampleAction(raw, {
            id: sampleId,
            status: saveAs,
            autoSerial: mode === "create" && raw.serialNo === baseline.serialNo,
            autoSlab: mode === "create" && raw.slabNumber === baseline.slabNumber,
          });
          if (!r.ok) {
            toast.error(r.error);
            const entries = Object.entries(r.fieldErrors ?? {});
            entries.forEach(([path, message]) =>
              setError(path as Parameters<typeof setError>[0], { type: "server", message }),
            );
            if (entries[0]) scrollToError(entries[0][0]);
            return;
          }
          toast.success(r.message ?? "Saved.");
          if (r.data.inwardUrl) {
            // Inspired sample with the physical sample in hand → record it in Inward / Outward.
            toast.info("Now enter the physical sample's details in Inward / Outward.");
            router.push(r.data.inwardUrl);
            return;
          }
          if (mode === "edit") {
            router.push("/samples");
            router.refresh();
            return;
          }
          // New sample: clear the form and suggest the next numbers.
          const next = await nextNumbersAction();
          const fresh = {
            ...baseline,
            serialNo: String(next.serialNo),
            slabNumber: String(next.slabNumber),
            sampleDate: getValues("sampleDate"),
          };
          setBaseline(fresh);
          reset(fresh);
          setFiles([]);
          router.refresh();
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      },
      (errs) => {
        toast.error("Some values need fixing — see the highlighted fields.");
        const first = Object.keys(errs)[0];
        if (first) scrollToError(first);
      },
    )();
  }

  function scrollToError(path: string) {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(".input-error, [role=alert]");
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      void path;
    });
  }

  let section = 0;
  const next = () => ++section;

  return (
    <SampleFormContext.Provider value={env}>
      <FormProvider {...methods}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit("SUBMITTED");
          }}
          onKeyDown={(e) => {
            // Enter in a text box must not save the whole sample by accident.
            const t = e.target as HTMLElement;
            if (e.key === "Enter" && t.tagName === "INPUT" && (t as HTMLInputElement).type !== "submit") e.preventDefault();
          }}
          noValidate
          className="space-y-4"
        >
          {status === "DRAFT" && (
            <p className="rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn-fg">
              This sample is a <strong>draft</strong>. “Save Sample” marks it complete.
            </p>
          )}

          {/* 1 · Basic information */}
          <FormSection index={next()} title="Basic Information" description="Identity of the sample">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Date" htmlFor="sampleDate" error={errorAt(errors, "sampleDate")}>
                <input
                  id="sampleDate"
                  type="date"
                  className={cn("input", !permissions.changeDate && "pointer-events-none bg-mute-bg text-ink-2", errorAt(errors, "sampleDate") && "input-error")}
                  readOnly={!permissions.changeDate}
                  {...register("sampleDate")}
                />
              </Field>
              <Field
                label="S.No."
                htmlFor="serialNo"
                error={errorAt(errors, "serialNo")}
              >
                <input
                  id="serialNo"
                  inputMode="numeric"
                  className={cn("input tabular-nums", !permissions.overrideNumbers && "bg-mute-bg text-ink-2", errorAt(errors, "serialNo") && "input-error")}
                  readOnly={!permissions.overrideNumbers}
                  {...register("serialNo")}
                />
              </Field>
              <Field
                label="Slab Number"
                htmlFor="slabNumber"
                error={errorAt(errors, "slabNumber")}
              >
                <input
                  id="slabNumber"
                  inputMode="numeric"
                  className={cn("input tabular-nums", !permissions.overrideNumbers && "bg-mute-bg text-ink-2", errorAt(errors, "slabNumber") && "input-error")}
                  readOnly={!permissions.overrideNumbers}
                  {...register("slabNumber")}
                />
              </Field>
              <Field label="Sample Type" htmlFor="sampleType" error={errorAt(errors, "sampleType")}>
                <Controller
                  control={control}
                  name="sampleType"
                  render={({ field }) => (
                    <MasterPicker
                      id="sampleType"
                      options={options[MASTER.SAMPLE_TYPE]}
                      value={field.value ?? null}
                      onChange={field.onChange}
                      allowCustom={permissions.addMaster}
                      noun="sample type"
                      placeholder="Select sample type"
                    />
                  )}
                />
              </Field>
            </div>
            {isCreative && (
              <div className="mt-4 grid grid-cols-1 gap-4 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="Number of Bodies (n)"
                  htmlFor="numberOfBodies"
                  error={errorAt(errors, "numberOfBodies")}
                >
                  <input
                    id="numberOfBodies"
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
            {isInspired && (
              <div className="mt-4 border-t border-line pt-4">
                <Field
                  label="Physical Sample Present?"
                  htmlFor="physicalSamplePresent"
                  hint={
                    physicalPresent === "YES"
                      ? "After saving, you will be taken to Inward / Outward to enter the sample's details."
                      : physicalPresent === "NO"
                        ? "This sample will be listed under Rectification in Inward / Outward."
                        : undefined
                  }
                >
                  <Controller
                    control={control}
                    name="physicalSamplePresent"
                    render={({ field }) => (
                      <Segmented
                        id="physicalSamplePresent"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        options={[
                          { value: "YES", label: "Yes" },
                          { value: "NO", label: "No" },
                        ]}
                      />
                    )}
                  />
                </Field>
              </div>
            )}
            {sampleType && !isCreative && !isInspired && (
              <p className="mt-4 rounded-lg bg-info-bg px-4 py-3 text-sm text-info-fg">
                The detailed formulation form opens for <strong>Creative Sample</strong>. For other sample types, record the
                basics, remarks and output files below.
              </p>
            )}
          </FormSection>

          {isCreative && (
            <>
              {/* 2 · Material choices (+ 3 · Pigment, inside the reusable formulation block) */}
              <FormSection index={next()} title="Material Choices & Pigment" description="Resin, grits, filler and colours of the main body">
                <FormulationFields name="main" idPrefix="main" />
              </FormSection>

              {/* Design */}
              <FormSection index={next()} title="Design">
                <DesignFields idPrefix="d" />
              </FormSection>

              {/* Mixer type */}
              <FormSection index={next()} title="Mixer Type">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Mixer Type" htmlFor="mixerType">
                    <Controller
                      control={control}
                      name="mixerType"
                      render={({ field }) => (
                        <MasterPicker
                          id="mixerType"
                          options={options[MASTER.MIXER_TYPE]}
                          value={field.value ?? null}
                          onChange={field.onChange}
                          allowCustom={permissions.addMaster}
                          noun="mixer type"
                          placeholder="Select mixer type"
                        />
                      )}
                    />
                  </Field>
                </div>
              </FormSection>

              {/* Vein */}
              <FormSection index={next()} title="Vein">
                <div className="space-y-4">
                  <Field label="Vein" htmlFor="hasVein">
                    <Controller
                      control={control}
                      name="hasVein"
                      render={({ field }) => (
                        <Segmented
                          id="hasVein"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          options={[
                            { value: "YES", label: "Yes — has vein" },
                            { value: "NO", label: "No vein" },
                          ]}
                        />
                      )}
                    />
                  </Field>
                  {hasVein !== "NO" && (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Field label="How Vein Introduced" htmlFor="veinMethods" error={errorAt(errors, "veinMethods")} hint="Select every technique used.">
                        <Controller
                          control={control}
                          name="veinMethods"
                          render={({ field }) => (
                            <MasterPicker
                              id="veinMethods"
                              multiple
                              options={options[MASTER.VEIN_METHOD]}
                              value={field.value ?? []}
                              onChange={field.onChange}
                              allowCustom={permissions.addMaster}
                              noun="method"
                              placeholder="Select methods"
                            />
                          )}
                        />
                      </Field>
                      <Field label="Vein details" htmlFor="veinNotes" error={errorAt(errors, "veinNotes")} hint="Colour, thickness, direction …">
                        <textarea id="veinNotes" rows={2} className="input" {...register("veinNotes")} />
                      </Field>
                    </div>
                  )}
                  {showVeinRoy && (
                    <FormSection tone="nested" index="R" title="Roy Body Formulation — Vein" description="Opened because ROY BODY is selected in How Vein Introduced">
                      <FormulationFields name="veinRoyBody" idPrefix="vroy" />
                    </FormSection>
                  )}
                </div>
              </FormSection>

              {/* L a b */}
              <FormSection index={next()} title="L, a, b Measurements">
                <LabMeasurementsFields n={n} />
              </FormSection>
            </>
          )}

          {/* Output */}
          <FormSection index={next()} title="Sample Output" description="Photo or document of the finished sample">
            <div className="space-y-4">
              <div>
                <p className="label">Sample Output Photo / Document</p>
                <AttachmentsField
                  files={files}
                  onChange={setFiles}
                  sampleId={sampleId}
                  canUpload={permissions.upload}
                  canRemove={permissions.removeFiles}
                  maxMb={maxUploadMb}
                />
              </div>
              <Field label="Remarks" htmlFor="remarks" error={errorAt(errors, "remarks")}>
                <textarea id="remarks" rows={3} className="input" {...register("remarks")} />
              </Field>
            </div>
          </FormSection>

          {/* Actions */}
          <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-xl lg:border">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-ghost" onClick={() => (dirty ? setConfirm("cancel") : mode === "edit" ? router.push("/samples") : null)} disabled={pending}>
                <X className="size-4" /> Cancel
              </button>
              {mode === "create" && (
                <button type="button" className="btn-ghost" onClick={() => setConfirm("reset")} disabled={pending || !dirty}>
                  <RotateCcw className="size-4" /> Reset
                </button>
              )}
              <span className="flex-1" />
              <button type="button" className="btn-secondary" onClick={() => submit("DRAFT")} disabled={pending}>
                <Save className="size-4" /> Save Draft
              </button>
              <button type="submit" className="btn-primary" disabled={pending}>
                <FileCheck2 className="size-4" /> {pending ? "Saving…" : mode === "edit" ? "Save Changes" : "Save Sample"}
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
            router.push("/samples");
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
