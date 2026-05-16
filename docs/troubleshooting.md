# Troubleshooting

## Goose command not found

Install Goose and ensure it is in PATH.

## Provider not configured

Run:

```bash
goose configure
```

Then choose Gemini, OpenAI/ChatGPT, or Claude/Anthropic depending on available account/API key.

## Recipe parameter error

Goose recipe CLI syntax may differ by version. Check:

```bash
goose run --help
```

Update `scripts/run-homepage-builder.sh` accordingly.

## Generated site missing files

Check whether Goose followed `prompts/goose_homepage_builder.md` and `harness/validation-rules.md`.

Required files:

- content.json
- assets.json
- metadata.json
- page.tsx
- generation-result.json

## Fake claims detected

Remove any invented certifications, awards, history, client names, sales numbers, or products not present in request JSON.

## Product cards generated when products is empty

This is a validation failure. Agent must create product registration CTA instead.
