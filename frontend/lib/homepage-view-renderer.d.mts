import type { ReactElement } from "react";
import type { HomepageViewModel } from "./homepage-view-model.mjs";

export function HomepageView(props: { model: HomepageViewModel; mode?: "draft" | "final" }): ReactElement;
