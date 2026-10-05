import { NextResponse } from "next/server";
import { can } from "@/lib/permissions";
import { plantToday } from "@/lib/plant-time";
import { currentUser } from "@/lib/session";
import { completeOn, inwardDesignsFor, inwardOn, samplesOn } from "@/modules/downloads/data";
import { completeWorkbook, dataEntryWorkbook, filteredWorkbook, inwardWorkbook } from "@/modules/downloads/excel";
import { applyFilters, parseFilters } from "@/modules/downloads/filters";
import { filterLabels } from "@/modules/downloads/labels";

export const dynamic = "force-dynamic";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * GET /api/downloads?kind=entry|inward|complete|filtered&date=YYYY-MM-DD[&filters…]
 * Streams an .xlsx with only the records of that date (and filters).
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || !can(user, "downloads.view")) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const kind = url.searchParams.get("kind");
  const raw = url.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
    return NextResponse.json({ error: "Choose a valid date." }, { status: 400 });
  }
  const date = raw;

  let file: Buffer;
  let name: string;
  try {
    switch (kind) {
      case "entry":
        file = await dataEntryWorkbook(await samplesOn(date));
        name = `Data-Entry-Samples_${date}.xlsx`;
        break;
      case "inward":
        file = await inwardWorkbook(await inwardOn(date));
        name = `Inward-Outward-Samples_${date}.xlsx`;
        break;
      case "complete":
        file = await completeWorkbook(await completeOn(date));
        name = `Complete-Sample-Report_${date}.xlsx`;
        break;
      case "filtered": {
        const filters = parseFilters(query, plantToday());
        const samples = await samplesOn(filters.date);
        const rows = applyFilters(samples, await inwardDesignsFor(samples), filters);
        file = await filteredWorkbook(rows, filters, await filterLabels(filters));
        name = `Filtered-Samples_${filters.date}.xlsx`;
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
