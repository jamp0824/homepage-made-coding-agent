import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomepageView } from "./homepage-view-renderer.mjs";

export function renderHomepageBody(model, mode = "final") {
  return renderToStaticMarkup(React.createElement(HomepageView, { model, mode }));
}

export function renderHomepageHtml(model, { title } = {}) {
  const body = renderHomepageBody(model, "final");
  const pageTitle = escapeHtml(title || model.companyName || "Generated homepage");
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${pageTitle}</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    ${body}
  </body>
</html>
`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
