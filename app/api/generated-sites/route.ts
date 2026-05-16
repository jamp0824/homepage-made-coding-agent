import { NextResponse } from "next/server";
import { listGeneratedSites } from "../../../lib/generated-sites";

export const dynamic = "force-dynamic";

export function GET() {
  const sites = listGeneratedSites();

  return NextResponse.json({
    summary: {
      total: sites.length,
      previewAvailable: sites.filter((site) => site.previewAvailable).length,
      generatedOrPublished: sites.filter(
        (site) => site.status === "generated" || site.status === "published",
      ).length,
      manualRequired: sites.filter((site) => site.status === "manual_required").length,
      validationFailed: sites.filter((site) => site.validationPassed === false).length,
    },
    sites,
  });
}
