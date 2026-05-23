import type { HomepageViewModel } from "./homepage-view-model.mjs";

export function renderHomepageBody(model: HomepageViewModel, mode?: "draft" | "final"): string;
export function renderHomepageHtml(model: HomepageViewModel, options?: { title?: string }): string;
