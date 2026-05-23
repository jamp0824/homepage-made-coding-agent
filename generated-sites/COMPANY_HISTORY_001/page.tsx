// Generated from company_intro_basic (result_style_v1). Do not edit outside generated-sites/{company_id}.
import content from "./content.json";
import { HomepageView } from "../../frontend/lib/homepage-view-renderer.mjs";
import { contentToViewModel } from "../../frontend/lib/homepage-view-model.mjs";

export default function GeneratedHomepage() {
  return <HomepageView model={contentToViewModel(content)} mode="final" />;
}
