# Goose Setup Notes

## Goal

Goose는 무료/오픈소스 Coding Agent 실행기로 사용한다. 모델은 Gemini, ChatGPT/OpenAI, Claude/Anthropic 중 하나를 연결한다.

## Suggested Provider Order

1. Gemini: 비용 최소 PoC
2. ChatGPT/OpenAI: 코드 생성 품질 보강
3. Claude/Anthropic: 복잡한 수정/빌드 실패 복구

## Expected Flow

```bash
goose configure
```

Configure provider, then run:

```bash
bash scripts/run-homepage-builder.sh requests/sample-company-intro.json
```

The runner behaves as follows:

- `GOOSE_MODE=auto` default: if `goose` is available, it attempts `recipes/homepage-builder.recipe.yaml`; otherwise it uses the deterministic local MVP generator.
- `GOOSE_MODE=local`: always uses the deterministic local MVP generator.
- `GOOSE_MODE=required`: fails immediately if `goose` is not available.
- In both cases, the same validation/build harness is used before final status is written.

Check local Goose availability and CLI syntax:

```bash
npm run goose:check
npm run goose:preflight
```

Force a Goose-only run:

```bash
GOOSE_MODE=required bash scripts/run-homepage-builder.sh requests/sample-company-intro.json
```

`GOOSE_MODE=required` is the harness runner mode. The Goose CLI also has a `GOOSE_MODE` environment variable for tool permission behavior, so this repo calls Goose through `scripts/run-goose-homepage-recipe.sh` and maps the Goose tool mode to `GOOSE_TOOL_MODE` instead. The default is:

```bash
GOOSE_TOOL_MODE=auto
```

If no provider/model is configured, run:

```bash
goose configure
```

Or pass provider/model env vars explicitly:

```bash
GOOSE_PROVIDER=openai GOOSE_MODEL=gpt-4.1 GOOSE_MODE=required bash scripts/run-homepage-builder.sh requests/sample-company-intro.json
```

Once provider configuration is complete, use the Goose-only E2E wrapper:

```bash
npm run goose:e2e -- requests/sample-company-intro.json
```

Force local deterministic generation:

```bash
GOOSE_MODE=local bash scripts/run-homepage-builder.sh requests/sample-company-intro.json
```

If the recipe parameter syntax differs in your Goose version, run:

```bash
goose run --help
goose recipe --help
```

Then update `scripts/run-homepage-builder.sh` accordingly.

After setup, verify the full contract:

```bash
npm run test:harness
```
