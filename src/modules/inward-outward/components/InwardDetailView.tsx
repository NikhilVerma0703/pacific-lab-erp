import Link from "next/link";
import { RoyBodyView } from "@/components/lab/RoyBodyView";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { Block, Grid, Item, Nested } from "@/modules/samples/components/SampleDetailView";
import type { InwardDetail } from "../queries";

/** Read-only, form-shaped view of an Inward / Outward entry. */
export function InwardDetailView({ e }: { e: InwardDetail }) {
  const hasRoy = e.designPatterns.some((p) => p.code === "ROY_BODY");
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

      <Block index={2} title="L, a, b Values">
        {!e.numberOfBodies ? (
          <p className="text-sm text-ink-3">Not recorded.</p>
        ) : (
          <div className="max-w-2xl overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr>
                  <th className="th">Body</th>
                  <th className="th">L</th>
                  <th className="th normal-case">a</th>
                  <th className="th normal-case">b</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: e.numberOfBodies }, (_, i) => {
                  const m = e.measurements.find((x) => x.bodyIndex === i + 1);
                  return (
                    <tr key={i}>
                      <td className="td font-semibold">Body {i + 1}</td>
                      <td className="td tabular-nums">{formatNumber(m?.l)}</td>
                      <td className="td tabular-nums">{formatNumber(m?.a)}</td>
                      <td className="td tabular-nums">{formatNumber(m?.b)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Block>

      <Block index={3} title="Design Pattern">
        <Grid>
          <Item
            label="Design"
            value={e.designCategory === "PLAIN_BODY" ? "Plain Body" : e.designCategory === "NON_PLAIN_BODY" ? "Non-Plain Body" : null}
          />
          {e.designCategory === "NON_PLAIN_BODY" && (
            <Item label="Design Pattern(s)" value={e.designPatterns.map((p) => p.label).join(", ")} wide />
          )}
        </Grid>
        {hasRoy && (
          <Nested title="Roy Body Formulation">
            <RoyBodyView f={e.royBody} />
          </Nested>
        )}
      </Block>

      <Block index={4} title="Lab Recreation Attempts">
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
