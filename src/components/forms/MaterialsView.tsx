import { formatNumber } from "@/lib/utils";
import type { ComponentDTO, FormulationDTO } from "@/modules/samples/queries";

/** "1200" for grams; "30 %" only for values recorded with percentages by an early form. */
const qty = (quantity: string | null, unit?: ComponentDTO["unit"]) =>
  quantity === null ? "—" : unit === "PERCENT" ? `${formatNumber(quantity)} %` : formatNumber(quantity);

/**
 * Read-only Material Details of one body: Material Choices (Resin, Grits with
 * Size of Grit, Filler) and Pigments / Additives Details (Color Used,
 * Additives Used) — every quantity in grams.
 */
export function MaterialsView({ f }: { f: Pick<FormulationDTO, "components" | "additives"> | null }) {
  const of = (k: ComponentDTO["kind"]) => (f?.components ?? []).filter((c) => c.kind === k);
  const additives = f?.additives ?? [];
  if (!f || (f.components.length === 0 && additives.length === 0)) return <p className="text-sm text-ink-3">Not recorded.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Part title="Material Choices">
        <Table title="Resin" head={["Resin", "Quantity (gm)"]} rows={of("RESIN").map((c) => [c.material?.label ?? "—", qty(c.quantity, c.unit)])} />
        <Table
          title="Grits"
          head={["Grits", "Size of Grit", "Quantity (gm)"]}
          rows={of("GRIT").map((c) => [c.material?.label ?? "—", c.size?.label ?? "—", qty(c.quantity, c.unit)])}
        />
        <Table title="Filler" head={["Filler", "Quantity (gm)"]} rows={of("FILLER").map((c) => [c.material?.label ?? "—", qty(c.quantity, c.unit)])} />
      </Part>
      <Part title="Pigments / Additives Details">
        <Table title="Pigments" head={["Color Used", "Quantity (gm)"]} rows={of("PIGMENT").map((c) => [c.material?.label ?? "—", qty(c.quantity, c.unit)])} />
        <Table title="Additives" head={["Additives Used", "Quantity (gm)"]} rows={additives.map((a) => [a.additive.label, qty(a.quantity)])} />
      </Part>
    </div>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-line bg-white p-4">
      <h4 className="text-[13px] font-bold tracking-wide text-ink uppercase">{title}</h4>
      {children}
    </section>
  );
}

function Table({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <div>
      <p className="mb-1 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-3">—</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr>
                {head.map((h, i) => (
                  <th key={h} className={i === head.length - 1 ? "th text-right" : "th"}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className={j === r.length - 1 ? "td text-right tabular-nums" : j === 0 ? "td font-semibold" : "td"}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
