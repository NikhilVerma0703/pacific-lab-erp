import { NextResponse } from "next/server";
import { can } from "@/lib/permissions";
import { plantToday } from "@/lib/plant-time";
import { currentUser } from "@/lib/session";
import { completeIn, inwardDesignsFor, inwardIn, productionIn, samplesIn } from "@/modules/downloads/data";
import { completeWorkbook, dataEntryWorkbook, filteredWorkbook, inwardWorkbook, productionWorkbook } from "@/modules/downloads/excel";
import { applyFilters, parseFilters, wantsLab, wantsProduction } from "@/modules/downloads/filters";
import { filterLabels } from "@/modules/downloads/labels";
import { isIsoDate, parsePeriod, periodFileTag } from "@/modules/downloads/period";

export const dynamic = "force-dynamic";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * GET /api/downloads?kind=entry|inward|complete|production|filtered
 *   &period=all | period=date&date=YYYY-MM-DD | period=range&from=YYYY-MM-DD&to=YYYY-MM-DD
 *   [&filters…]
 * Streams an .xlsx with only the records of that Production Date (and filters).
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || !can(user, "downloads.view")) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const kind = url.searchParams.get("kind");
  const mode = query.period ?? "date";
  // A date that was asked for must be a real date — never silently swapped for today.
  const bad =
    (mode === "date" && !isIsoDate(query.date)) || (mode === "range" && (!isIsoDate(query.from) || !isIsoDate(query.to)));
  if (bad) return NextResponse.json({ error: "Choose a valid Production Date." }, { status: 400 });
  const today = plantToday();
  const period = parsePeriod(query, today);
  const tag = periodFileTag(period);

  let file: Buffer;
  let name: string;
  try {
    switch (kind) {
      case "entry":
        file = await dataEntryWorkbook(await samplesIn(period));
        name = `Data-Entry-Samples_${tag}.xlsx`;
        break;
      case "inward":
        file = await inwardWorkbook(await inwardIn(period));
        name = `Inward-Outward-Samples_${tag}.xlsx`;
        break;
      case "production":
        if (!can(user, "production.view")) return NextResponse.json({ error: "You cannot view production samples." }, { status: 403 });
        file = await productionWorkbook(await productionIn(period));
        name = `Production-Samples_${tag}.xlsx`;
        break;
      case "complete":
        file = await completeWorkbook(await completeIn(period));
        name = `Complete-Sample-Report_${tag}.xlsx`;
        break;
      case "filtered": {
        const filters = parseFilters(query, today);
        if (filters.sampleType === "PRODUCTION" && !can(user, "production.view")) {
          return NextResponse.json({ error: "You cannot view production samples." }, { status: 403 });
        }
        const samples = wantsLab(filters) ? await samplesIn(filters.period) : [];
        const productions = wantsProduction(filters) && can(user, "production.view") ? await productionIn(filters.period) : [];
        const rows = applyFilters(samples, await inwardDesignsFor(samples), productions, filters);
        file = await filteredWorkbook(rows, filters, await filterLabels(filters));
        name = `Filtered-Samples_${periodFileTag(filters.period)}.xlsx`;
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown download type." }, { status: 400 });
    }
  } catch (e) {
    console.error("download", e);
    return NextResponse.json({ error: "The file could not be generated." }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": XLSX,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Content-Length": String(file.length),
      "Cache-Control": "no-store",
    },
  });
}
