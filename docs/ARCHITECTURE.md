# AFK.exe architecture

AFK.exe is a static React app with a tiny local Node adapter. It has no backend database and no cloud services. Game state lives in IndexedDB. The desk computer runs Ollama. The phone only measures walks and takes photos.

```
 Phone (Outside)                               Computer (Desk)
 ┌──────────────────────────────┐  LAN inbox   ┌────────────────────────────────────────────┐
 │ GPS walk (offline, on-device)│ ───────────▶ │ Vite dev/preview (127.0.0.1, or HTTPS on   │
 │ photo capture, IndexedDB     │  or .afk.json │ LAN with a local self-signed certificate)  │
 │ shares: minutes, metres,     │   file        │  ├─ /ollama/*  allow-listed, loopback only │──▶ Ollama :11434
 │ fixes, photos (no coords)    │               │  └─ /afk-sync/* token · /afk-local/*       │    qwen3.5:4b
 └──────────────────────────────┘               │ First-person 3D office + AFK OS (DOM)     │
                                                └────────────────────────────────────────────┘
```

## The office (`src/desk`, `src/scene/OfficeScene.tsx`)

- **The room:** one procedural React Three Fiber room: desk, monitor, Moss the robot, a window, and shop items that grow in. There are no downloaded models or textures.
- **Camera views:**
  - `desk`: seated, first person, looking at the monitor.
  - `room`: an isometric overview, used by "Look around".
- **Placing the OS on the monitor:**
  - Each frame, the camera rig projects the monitor screen's four corners to CSS pixels.
  - **AFK OS is real DOM** positioned on that rectangle, so it stays crisp and accessible to keyboard and screen readers.
  - Below 900 × 690 px, or without WebGL, the OS goes full-screen over a dimmed room.
  - The scene is lazy-loaded and wrapped in an error boundary, so it can never blank the product.
- **Room lighting:** daylight warmth comes from the number of plants owned (four stages).

## Game rules (`src/game/economy.ts`)

These are pure, unit-tested functions.

- **Board:**
  - `refreshBoard` adds one offer per elapsed interval (60, 20 or 2 minutes), up to 5 offers, and expires stale ones.
  - `pickChallenge` prefers unfinished work: about 65% offers you can take now, the rest stretch goals you can't take yet.
- **Eligibility:** level ≥ `minLevel`, plus each required skill level. Skill levels come from points at thresholds 1, 3, 6 and 10. Jobs train the skills they use, by their difficulty.
- **Accepting a job:**
  - Energy must be at least the job's cost, and only one job can be active at a time.
  - You get two submissions. A hint costs 1 🌿 and removes one wrong option.
  - Success pays money, XP and skill points. Two misses cancel the job.
- **Energy:** passive regeneration of +8 per hour. `applyWalk` sets it to 100.
- **Rewards:** every reward has a ledger key.
  - `job:<offerId>`
  - `walk:<walkId>`
  - `photo:walk:<walkId>`: at most one photo reward per walk, or one per mission per day for photos taken outside a walk.

## Walk verification (`src/game/location.ts`, `src/outside/useWalk.ts`)

- **Tracking:** `watchPosition` with `enableHighAccuracy`. GNSS needs no network.
- **Fix filtering:**
  - Fixes with accuracy worse than 50 m are rejected.
  - A jump faster than 12 m/s that also exceeds both fixes' accuracy is rejected as a teleport.
