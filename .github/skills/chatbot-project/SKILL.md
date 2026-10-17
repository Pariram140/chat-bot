---
name: chatbot-project
description: Project-specific guidance for working on this Spring Boot + Gemini chatbot, including architecture, testing, UI, configuration, and deployment.
---

# Chatbot project skill

Use this skill whenever changing or reviewing this repository.

## Project shape

- Java 17 and Spring Boot backend.
- Static browser UI lives in `src/main/resources/static/` (`index.html`, `styles.css`, `app.js`).
- `POST /chat` accepts `{ "content": "..." }` and returns a JSON `response` on success.
- `ChatGPTService` calls the Gemini Developer API. Configuration is server-side through `GEMINI_API_KEY` and optional `GEMINI_MODEL`.
- Deployment is configured for Render using the repository's Docker/Render files.
- Architecture details: [`docs/architecture.md`](../../../docs/architecture.md).
- Figma UI reference: [Chatbot — UI Design](https://www.figma.com/design/pfIAnz6ffMbZtdpjxyBtPY).

## Working rules

1. Never commit API keys, tokens, or other secrets. Do not expose `GEMINI_API_KEY` in frontend code.
2. Preserve Java 17 compatibility and follow existing Spring Boot patterns.
3. Validate request input and preserve clear HTTP error semantics: invalid input is 400; upstream/configuration AI errors are 502.
4. The frontend currently sends only the current message, not conversation history. Do not claim multi-turn context is implemented unless it has been added and tested.
5. Keep the UI responsive and accessible: semantic controls, labels for inputs, visible error feedback, and keyboard-friendly interactions.
6. For frontend behavior, add or update Playwright tests under `tests/e2e/`. Mock `/chat` for deterministic UI tests; do not call Gemini from CI.
7. Before finishing a change, run relevant tests and check GitHub Actions status for the branch/PR. Do not claim CI passed without verifying the latest run.
8. If changing configuration or deployment, update the architecture docs and README as needed. Keep Render secrets in the Render dashboard.
9. Treat the Figma file as the UI reference; keep the Figma link and a committed design screenshot/reference synchronized when the design changes.

## Verification checklist

- [ ] `mvn --batch-mode --no-transfer-progress verify`
- [ ] If UI behavior changed: `npm run test:e2e`
- [ ] Review responsive desktop/mobile layout and error/loading states
- [ ] Confirm CI status before merging
