# AFK.exe architecture

AFK.exe is a static React app with a tiny local Node adapter. It has no backend database and no cloud services. All state lives in the browser's IndexedDB, and all inference runs in Ollama on the user's computer.

```
 Phone (capture device)                 Computer (AI host)
 ┌───────────────────────┐   LAN inbox  ┌──────────────────────────────────────────┐
 │ React app (same build)│ ───────────▶ │ Vite dev/preview server (127.0.0.1)       │
 │ IndexedDB: photos     │  or .afk.json │  ├─ static app + /sw.js                  │
 │ no model access (403) │   file        │  ├─ /ollama/*  → allow-listed, loopback  │──▶ Ollama :11434
 └───────────────────────┘               │  └─ /afk-sync/* (token) · /afk-local/*   │     qwen3.5:4b
                                         │ React app · IndexedDB: profile, rewards  │
                                         └──────────────────────────────────────────┘
```

## Frontend

- **Stack:** Vite 8, React 19, TypeScript (strict, `tsc -b`), React Router 7, three.js with @react-three/fiber and drei, zod, idb, lucide-react, and self-hosted Inter and JetBrains Mono.
- **Routes:**
  - `/` Workspace
  - `/contracts/:id` coding challenge
  - `/explore` outdoor mission, phone-first
  - `/companion` the toolkit

  Settings is a drawer, not a route.
- **State:**
  - `GameProvider` owns the profile, settings, evidence, reward reveal and toasts.
  - Every profile change goes through `updateProfile(fn)`, which reads the latest value from a ref. This prevents stale closures, for example finishing onboarding and then starting a contract in the same tick.
  - `AIStatusProvider` polls diagnostics every 20 s while the tab is visible, and again on `online`/`offline`. It can warm the model up ahead of time (an empty `/api/chat` call with `keep_alive`).
- **Styling:** plain CSS with design tokens (`src/styles/tokens.css`). There are two themes, Graphite (dark) and Paper (light), plus a reduced-motion mode. Components never use raw hex colours, apart from the 3D palettes.

## Game rules (`src/game/rewardEngine.ts`)

These are pure functions with full unit-test coverage.

- **Contract status:** `locked → available → coding → mission → completed`.
- **`submitChallenge`** compares the chosen option with the authored `correctChoiceId`. The displayed test results come from authored `evaluate()` functions in `src/content/contracts.ts`. These are faithful re-implementations of each option, including the real `TypeError` for reading past the array's end. No user or model code is ever executed.
- **`applyReward`** grants a reward only when the contract is at the `mission` stage and its completion key (`contract:<id>:mission`) is absent. It also refuses if the profile already lists the contract as completed, which covers the case where the rewards store was lost.

## Persistence (`src/storage`)

- IndexedDB `afk-exe` v1 has three stores: `kv` (profile, settings, field mission), `evidence` (photo blobs plus metadata) and `rewards` (keyed by completion key).
- **`grantVerifiedReward`** does three things in **one readwrite transaction** across `kv`, `rewards` and `evidence`: it reads the profile and existing keys, applies the reward, and marks the evidence as verified. Two concurrent calls, a reload, or a second photo cannot grant twice. This is tested with fake-indexeddb.
- Photos stuck in `verifying` when the page closed are re-queued as `saved-for-later` on the next load.
- **Transfer formats**, both zod-validated on import:
  - `afk.exe/evidence` v1: one photo plus its mission metadata.
  - `afk.exe/backup` v1: everything.

## Local AI

- **`ai/ollamaClient.ts`:**
  - Uses same-origin `/ollama` only.
  - Streams `/api/chat` with `think: false` and `keep_alive: 20m`.
  - Maps failures to typed error codes: `unreachable`, `remote-device`, `model-missing`, `timeout`, `aborted`, `server`, `bad-response`.
  - Combines the caller's `AbortSignal` with a timeout.
  - **Why streaming:** Ollama sends response headers only at the first token. Streaming keeps the connection healthy during long CPU prompt evaluation and gives honest "reading" and "writing" phases.
