# AFK.exe

**Code. Explore. Upgrade.** · *Your workspace grows when you step away.*

AFK.exe is a developer-workspace game. You solve a short coding contract at your desk, then step outside to take a single photo. When you come back, an **open-weight vision model running on your own computer** (Qwen3.5 4B through Ollama) checks the photo. If it passes, a real AI developer tool unlocks, and your virtual studio turns from a cold graphite room into a warm, green workspace.

> Built for the **Hacktoberfest 2026 Open-Source AI Challenge: Week 1, "Touch Grass."**
> No account. No cloud. No API key. Photos and code never leave your devices.

| Before: Level 1, "Cold Start" | After: Level 4, "Living System" |
| --- | --- |
| `docs/media/room-stage-1.png` *(add screenshot)* | `docs/media/room-stage-4.png` *(add screenshot)* |

---

## The loop

1. **Accept a contract.** You get a small, authored client job, for example *"Bug Fix: The Broken Counter"*: an off-by-one error that crashes a progress badge. It takes about 90 seconds.
2. **Fix it.** Pick one of four real fixes. AFK.exe runs authored test cases against your choice and shows the actual outputs, including the real `TypeError`. Grading is deterministic. No LLM grades your code.
3. **Final mission: Touch Grass.** One sentence and one camera button. For example: *"Find something growing through or around a crack — nature repairing a broken system."* Every mission has an easy alternative that works in a city.
4. **Pocket your phone.** The photo is saved on the device, and that works offline.
5. **Verify it locally.** Back at your computer, `qwen3.5:4b` looks at the photo and returns a structured verdict: `matches`, `confidence`, `reason`, `detectedElements`, `needsReview`. AFK.exe validates that verdict before trusting it.
6. **Upgrade.** You get +250 XP and a new level. The room grows plants and catches warmer daylight. A real tool unlocks: the **AI Debugger**, then the **Code Optimizer**, then the **Test Generator**.
7. **Use it.** Paste your own code into the tool. It runs on the same local model, with a task-specific prompt and a validated output schema.

The screen is meant to be the shortest part of the outdoor experience.

## Quick start

