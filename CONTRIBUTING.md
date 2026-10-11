# Contributing to AFK.exe

Thanks for helping. Small, focused pull requests are easiest to review.

## Setup

```bash
npm install
```

```bash
ollama pull qwen3.5:4b
```

```bash
npm run dev
```

Before you open a PR, run:

```bash
npm run check
```

It runs the typecheck, lint, tests, the license audit and the production build.

## Ground rules

- **Local-first.** Don't add cloud APIs, analytics, remote fonts, CDNs or anything that needs an account or an API key.
- **Open licenses only.** `npm run licenses:check` must pass. Third-party assets need a compatible license and an entry in `ATTRIBUTIONS.md`.
- **Model output is untrusted.** Validate it with a zod schema, render it as text, and never execute it.
- **Rewards must stay idempotent.** Any change to `rewardEngine.ts` or `grantVerifiedReward` needs tests.
- **Outdoor screens stay calm.** Use one sentence, large touch targets and minimal motion. Respect `prefers-reduced-motion`.

## Adding a contract and mission

1. Add the mission and contract to `src/content/contracts.ts`.
   - Each challenge option needs an authored `evaluate()` function that runs deterministic test cases.
   - Each mission needs at least one `urbanFriendly` variant and safety notes.
2. Pick the tool it unlocks in `src/game/levels.ts`.
3. Extend `tests/challenges.test.ts`.

User-facing strings live in `src/content/strings.ts` and `src/content/contracts.ts`.
