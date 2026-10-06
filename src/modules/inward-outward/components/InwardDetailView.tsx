import Link from "next/link";
import { RoyBodyView } from "@/components/lab/RoyBodyView";
import { BodyLabTable, BodyViewCard, BodyViewPart, LegacyBodiesNote } from "@/components/lab/BodyView";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Block, Grid, Item, Nested } from "@/modules/samples/components/SampleDetailView";
import type { InwardDetail } from "../queries";

/** Read-only, form-shaped view of an Inward / Outward entry. */
export function InwardDetailView({ e }: { e: InwardDetail }) {
  return (
    <div className="space-y-4">
      <Block index={1} title="Sample Details">
        <Grid>
          <Item label="Date" value={formatDate(e.entryDate)} />
          <Item label="Serial Number" value={e.serialNo} />
          <Item label="Company Name" value={e.company?.label} />
          <Item label="Sample Design Name" value={e.sampleDesignName} />
          <Item label="Number of Bodies" value={e.numberOfBodies} />
          {e.labSample && (
            <Item
              label="Linked Lab Sample"
              value={
                <Link href={`/samples/${e.labSample.id}`} className="text-brand-2 underline">
                  S.No. {e.labSample.serialNo}
                  {e.labSample.slabNumber ? ` · Slab ${e.labSample.slabNumber}` : ""} · {formatDate(e.labSample.sampleDate)}
                </Link>
              }
              wide
            />
          )}
        </Grid>
      </Block>

      <Block index={2} title="Bodies">
        {e.bodies.length === 0 ? (
          <p className="text-sm text-ink-3">Number of Bodies not recorded.</p>
        ) : (
          <div className="space-y-4">
            {e.legacyBodies && <LegacyBodiesNote parts="Design" />}
            {e.bodies.map((b) => (
              <BodyViewCard key={b.index} index={b.index}>
                <BodyViewPart title="Design Pattern">
                  <Grid>
                    <Item label="Design" value={b.designCategory === "PLAIN_BODY" ? "Plain Body" : b.designCategory === "NON_PLAIN_BODY" ? "Non-Plain Body" : null} />
                    {b.designCategory === "NON_PLAIN_BODY" && <Item label="Design Pattern(s)" value={b.designPatterns.map((p) => p.label).join(", ")} wide />}
                  </Grid>
                  {b.designCategory === "NON_PLAIN_BODY" && b.designPatterns.some((p) => p.code === "ROY_BODY") && (
                    <Nested title={`Roy Body Formulation (Body ${b.index})`}>
                      <RoyBodyView f={b.royBody} />
                    </Nested>
                  )}
                </BodyViewPart>
                <BodyViewPart title={`L, a, b Values — Body ${b.index}`}>
                  <BodyLabTable rows={[{ value: b.lab }]} />
                </BodyViewPart>
              </BodyViewCard>
            ))}
          </div>
        )}
      </Block>

      <Block index={3} title="Lab Recreation Attempts">
        {e.recreationAttempts ? (
          <p className="whitespace-pre-wrap text-[15px]">{e.recreationAttempts}</p>
        ) : (
          <p className="text-sm text-ink-3">Not recorded.</p>
        )}
      </Block>

      <p className="px-1 text-[12px] text-ink-3">
        Created {formatDateTime(e.createdAt)}
        {e.createdBy ? ` by ${e.createdBy}` : ""} · Last updated {formatDateTime(e.updatedAt)}
        {e.updatedBy ? ` by ${e.updatedBy}` : ""}
      </p>
    </div>
  );
}
