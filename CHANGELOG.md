# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.2.2](https://github.com/lpenguin/openai-image-mcp/compare/v1.2.0...v1.2.2) (2026-04-24)

## [1.2.0](https://github.com/lpenguin/openai-image-mcp/compare/v1.1.3...v1.2.0) (2026-04-24)


### Features

* add gpt-image-2 support with standard and thinking-mode tools ([#9](https://github.com/lpenguin/openai-image-mcp/issues/9)) ([f149293](https://github.com/lpenguin/openai-image-mcp/commit/f149293ef80bccb520976d3d2f4fe6ea6d629dcd))

## [1.2.0-gpt2.0] (2026-04-22)

### Features

* add `generate_image_gpt2` tool for OpenAI's gpt-image-2 model (released 2026-04-21)
* add `generate_image_gpt2_thinking` tool exposing the new reasoning-aware "thinking" mode (low/medium/high tiers)
* add `GptImage2Options` type, `isGptImage2Options` discriminator, and `buildGptImage2Params` builder following the existing model-specific pattern
* integration test roster updated to include the two new tools

### Notes

* gpt-image-2 supports flexible resolutions up to 3840px per edge (edges multiples of 16, aspect <=3:1, 655,360-8,294,400 total pixels) and batches of up to 10 images
* `transparent` background is not supported on gpt-image-2 per current docs; schema restricts to `opaque`/`auto`
* The `thinking` parameter shape (`"low" | "medium" | "high"`) is taken from public 2.0 launch coverage; if OpenAI's official API reference diverges, update `buildGptImage2Params` accordingly

### [1.1.3](https://github.com/lpenguin/openai-image-mcp/compare/v1.1.2...v1.1.3) (2025-11-16)


### Bug Fixes

* exclude openai responce from the output ([1b5a010](https://github.com/lpenguin/openai-image-mcp/commit/1b5a010504398a7dccc40962e7c4b401e1286dc8))

### [1.1.2](https://github.com/lpenguin/openai-image-mcp/compare/v1.1.1...v1.1.2) (2025-11-12)

### [1.1.1](https://github.com/lpenguin/openai-image-mcp/compare/v1.1.0...v1.1.1) (2025-11-11)


### Bug Fixes

* update .gitignore and remove mcp.json configuration ([5f7d739](https://github.com/lpenguin/openai-image-mcp/commit/5f7d739bb6e5f696769d58d90557a7480d972088))

## 1.1.0 (2025-11-11)


### Features

* add output parameter and full model-specific parameter support ([1c1b83d](https://github.com/lpenguin/openai-image-mcp/commit/1c1b83dbddfd459716dc401b9437e3b8ea10ca83))
* update README and server to support multiple image generation tools with enhanced parameters ([d1004ed](https://github.com/lpenguin/openai-image-mcp/commit/d1004edae5797a6ff53bfa2328df49499aedcd7e))
