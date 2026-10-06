"use client";

import { useState } from "react";
import { BodyLabTable, BodyViewCard, BodyViewPart, LegacyBodiesNote } from "@/components/lab/BodyView";
import { LabTablesView } from "@/components/lab/LabTablesView";
import { formatDate, formatDateTime } from "@/lib/utils";
import { AttachmentCard } from "@/modules/samples/components/AttachmentsField";
import { FileViewer, type ViewableFile } from "@/modules/samples/components/FileViewer";
import { Block, Empty, Grid, Item, Nested } from "@/modules/samples/components/SampleDetailView";
import type { ProductionDetail } from "../queries";

/** Read-only, form-shaped view of everything recorded for a production sample. */
export function ProductionDetailView({ s }: { s: ProductionDetail }) {
  const [viewing, setViewing] = useState<ViewableFile | null>(null);

  return (
    <div className="space-y-4">
      <Block index={1} title="Basic Information">
        <Grid>
          <Item label="Date" value={formatDate(s.sampleDate)} />
          <Item label="S. No." value={s.serialNo} />
          <Item label="Slab Number" value={s.slabNumber} />
          <Item label="Design Name" value={s.designName} />
          <Item label="Number of Bodies (n)" value={s.numberOfBodies} />
        </Grid>
      </Block>

      <Block index={2} title="Bodies">
        {s.bodies.length === 0 ? (
          <Empty text="Number of Bodies not recorded." />
        ) : (
          <div className="space-y-4">
            {s.legacyBodies && <LegacyBodiesNote parts="Design" />}
            {s.bodies.map((b) => (
              <BodyViewCard key={b.index} index={b.index}>
                <BodyViewPart title="Design">
                  <Grid>
                    <Item label="Design" value={b.designCategory === "PLAIN_BODY" ? "Plain Body" : b.designCategory === "NON_PLAIN_BODY" ? "Non-Plain Body" : null} />
                    {b.designCategory === "NON_PLAIN_BODY" && <Item label="Design Pattern(s)" value={b.designPatterns.map((p) => p.label).join(", ")} wide />}
                  </Grid>
                  {b.royBody && (
                    <Nested title={`Roy Body — Design (Body ${b.index})`}>
                      <div className="space-y-4">
                        <Grid>
                          <Item label="Number of Bodies (n)" value={b.royBody.numberOfBodies} />
                        </Grid>
                        <section className="rounded-lg border border-line bg-white p-4">
                          <h5 className="mb-3 text-[13px] font-bold tracking-wide text-ink-2 uppercase">L, a, b Values</h5>
                          <LabTablesView n={b.royBody.numberOfBodies} readings={b.royBody.readings} />
                        </section>
                      </div>
                    </Nested>
                  )}
                </BodyViewPart>
                <BodyViewPart title={`L, a, b Measurements — Body ${b.index}`}>
                  <BodyLabTable
                    rows={[
                      { title: "Post Press", value: b.postPress },
                      { title: "Post Polish", value: b.postPolish, dot: "accent" },
                    ]}
                  />
                </BodyViewPart>
              </BodyViewCard>
            ))}
          </div>
        )}
      </Block>

      <Block index={3} title="Sample Output">
        {s.attachments.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {s.attachments.map((a) => (
              <AttachmentCard key={a.id} file={a} onView={() => setViewing(a)} />
            ))}
          </ul>
        ) : (
          <Empty text="No files attached." />
        )}
      </Block>

      <Block index={4} title="Remarks">
        {s.remarks ? <p className="text-[15px] break-words whitespace-pre-wrap">{s.remarks}</p> : <Empty />}
      </Block>

      <p className="px-1 text-[12px] text-ink-3">
        Created {formatDateTime(s.createdAt)}
        {s.createdBy ? ` by ${s.createdBy}` : ""} · Last updated {formatDateTime(s.updatedAt)}
        {s.updatedBy ? ` by ${s.updatedBy}` : ""}
      </p>

      <FileViewer file={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