- **`summarize`:**
  - `durationMin` runs from the start to the **last accepted fix**, so time without position evidence doesn't count.
  - `maxDistanceM` is measured from the first fix.
  - **Verified** means:
    - at least 3 fixes
    - duration ≥ 10 min
    - max distance ≥ max(150 m, 2 × the starting fix's accuracy)
  - Demo thresholds (2 min / 30 m) can be switched on at the desk and are always labelled as such.
- **On the phone:**
  - A mission prompt fires after 4 minutes or 120 m, with vibration `[300,150,300,150,600]` and a chime.
  - Pocket mode uses the Wake Lock API, because browsers pause GPS when the screen is off.
  - A new fix is taken whenever the page becomes visible again.
- **What is shared:** only `WalkSummary` leaves the phone. On import the desk checks it again with zod (`consistentWalk`): a "verified" walk must actually meet the thresholds it carries, and those thresholds can't be below the demo minimum.

## Local AI (`src/ai`)

- **`ollamaClient`:**
  - Uses same-origin `/ollama` only.
  - Streams `/api/chat` with `think: false` and `keep_alive`.
  - Maps failures to typed errors.
  - Combines the caller's AbortSignal with a timeout.
  - Streaming keeps long CPU prompt evaluation alive and shows real progress.
- **`missionVerifier`:**
  - Downscales the photo to 640 px and uses `temperature: 0` and a JSON schema.
  - The prompt tells the model to ignore any text inside the image and not to infer location, and to flag uncertain photos for review.
  - `decide()` rewards only `matches && confidence ≥ 0.6 && !needsReview`.
- **`developerAssistant`:** the Debugger, Optimizer and Test Generator, each with its own task prompt and schema. Code is capped at 12,000 characters, treated as untrusted, and never executed.

## Persistence (`src/storage`)

- **IndexedDB `afk-exe` v2:**
  - `kv`: profile, settings, phone pairing
  - `evidence`: photos
  - `ledger`: granted rewards
  - `walks`: phone-only, holds coordinates
- **`grantOnce(compute, evidencePatch?)`:**
  - Runs **one readwrite transaction** over profile, ledger and evidence, and the callback sees every granted key.
  - In the UI, every profile change goes through a serialized queue and this function. Concurrent clicks, a background ticker, LAN imports and reloads can't race or double-grant.
- **Transfer formats**, both zod-validated:
  - `afk.exe/outing` v1: walk summary plus photos.
  - `afk.exe/backup` v2.

## Local adapter (`server/localAdapter.ts`)

| Route | Who may call | Purpose |
| --- | --- | --- |
| `GET /ollama/api/version`, `GET /ollama/api/tags`, `POST /ollama/api/show`, `POST /ollama/api/chat` | loopback + same Origin | Proxy to Ollama. 16 MB body cap. Upstream is cancelled when the browser aborts. |
| any other `/ollama/*` | nobody | 404 |
| `GET /afk-local/pairing` | loopback | Token + `https://` LAN URLs when started with `--host` |
| `POST /afk-sync/evidence?token=` | LAN, same Origin, valid token | JSON outing only, 12 MB cap, in memory, max 24 items |
| `GET /afk-sync/inbox`, `POST /afk-sync/inbox/ack` | loopback | The desk pulls items every 4 s while visible |

`npm run start:lan` runs `vite preview --host 0.0.0.0 --mode lan`. In that mode `@vitejs/plugin-basic-ssl` generates a self-signed certificate locally (offline), because phones expose GPS, wake lock and vibration only on secure origins.

## Signals (`src/app/notify.ts`)

- In-OS toasts and a soft synthesized chime (no audio files).
- The Notification API when the desk tab is hidden and permission was granted. It uses the service worker registration when one exists (production on localhost), otherwise `new Notification`.
- `navigator.vibrate` on the phone (Android; iOS ignores it).
- There is no push service, so nothing can wake a closed app. This is stated in the UI.

## Testing (58 tests)

| Suite | Covers |
| --- | --- |
| `challenges` | Every job's correct option passes; every wrong option fails at least one check (except the deliberate "passes but O(n²)" lesson); real runtime behaviour (TypeError, unawaited promises) |
| `economy` | Board arrivals and expiry, skill/level locks, energy cost and regeneration, one-time payment, hint, two-strike cancel, walk and photo rewards once, shop currencies and levels |
| `location` | Haversine distance, a real walk verifies, staying home doesn't, a short dash doesn't, inaccurate and teleport fixes rejected, noise floor, time counted only while fixes arrive |
| `persistence` | `grantOnce` with concurrent calls and a simulated reload; a photo reward plus evidence update in one transaction |
| `transfer` | Outing import rejects unknown missions, SVG, non-base64 data, inconsistent "verified" walks; outings contain no coordinates |
| `verification` | Parsing of model output (fences, `<think>`, coercions, bounds) and the decision rule |
