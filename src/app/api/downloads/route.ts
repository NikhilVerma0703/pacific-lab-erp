import { NextResponse } from "next/server";
import { can } from "@/lib/permissions";
import { plantToday } from "@/lib/plant-time";
import { currentUser } from "@/lib/session";
import { filterSource, inwardIn, productionIn, samplesIn } from "@/modules/downloads/data";
import { filteredWorkbook, inwardWorkbook, labWorkbook, productionWorkbook } from "@/modules/downloads/excel";
import { applyFilters, parseFilters, sampleTypeOption, type SampleType } from "@/modules/downloads/filters";
import { isIsoDate, parsePeriod, periodFileTag } from "@/modules/downloads/period";

export const dynamic = "force-dynamic";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const FILE: Record<SampleType, string> = { LAB: "Lab-Sample", INWARD: "Inward-Outward-Sample", PRODUCTION: "Production-Sample" };
/** Download kind → report ("entry" is the earlier name of the Lab Sample report). */
const REPORT: Record<string, SampleType> = { lab: "LAB", entry: "LAB", inward: "INWARD", production: "PRODUCTION" };

/**
 * GET /api/downloads?kind=lab|inward|production|filtered
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
    const report = kind ? REPORT[kind] : undefined;
    const refuse = (t: SampleType) => NextResponse.json({ error: `You cannot view ${sampleTypeOption(t).record.toLowerCase()}s.` }, { status: 403 });
    switch (kind) {
      case "lab":
      case "entry":
      case "inward":
      case "production": {
        const t = report!;
        if (!can(user, sampleTypeOption(t).permission)) return refuse(t);
        file = t === "LAB" ? await labWorkbook(await samplesIn(period)) : t === "INWARD" ? await inwardWorkbook(await inwardIn(period)) : await productionWorkbook(await productionIn(period));
        name = `${FILE[t]}-Report_${tag}.xlsx`;
        break;
      }
      case "filtered": {
        const filters = parseFilters(query, today);
        if (!can(user, sampleTypeOption(filters.sampleType).permission)) return refuse(filters.sampleType);
        const rows = applyFilters(await filterSource(filters.sampleType, filters.period), filters);
        file = await filteredWorkbook(rows, filters);
        name = `Filtered-${FILE[filters.sampleType]}s_${periodFileTag(filters.period)}.xlsx`;
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
