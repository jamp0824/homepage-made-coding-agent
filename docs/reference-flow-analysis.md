# Reference Flow Analysis

## Purpose

This document summarizes the existing customer homepage-making STEP flow only as context for the automation target. The MVP must not rebuild this customer UI. The useful output of the flow is a homepage request JSON that can drive automated site generation.

## STEP 0. Start

- Customer sees a simple entry screen for free company homepage creation.
- The screen sets expectations that AI can create a basic company homepage from a small amount of company information.
- Automation implication: after completion, the system should have enough structured request data to create a first homepage draft without asking for human approval.

## STEP 1. Homepage Type

- Customer chooses between product-centered and company-introduction-centered homepage formats.
- Product-centered output later needs either product cards from provided product data or a product registration CTA when products are empty.
- Company-introduction-centered output later emphasizes company intro, strengths, business summary, and optional history or portfolio only when provided.

## STEP 2. Company Information

- Customer confirms or enters industry, business type, and main business description.
- These fields become core required request inputs:
  - `industry`
  - `business_type`
  - `main_business_description`
- Automation implication: these fields may be summarized safely, but the generator must not invent facts beyond them.

## STEP 3. AI-Assisted Content

- Customer may provide or refine one-line intro, company intro, and core strengths.
- The screenshots include example strengths such as experience, custom solutions, professional staff, and support. These must not be treated as universal defaults.
- Automation implication: use request-provided `one_line_intro`, `company_intro`, and `core_strengths` when present. If missing, derive only cautious summaries from `main_business_description`, `industry`, and `business_type`.

## STEP 4. Completion

- Customer sees that the AI homepage creation request has been submitted.
- Depending on homepage type, the completion screen can guide the customer to add more product or company content later.
- Automation implication: this project starts after this point. The internal job should run automatically and write generated output plus validation reports.

## Data Expected After Completion

The generated request JSON should include:

- `request_id`
- `company_id`
- `homepage_type`
- `company_name`
- `industry`
- `business_type`
- `main_business_description`
- optional `one_line_intro`
- optional `company_intro`
- optional `core_strengths`
- optional `products`
- optional `portfolio`
- optional `history`
- optional `preferred_style`
- `created_at`

## Out of Scope

- Recreating the STEP UI.
- Adding an internal review screen.
- Adding approval states.
- Copying the visual design of the reference screenshots.
- Treating screenshot example copy as factual company data.
