"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileCheck2, Link2, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Controller, FormProvider, useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { DesignFields } from "@/components/lab/DesignFields";
import { errorAt, SampleFormContext } from "@/components/lab/form-context";
import { useBodyRows } from "@/components/lab/LabRowsFields";
import { BodyLabFields, BodyPart, BodySections } from "@/components/lab/BodySections";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FormSection } from "@/components/ui/FormSection";
import { MasterPicker } from "@/components/ui/MasterPicker";
import { cn, formatDate } from "@/lib/utils";
import { MASTER } from "@/modules/master-data/catalog";
import type { MasterOptions } from "@/modules/master-data/types";
import { MAX_BODIES } from "@/modules/samples/schema";
import { nextInwardSerialAction, saveInwardAction } from "../actions";
import { emptyInwardBody, inwardFormSchema, type InwardFormData, type InwardFormInput } from "../schema";

export interface LinkedSample {
  id: string;
  serialNo: number;
  slabNumber: number | null;
  sampleDate: string;
}

export function InwardForm({
  mode,
  entryId,
  defaults,
  linkedSample,
  options,
  canOverrideNumbers,
  canAddMaster,
}: {
  mode: "create" | "edit";
  entryId?: string;
  defaults: InwardFormInput;
  linkedSample: LinkedSample | null;
  options: MasterOptions;
  canOverrideNumbers: boolean;
  canAddMaster: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [baseline, setBaseline] = useState(defaults);
  const [linked, setLinked] = useState(linkedSample);
  const [confirm, setConfirm] = useState<null | "reset" | "cancel">(null);

  const methods = useForm<InwardFormInput, unknown, InwardFormData>({
    resolver: zodResolver(inwardFormSchema) as Resolver<InwardFormInput, unknown, InwardFormData>,
    defaultValues: defaults,
    mode: "onBlur",
  });
  const { control, register, handleSubmit, getValues, setValue, reset, setError, formState } = methods;
  const errors = formState.errors;
  const n = useBodyRows(methods, "numberOfBodies", ["bodies"], emptyInwardBody);
  const env = useMemo(() => ({ options, allowCustom: canAddMaster }), [options, canAddMaster]);

  useEffect(() => {
    if (!formState.isDirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [formState.isDirty]);

  function submit() {
    handleSubmit(
      () => {
        const raw = getValues();
        start(async () => {
          const r = await saveInwardAction(raw, {
            id: entryId,
            autoSerial: mode === "create" && raw.serialNo === baseline.serialNo,
          });
          if (!r.ok) {
            toast.error(r.error);
            Object.entries(r.fieldErrors ?? {}).forEach(([path, message]) =>
              setError(path as Parameters<typeof setError>[0], { type: "server", message }),
            );
            return;
          }
          toast.success(r.message ?? "Saved.");
          if (mode === "edit") {
            router.push("/inward-outward");
            router.refresh();
            return;
          }
          const serial = await nextInwardSerialAction();
          const fresh = { ...baseline, serialNo: String(serial), labSampleId: null, entryDate: getValues("entryDate") };
          setBaseline(fresh);
          setLinked(null);
          reset(fresh);
          // Drop ?sample= so a refresh does not re-link the same sample.
          router.replace("/inward-outward#recent");
          router.refresh();
        });
      },
      () => toast.error("Some values need fixing — see the highlighted fields."),
    )();
  }

  return (
    <SampleFormContext.Provider value={env}>
      <FormProvider {...methods}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          onKeyDown={(e) => {
            const t = e.target as HTMLElement;
            if (e.key === "Enter" && t.tagName === "INPUT") e.preventDefault();
          }}
          noValidate
          className="space-y-4"
        >
          {linked && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent/40 bg-accent-bg px-4 py-3 text-sm">
              <Link2 className="size-4 text-accent" />
              <span className="flex-1">
                Recording the physical sample for lab sample{" "}
                <Link href={`/samples/${linked.id}`} className="font-semibold text-accent underline">
                  S.No. {linked.serialNo}
                </Link>
                {linked.slabNumber ? ` · Slab ${linked.slabNumber}` : ""} · {formatDate(linked.sampleDate)}
              </span>
              {mode === "create" && (
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    setLinked(null);
                    setValue("labSampleId", null);
                    router.replace("/inward-outward");
                  }}
                >
                  <X className="size-3.5" /> Unlink
                </button>
              )}
            </div>
          )}

          <FormSection index={1} title="Sample Details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <Field label="Date" htmlFor="io-date" error={errorAt(errors, "entryDate")}>
                <input
                  id="io-date"
                  type="date"
                  className={cn("input", errorAt(errors, "entryDate") && "input-error")}
                  {...register("entryDate")}
                />
              </Field>
              <Field
                label="Serial Number"
                htmlFor="io-serialNo"
                error={errorAt(errors, "serialNo")}
              >
                <input
                  id="io-serialNo"
                  inputMode="numeric"
                  readOnly={!canOverrideNumbers}
                  className={cn("input tabular-nums", !canOverrideNumbers && "bg-mute-bg text-ink-2", errorAt(errors, "serialNo") && "input-error")}
                  {...register("serialNo")}
                />
              </Field>
              <Field label="Company Name" htmlFor="io-company">
                <Controller
                  control={control}
                  name="company"
                  render={({ field }) => (
                    <MasterPicker
                      id="io-company"
                      options={options[MASTER.COMPANY]}
                      value={field.value ?? null}
                      onChange={field.onChange}
                      allowCustom={canAddMaster}
                      noun="company"
                      placeholder="Select or type company"
                    />
                  )}
                />
              </Field>
              <Field label="Sample Design Name" htmlFor="io-design-name" error={errorAt(errors, "sampleDesignName.label") ?? errorAt(errors, "sampleDesignName")}>
                <Controller
                  control={control}
                  name="sampleDesignName"
                  render={({ field }) => (
                    <MasterPicker
                      id="io-design-name"
                      options={options[MASTER.DESIGN_NAME]}
                      value={field.value ?? null}
                      onChange={field.onChange}
                      allowCustom={canAddMaster}
                      invalid={!!(errorAt(errors, "sampleDesignName.label") ?? errorAt(errors, "sampleDesignName"))}
                      noun="design name"
                      placeholder="Select or type design name"
                    />
                  )}
                />
              </Field>
              <Field
                label="Number of Bodies (n)"
                htmlFor="io-bodies"
                error={errorAt(errors, "numberOfBodies")}
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
          </FormSection>

          {/* Body 1 … n — each body: Design, its L, a, b */}
          <FormSection index={2} title="Bodies" description={n > 0 ? `${n} bod${n === 1 ? "y" : "ies"} — one section each` : undefined}>
            <BodySections
              n={n}
              idPrefix="io"
              render={(i) => (
                <>
                  <BodyPart title="Design Pattern">
                    <DesignFields prefix={`bodies.${i}.`} idPrefix={`io${i + 1}`} royTitle={`Roy Body Formulation (Body ${i + 1})`} />
                  </BodyPart>
                  <BodyPart title={`L, a, b Values — Body ${i + 1}`}>
                    <BodyLabFields name={`bodies.${i}`} label={`Body ${i + 1}`} variant="single" />
                  </BodyPart>
                </>
              )}
            />
          </FormSection>

          <FormSection index={3} title="Lab Recreation Attempts">
            <Field label="Lab Recreation Attempts" htmlFor="io-attempts" error={errorAt(errors, "recreationAttempts")}>
              <textarea
                id="io-attempts"
                rows={4}
                className="input"
                placeholder="What was tried in the lab to recreate this sample, and the outcome"
                {...register("recreationAttempts")}
              />
            </Field>
          </FormSection>

          <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-xl lg:border">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-ghost"
                disabled={pending}
                onClick={() => (formState.isDirty ? setConfirm("cancel") : mode === "edit" ? router.push("/inward-outward") : null)}
              >
                <X className="size-4" /> Cancel
              </button>
              {mode === "create" && (
                <button type="button" className="btn-ghost" disabled={pending || !formState.isDirty} onClick={() => setConfirm("reset")}>
                  <RotateCcw className="size-4" /> Reset
                </button>
              )}
              <span className="flex-1" />
              <button type="submit" className="btn-primary" disabled={pending}>
                <FileCheck2 className="size-4" /> {pending ? "Saving…" : mode === "edit" ? "Save Changes" : "Save Entry"}
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
          setConfirm(null);
          if (mode === "edit") router.push("/inward-outward");
          else reset(baseline);
        }}
      />
    </SampleFormContext.Provider>
  );
}