**You need:** Node.js 20.19 or newer, and [Ollama](https://ollama.com/download) with the model pulled once. Pulling the model needs internet; nothing after that does.

```bash
ollama pull qwen3.5:4b
```

```bash
npm install
```

```bash
npm run ollama:check
```

```bash
npm run dev
```

Open http://127.0.0.1:5173. If `ollama:check` reports that Ollama is not running, start it with `ollama serve`. On Windows and macOS the desktop app usually runs it already, so check before starting a second server.

### Production / offline build

```bash
npm start
```

This builds the app and serves it at http://127.0.0.1:4173 with a service worker that precaches the app shell, fonts, mission content and the 3D scene.

### Using a phone for the outdoor part

```bash
npm run start:lan
```

1. Open **Explore** on your computer. It shows a QR code for the active mission.
2. Scan the QR code with a phone on the same Wi-Fi. The mission opens on the phone, ready to capture.
3. Take the photo outside. No signal is needed: the photo is stored in the phone's IndexedDB.
4. Back on Wi-Fi, tap **Send to my computer**. The photo arrives on the desk while the Explore page is open there. Verify it there.

If you have no shared Wi-Fi, tap **Export file** on the phone and move the `.afk.json` file by AirDrop, Nearby Share, USB or any other way. Then use **Import photo file** on the computer.

## How the local AI is used

All three AI features use one local model, `qwen3.5:4b` (configurable with `VITE_OLLAMA_MODEL`). They differ in their prompts, schemas and workflows. **The model does not get smarter as you level up.** You just unlock more ways to use it.

| Feature | Ollama call | Output |
| --- | --- | --- |
| Photo verification | `/api/chat` with a base64 photo (downscaled to 640 px), `format` = JSON schema, `temperature: 0` | `{ matches, confidence, reason, detectedElements, needsReview }`, validated with zod |
| AI Debugger | `/api/chat`, JSON schema | issues, fixed code, explanation, verification steps |
| Code Optimizer | `/api/chat`, JSON schema | complexity before/after, suggestions, refactor, caveats |
| Test Generator | `/api/chat`, JSON schema | Vitest file, test cases, assumptions |
| Assistant ("Moss") | `/api/chat`, streamed text | plain-text answers, shown as text nodes |

How model output is handled:

- **Treated as untrusted.** Output is parsed, schema-validated, length-bounded and rendered as text. AFK.exe never uses `innerHTML` and never executes generated code.
- **Conservative reward rule.** A reward needs `matches === true`, a confidence of at least 0.6, and `needsReview === false`. Anything else is put on hold or rejected, with the model's reason shown. Retries are unlimited. AFK.exe never claims the AI can prove *where* or *when* a photo was taken.
- **Honest progress on slow hardware.** On a CPU-only laptop the first request also loads the model, so the UI shows real phases and elapsed time, and every request can be cancelled. Responses are streamed, which deviates from a plain `stream:false` call, purely to make progress visible.

## Offline: what works where

| Situation | What works |
| --- | --- |
| **First visit** | Needs the AFK.exe server (`npm run dev` / `npm start`). Installing the model needs internet once. |
| **Computer, no internet** | Everything works. Ollama and the app are local. |
| **Computer, AFK.exe server stopped** (production build) | The service worker serves the cached app shell. Contracts, missions, capture and saved progress still work. The AI badge correctly reads *Local AI offline*. |
| **Phone outdoors, no signal** | An already-open mission page keeps working. Photos are saved to IndexedDB and labelled *"Saved offline — verify when you return to your computer."* |
| **Phone back on Wi-Fi** | *Send to my computer* (same-LAN inbox), or *Export file*. |
| **Phone over plain-HTTP LAN** | Service workers need HTTPS or localhost, so a **phone cannot reload the app from scratch without the network**. Keep the mission tab open, or serve AFK.exe over HTTPS on your LAN. Photos stored in IndexedDB survive either way. |

The phone **never** runs the model, and it cannot reach Ollama. The adapter refuses every non-loopback request to the model API. IndexedDB does not sync between devices by itself: transfer is explicit, either the LAN inbox or a file.

## Privacy and security

- No accounts, analytics, trackers, CDNs, remote fonts or cloud APIs. Fonts (Inter and JetBrains Mono, OFL-1.1) and icons (Lucide, ISC) are bundled.
- **Local adapter** (`server/localAdapter.ts`), mounted into the Vite dev and preview servers:
  - Binds to `127.0.0.1` by default.
  - Allows only `GET /api/version`, `GET /api/tags`, `POST /api/show` and `POST /api/chat`, and only from loopback clients. `pull` and `delete` are refused even from localhost.
  - Checks that the request's Origin matches the server. It sends no CORS headers.
  - Caps request bodies at 16 MB.
- **LAN inbox** (opt-in with `start:lan`): needs a random per-process pairing token that is shown only in the desk's QR code. It accepts only JSON, holds at most 24 items in memory, never writes to disk, and validates everything again with zod before storing it.
- **Photos:** JPEG, PNG or WebP only, 25 MB max. They are re-encoded through a canvas on capture, which strips EXIF data, including GPS.
- **Your data:** the Settings drawer has export backup, import and **Delete all data**.

## Architecture

```
src/
  ai/          ollamaClient · missionVerifier · developerAssistant · schemas (zod) · image
  app/         GameContext (state + orchestration) · AIStatusContext · preferences · sound
  components/  AppShell · LocalAIStatus · SettingsPanel · Onboarding · RewardReveal · CodeBlock
               PhotoCapture · EvidenceCard · PhonePairing · CodeTools · AssistantChat
  content/     contracts.ts (authored contracts, deterministic fixtures, missions) · strings.ts
  game/        rewardEngine (pure, idempotent) · levels · types
  pages/       Workspace · Contract · Explore · Companion
  scene/       LivingWorkspaceScene (R3F, lazy) · RoomIllustration (SVG fallback) · WorkspaceStage
  storage/     db (idb) · gamePersistence · transfer (export/import, zod)
server/        localAdapter (Ollama proxy + LAN inbox) · serviceWorkerPlugin (precache manifest)
tests/         challenges · rewardEngine · verification · persistence (fake-indexeddb) · transfer
```

Details are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on 127.0.0.1:5173 |
| `npm start` | Production build + preview on 127.0.0.1:4173, with offline cache |
| `npm run start:lan` | The same, reachable from phones on your Wi-Fi. The model stays loopback-only. |
| `npm test` | Vitest: challenges, reward idempotency, AI-output parsing, IndexedDB, imports |
| `npm run typecheck` / `npm run lint` | `tsc -b` / oxlint |
| `npm run check` | Typecheck + lint + tests + license audit + build |
| `npm run ollama:check` | Is Ollama running and is the model installed? |
| `npm run licenses:check` | Fails if any dependency is not under an approved open-source license |

## Design notes and trade-offs

- **3D, then a fallback.** The workspace is a single procedural React Three Fiber diorama: no downloaded models, no HDRs. It is lazy-loaded, so the app shell paints immediately. A layered SVG version of the same four stages is shown while the scene loads, when WebGL is missing, and if the scene errors. The scene never blanks the product.
- **Deterministic coding checks.** Challenge answers are authored fixtures run in the browser. Nothing a user types is executed.
- **One model, honest framing.** "Unlocking" a tool unlocks a validated workflow on the same 4B model. It does not mean a smarter model or faster hardware.
- **Lint.** The scaffold shipped with oxlint (an ESLint-compatible linter written in Rust), and it is kept in place of ESLint.

## Limitations (known)

- **Speed depends on your hardware.** On the CPU-only development laptop (Intel Core Ultra 7 155U, no discrete GPU), a warm photo check took about 12–35 s, the first request about 3 minutes (model load), and a Debugger run about 60 s.
- **The vision model is strict.** In testing it rejected digital art, an abstract render and a three-panel collage, and it put a distant forest shot on hold until the inclusive variant was used. A real outdoor field test has **not** been done yet. See the checklist.
- **The game state is not tamper-proof.** Local rewards prevent accidental double claims. They are not a security boundary.
- **Phones on plain HTTP cannot reload the app offline** (see the offline table above).
- **iOS Safari:** `capture="environment"` opens the camera. Native share needs iOS 15+. This has not been tested on a physical iPhone.

## Roadmap

- Trusted HTTPS on the LAN, so phones get full offline PWA reloads.
- More contracts in more languages, and community-authored missions.
- An optional choice of model (any Ollama vision model).
- Sync of progress back to the phone.

## Acknowledgements and license

The original code is under the [MIT](LICENSE) license. Third-party software, fonts, icons and the model keep their own licenses: see [ATTRIBUTIONS.md](ATTRIBUTIONS.md). The **Qwen3.5 4B** weights are Apache-2.0 (from the license bundled with the Ollama model, `ollama show qwen3.5:4b --license`).

**Project timeline:** the repository was created on 2026-10-11, inside the challenge window (October 5–11, 2026). Any commit made after the deadline will be listed here.