- **`ai/missionVerifier.ts`:**
  - Downscales the photo to 640 px on its longest side.
  - Sends a system prompt plus a mission-specific prompt (it ignores text inside images, does not infer location, and flags uncertain photos for review) with `format` set to a JSON schema and `temperature: 0`.
  - `decide()` only returns `verified` for `matches && confidence ≥ 0.6 && !needsReview`.
- **`ai/schemas.ts`:**
  - Has tolerant parsing: it strips `<think>` blocks and fences and scans for balanced braces.
  - Coerces percentages and string booleans, clamps and truncates values, and rejects anything it can't validate.
- **`ai/developerAssistant.ts`:** the Debugger, Optimizer and Test Generator. Each has a task prompt and its own JSON schema. Code input is capped at 12,000 characters and context at 1,500. The prompt tells the model that the code is untrusted input. Nothing is ever executed.

Verified states shown to the user:

| Group | States |
| --- | --- |
| Connection | `ready`, `ollama-unavailable`, `model-missing`, `remote-device` (`checking` while loading) |
| Photo evidence | `saved-for-later`, `verifying`, `verified`, `needs-review`, `rejected`, `verification-failed` |

## Local adapter (`server/localAdapter.ts`)

This is a Connect middleware registered for both `vite` (dev) and `vite preview`.

| Route | Who may call | Purpose |
| --- | --- | --- |
| `GET /ollama/api/version`, `GET /ollama/api/tags`, `POST /ollama/api/show`, `POST /ollama/api/chat` | loopback + same Origin | Proxy to `OLLAMA_HOST`. 16 MB body cap. Upstream is cancelled when the browser aborts. |
| any other `/ollama/*` | nobody | 404 `route-not-allowed` |
| `GET /afk-local/pairing` | loopback | Pairing token + LAN URLs (only when started with `--host`) |
| `POST /afk-sync/evidence?token=` | LAN, same Origin, valid token | JSON only, 12 MB cap, in memory, max 24 items |
| `GET /afk-sync/inbox`, `POST /afk-sync/inbox/ack` | loopback | The desk app pulls items every 4 s while visible |

## Offline (`server/serviceWorkerPlugin.ts`, `src/pwa/registerSW.ts`)

- At build time the plugin emits `/sw.js` with an explicit precache list of every bundled asset: the shell, CSS, both JS chunks (including the 3D scene), every font file, the manifest and the icons.
- Its cache name is a hash of the worker source.
- Navigation requests are network-first, falling back to the cached `index.html`. Assets are cache-first, using `ignoreVary` because Vite's preview sends `Vary: Origin`.
- `/ollama`, `/afk-local` and `/afk-sync` are never cached.
- The worker is registered only in production and only in secure contexts. On phones over plain-HTTP LAN it is not available, as documented in the README.

## Testing

| Suite | Covers |
| --- | --- |
| `challenges.test.ts` | Every contract has exactly one correct option, every wrong option fails at least one check (except the deliberate "passes but O(n²)" lesson), the real TypeError is reproduced, the leap-year probe, and missions have safe alternatives |
| `rewardEngine.test.ts` | Flow, idempotency, refusal before the coding step, level thresholds |
| `verification.test.ts` | Model-output parsing (fences, `<think>`, coercions, bounds, rejections), decision rule, Debugger schema |
| `persistence.test.ts` | IndexedDB transaction grants once under concurrent calls and survives a simulated reload |
| `transfer.test.ts` | Import validation rejects unknown contracts, bad dates, SVG, non-base64 data and impossible profiles |

Manual and end-to-end checks with the live model are listed in [FINAL_SUBMISSION_CHECKLIST.md](FINAL_SUBMISSION_CHECKLIST.md).

## A bug worth noting

The production build crashed when leaving the Companion page. The cause was an effect written as an arrow expression: `useEffect(() => el.scrollIntoView(...), [deps])`. In the current Chrome, `scrollIntoView()` returns a Promise, so React received a non-function "cleanup" and threw on unmount. All effects now use block bodies.
