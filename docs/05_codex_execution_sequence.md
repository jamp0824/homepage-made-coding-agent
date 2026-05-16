# Codex Execution Sequence

## Step 1. Initialize Context

Prompt:

```text
Read PRD.md, AGENTS.md, docs/01_project_intent.md, docs/02_reference_images.md, docs/03_harness_strategy.md, docs/04_role_task_harness.md, and docs/pics/pic1~pic8.
Explain the project intent and produce an implementation plan. Do not modify code yet.
```

## Step 2. Create Contracts

Prompt:

```text
Act as Schema Engineer. Create or refine schemas/homepage-request.schema.json, schemas/generation-result.schema.json, schemas/template-config.schema.json, and three sample requests. Validate the samples against the schema if tooling exists. Do not implement UI.
```

## Step 3. Create Template System

Prompt:

```text
Act as Template System Engineer. Create company_intro_basic and product_basic templates. The agent must use constrained templates instead of free-form website generation. Add template config, page template, and assets defaults.
```

## Step 4. Create Goose Harness

Prompt:

```text
Act as Goose Agent Engineer. Create prompts/goose_homepage_builder.md, recipes/homepage-builder.recipe.yaml, and scripts/run-homepage-builder.sh. The recipe must accept request_path and generate generated-sites/{company_id}/.
```

## Step 5. Create Validation Harness

Prompt:

```text
Act as Validation Harness Engineer. Implement request validation, generated site validation, no fake claims validation, template compliance validation, and result schema validation. Output validation-report.json.
```

## Step 6. Build MVP Happy Path

Prompt:

```text
Run the happy path for requests/sample-company-intro.json. Generate generated-sites/COMPANY_001 with content.json, assets.json, metadata.json, page.tsx, generation-result.json. Run validation and repair failures.
```

## Step 7. Add Product Cases

Prompt:

```text
Run the product empty and product with items golden cases. Make sure empty products do not create fake product cards and product with items only uses provided product names.
```

## Step 8. Add Retry/Manual Required

Prompt:

```text
Add retry handling to scripts/run-homepage-builder.sh or the runner skeleton. After max retry, write generation-result.json with status manual_required. manual_required is an automation failure fallback, not human approval.
```
