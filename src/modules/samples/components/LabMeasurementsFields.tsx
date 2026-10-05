"use client";

import { LabRowsFields, NoBodiesHint } from "@/components/lab/LabRowsFields";

/** POST PRESS | POST POLISH side by side, one row per body. */
export function LabMeasurementsFields({ n }: { n: number }) {
  if (n < 1) return <NoBodiesHint />;
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-0">
      <div className="lg:pr-6">
        <LabRowsFields name="postPress" n={n} title="Post Press" />
      </div>
      <div className="lg:border-l-2 lg:border-line-2 lg:pl-6">
        <LabRowsFields name="postPolish" n={n} title="Post Polish" dot="accent" />
      </div>
    </div>
  );
}
