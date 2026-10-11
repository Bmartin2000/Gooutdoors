# AFK.exe

**Code. Explore. Upgrade.** · *Your workspace grows when you step away.*

You sit at a desk in a small 3D office, and the whole game runs on the computer in front of you. Client jobs arrive in your inbox every hour. You take the ones you're qualified for, ship the fix and get paid. Every job uses up energy, and the only way to fill it back up is to **go outside**. Your phone measures the walk with GPS, offline, and buzzes when a photo mission appears. When you get back, an **open-weight AI running on your own computer** (Qwen3.5 4B through Ollama) checks the photo. Fresh air buys the plants that make your office come alive.

> Built for the **Hacktoberfest 2026 Open-Source AI Challenge: Week 1, "Touch Grass."**
> No account. No cloud. No API key. Photos, code and location never leave your devices.

| At the desk | Outside |
| --- | --- |
| `docs/media/desk.png` *(add screenshot)* | `docs/media/walk.png` *(add screenshot)* |

---

## How it plays

**At the desk** (your computer, which runs Ollama)

- **Inbox.** A new client offer arrives every hour, and **Moss** (your robot with a plant growing from its head) turns to you and tells you about it. Half the offers are **freshly generated** (new app, story, names and test data each time), and one **Today's contract** each day pays 1.5×. You can set it to every 20 minutes, or every 2 minutes for a demo. You get an in-game chime, plus a desktop notification if the tab is in the background.
- **Requirements.** Each job needs certain skills and a level, for example *Debugging 2*, *TypeScript 1* or *Level 2*. Jobs you can't take yet stay visible, show what's missing, and tell you which skill to train. You take other jobs you're qualified for in the meantime.
- **Work.** A real, short coding task: an off-by-one error, a type guard that lies, `async` inside `forEach`, a quadratic duplicate check, a flaky float assertion and more (10 tasks across 5 skills).
  - You get **two submissions**. Every option is run against authored test cases and you see the real outputs.
  - You can spend **one 🌿 token on a hint**, which removes a wrong option.
- **Pay.** Each job gives money, XP and skill points. Money buys gear for the office: a lamp, coffee, headphones, a poster, a second monitor.
- **Energy.** Every job costs 25–45 energy. Energy refills slowly at the desk (+8 per hour) and **fully with one verified walk**.
- **Tools.** Levels unlock real AI tools that run on the local model: AI Debugger (level 2), Code Optimizer (level 3), Test Generator (level 4). The Assistant is always available.
- **Look around.** Click the eye icon to get up from the desk and see how your office has grown.

**Outside** (your phone)

1. Open the phone app (installed, or via the same-Wi-Fi QR code), tap **Start walk** and pocket the phone.
2. A **walk counts** after 10 minutes and 150 m from where you started, measured with GPS.
   - GPS needs no internet.
   - Fixes worse than ±50 m are ignored, and jumps faster than 12 m/s are rejected.
   - The distance must also clearly exceed the GPS noise at your starting point.
3. The phone **vibrates when a photo mission appears**, for example *"Find something growing through a crack."* Take one photo, then pocket the phone again.
4. **Pocket mode** keeps the screen on (black, minimal light) so tracking and buzzes keep working.
5. Back home, tap **Send to my desk** (same Wi-Fi) or **Share with my desk** (a file by AirDrop or Nearby Share).
6. The desk credits the walk once: **energy back to 100, 🌿 tokens and XP.** No task is required. Just going out counts.
7. The local AI checks the photo for bonus 🌿. Tokens buy plants: seedling, monstera, pothos, moss rug, vines and a fig. Plants warm the daylight in the room.

## Quick start

**You need:** Node.js 20.19 or newer, and [Ollama](https://ollama.com/download) with the model pulled once. Pulling the model needs internet; nothing after that does.

```bash
ollama pull qwen3.5:4b
```

```bash
npm install
```

```bash
npm run dev
```

Open http://127.0.0.1:5173 and sit down at the desk. Check the AI with `npm run ollama:check`. If Ollama isn't running, start it with `ollama serve`.

### Phone app: install it (recommended)

Open **https://bmartin2000.github.io/Gooutdoors/outside** on your phone, or scan the "Install the phone app" QR code in AFK OS › Outside. Then use your browser's **Add to Home screen**.

- It's a static, open-source PWA served over real HTTPS, so there's no certificate warning.
- After the first load it works fully **offline**: GPS walks, mission vibration, photos, storage.
- After a walk, tap **Share with my desk** (AirDrop, Nearby Share, or e-mail to yourself). On the desk, open Outside › **Import outing file**.
- The hosted app never talks to any server. It contains no AI, and nothing is uploaded.

### Phone on the same Wi-Fi (sends walks straight to the desk)

```bash
npm run start:lan
```

- This builds the app and serves it on your Wi-Fi over **HTTPS**, using a certificate generated on your computer by `@vitejs/plugin-basic-ssl`.
- Phones only allow GPS on secure pages, which is why HTTPS is needed. **The phone shows a certificate warning once.** That's expected: it's your own computer's certificate, and no outside service is involved.
- The model API still answers **only** to the computer itself.

Open the desk on that computer at https://127.0.0.1:4173. Accept the warning once, then open **Outside** and scan the QR code with your phone.

### Optional local admin (testing only)

```bash
AFK_ADMIN_PASSWORD='your-password' node scripts/set-admin.mjs your-username
```

- This writes a **salted hash** (never the password) to the git-ignored `.env.local`. Restart `npm run dev` afterwards.
- The desk then shows a sign-in screen. A guest can still continue without signing in.
- Signed in as admin, the OS gets an **Admin** app that can:
  - skip a walk
  - approve waiting photos without the AI check
  - complete the active job
  - refill energy, level up, or add tokens and money
- **Every override is logged as "Admin override"** in the activity feed.
- The public phone-app build compiles admin out entirely.
- This is a local convenience gate, not security.

## Local AI: what it does and doesn't do

| Feature | Local model call | Guard rails |
| --- | --- | --- |
| Photo missions | `qwen3.5:4b` vision via `/api/chat`, JSON schema, `temperature: 0`, photo downscaled to 640 px | The answer is zod-validated. A reward needs `matches`, confidence ≥ 0.6 and no review flag. Otherwise it is held, with the reason shown and unlimited retries. |
| AI Debugger, Code Optimizer, Test Generator | `/api/chat` with task prompts and JSON schemas | Input is capped and treated as untrusted. Output is shown as text and never executed. |
| Assistant | `/api/chat`, streamed text | Plain text |

**What it doesn't do:**

- There is **one model.** Levels unlock workflows, not a smarter model.
- **Coding jobs are not graded by AI.** Answers are checked deterministically against authored fixtures.
- **AI does not check walks.** GPS math does, on the phone.

## Offline and privacy

| Where | Works offline | What leaves the device |
| --- | --- | --- |
| Phone during a walk | GPS tracking, mission buzz, photo capture, storage | Nothing |
| Phone → desk | LAN inbox (same Wi-Fi, pairing token) or a file | Walk **summary only** (minutes, metres, fix count), plus photos re-encoded without EXIF. **No coordinates.** |
| Desk | Everything: Ollama and the app are local | Nothing. There are no analytics, CDNs or cloud APIs. |

**Limits worth stating plainly:**

- **No push service, so notifications only fire while AFK.exe is open.** Background tabs are fine. Offers that arrive while the app is closed are waiting when you return.
- **Browsers pause GPS when the screen is off.** Pocket mode keeps it on. Otherwise the phone takes a new fix whenever you look at it.
- **On the same-Wi-Fi path, the phone's service worker won't install over the self-signed certificate.** Keep the Outside tab open during a walk; walks and photos are stored on the phone either way. **The installed phone app (GitHub Pages) has no such limit.**
- **This is a game, not proof.** GPS can be spoofed and a photo can't prove place or time. AFK.exe checks plausibility and never claims more.
- **Vibration works on Android.** iOS Safari ignores `navigator.vibrate`, so there the chime and the screen are the signal.

## Architecture

```
src/
  desk/        DeskPage (3D office + OS placement) · OS (menu bar, dock) · apps/ Inbox Work Outside Shop Skills Tools
  outside/     OutsidePage (phone) · useWalk (GPS, wake lock, mission prompt, vibration)
  scene/       OfficeScene: procedural R3F room, first-person + room views, screen projection
  game/        economy (jobs, skills, energy, rewards) · location (GPS verification) · levels · types
  content/     challenges (10 authored jobs) · generators (endless procedural jobs) · missions · shop
  ai/          ollamaClient · missionVerifier · developerAssistant · schemas (zod) · image
  storage/     db (idb v2) · gamePersistence (grantOnce: one transaction per reward) · transfer (outing/backup)
server/        localAdapter (loopback-only Ollama proxy + LAN inbox) · serviceWorkerPlugin
tests/         challenges · generators · economy · location · persistence · transfer · verification (68 tests)
```

More detail is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Desk on 127.0.0.1:5173 |
| `npm start` | Production build on 127.0.0.1:4173, with an offline cache |
| `npm run start:lan` | The same over local HTTPS on your Wi-Fi, so phones can walk with GPS |
| `npm run build:pages` | Static phone-app build for GitHub Pages (deployed by `.github/workflows/pages.yml`) |
| `npm test` | 68 unit tests |
| `npm run check` | Typecheck, lint, tests, license audit and build |
| `npm run ollama:check` / `npm run licenses:check` | Is the model ready? / Are all dependencies open source? |

## Licenses

The code is [MIT](LICENSE). Third-party licenses, including the Apache-2.0 Qwen3.5 weights, are listed in [ATTRIBUTIONS.md](ATTRIBUTIONS.md).

**Project timeline:** the repository was created on 2026-10-11, inside the challenge window (October 5–11, 2026). Any commit made after the deadline will be listed here.
