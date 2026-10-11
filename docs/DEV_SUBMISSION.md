---
title: AFK.exe — a dev workspace that only grows when you step away (local Qwen3.5 vision + Ollama)
published: false
tags: devchallenge, hf26challenge
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)*

## What I Built

**AFK.exe** is a game about your developer workspace, and the only way to improve it is to leave it.

It opens on a cold, graphite 3D room: one desk, one monitor, and a small robot companion called Moss. A client contract is waiting. The first one is *"Bug Fix: The Broken Counter"*, a progress badge that crashes for anyone with exactly one task. It is a real off-by-one bug. You pick one of four fixes and AFK.exe runs authored test cases against your choice, showing actual outputs, including the real `TypeError`. It takes about 90 seconds.

Fixing it doesn't give you XP. It gives you a **final mission**: *"Touch Grass."*

> **Nature's Debugger:** Find something growing through or around a crack. Nature repairing a broken system.

Every mission has an easier variant that works on any street ("photograph any living plant"), plus short safety notes: public paths only, no picking, a balcony counts. The outdoor screen shows one sentence and one camera button. You take one photo and put the phone away.

Back at your desk, an **open-weight vision model running on your own laptop** checks the photo. If it fits, you get +250 XP and level up. The room changes, first with a seedling, then with daylight, leaf shadows and finally a warm, plant-filled studio. A **real developer tool** also unlocks:

- **AI Debugger** (after *Nature's Debugger*): paste code, describe the symptom, and get suspected issues, a fix, an explanation and verification steps.
- **Code Optimizer** (after *Pattern Hunter*): complexity before and after, refactor suggestions, and caveats.
- **Test Generator** (after *Test the Wild*): a Vitest file with edge cases first.

It's for developers who know they should take a walk and don't. AFK.exe doesn't nag, block or use streaks. It makes stepping outside the way your tools get better. The screen is meant to be the shortest part of the experience.

## Demo

<!-- TODO: replace with your video link (YouTube/Vimeo/Loom) -->
🎬 **Video:** `{% embed https://YOUR-VIDEO-URL %}`

The video shows real footage of the full loop: Level 1 room → contract → outdoor photo → local verification → reward → the room grows → the AI Debugger running on pasted code.

There is no hosted demo on purpose. The whole point is that the model runs on *your* machine. Setup takes three commands (see Code).

## Code

<!-- TODO: replace with your repository URL -->
{% embed https://github.com/YOUR-USERNAME/YOUR-REPO %}

```bash
ollama pull qwen3.5:4b
npm install
npm run dev
```

Licensed MIT. Third-party licenses are in `ATTRIBUTIONS.md`.

## How I Built It

**The open-source AI at the core:**

- **Qwen3.5 4B** (`qwen3.5:4b`), an Apache-2.0, open-weight multimodal model.
- **Ollama** as the local inference server.

One 4B model does all of the AI work, through task-specific prompts and JSON schemas:

1. **Photo verification.** The photo is downscaled to 640 px and sent to `/api/chat` as a base64 image, with a JSON schema in Ollama's `format` field and `temperature: 0`. The prompt describes the mission's visual criteria, tells the model to ignore any text inside the image, not to infer location, and to mark uncertain photos for review. The answer `{ matches, confidence, reason, detectedElements, needsReview }` is **validated with zod** before anything trusts it. A reward needs a match, at least 0.6 confidence, and no review flag. Anything else is put on hold, with the model's reasoning shown to the user and unlimited retries.
2. **Developer tools.** The Debugger, Optimizer and Test Generator each have their own system prompt and output schema. Code input is capped, treated as untrusted, rendered as text, and never executed.
3. **Moss, the assistant.** Streamed plain text.

I was honest with myself about what a 4B model on a laptop can do, and it surprised me in a good way. In testing, `qwen3.5:4b` **rejected** a photorealistic digital flower as *"digitally rendered… not a real living plant"*, rejected an abstract wallpaper, and said a three-panel collage *"does not show a single living plant up close."* It put a distant forest shot **on hold** for the strict variant, and verified it for the inclusive "any green signal" variant. Being that strict is what makes the reward feel earned.

**The stack:**

- Vite, React 19, TypeScript and React Router.
- three.js with React Three Fiber for a single procedural diorama with four growth stages. There are no downloaded models or textures, and a layered SVG fallback is shown whenever WebGL is missing or the scene is still loading.
- IndexedDB (via `idb`) stores photos, progress and rewards.
- A **local adapter** inside the Vite server proxies only four allow-listed Ollama routes, and only for loopback clients. A phone on the LAN can capture photos but can never reach the model.
- A build-time **service worker** precaches the app shell, fonts, missions and the 3D chunk.

**Offline was a design requirement.** Out in the field you often have no signal, so:

- The phone saves the photo locally and says *"Saved offline — verify when you return to your computer."*
- Back home it hands the photo to the desk over the same Wi-Fi, using a pairing token from a QR code, or as a portable `.afk.json` file you can AirDrop.
- The desk verifies it with the local model.

I tested this by stopping the server and reloading. The mission still loaded and the AI badge correctly read *Local AI offline*. Then I restarted the server, and the photo taken "offline" was verified.

**Rewards are idempotent.** The XP, level, room stage and tool unlock are written in a single IndexedDB transaction, keyed by a completion key. Double clicks, reloads and a second photo can't grant anything twice. Unit tests cover this, along with the challenge fixtures, the AI-output parser and import validation (30 tests).

**Trade-offs I'm upfront about:**

- My laptop has no GPU. A warm photo check took about 12–35 s, and the very first request took about 3 minutes while the model loaded. The UI shows real progress and lets you cancel, and it doesn't pretend to be fast.
- A photo can't prove where or when it was taken. AFK.exe calls the check a *plausibility* check and labels the confidence *"a model guess, not proof."*
- Phones on plain-HTTP LAN can't reload the app offline, because service workers need HTTPS. They keep working while the tab is open, and the photos persist.

## Why Does Open Innovation Matter?

AFK.exe would be a worse product, or wouldn't exist at all, on a closed API.

- **Privacy is the product.** It's a game about photos of where you walk and the code you write. With local inference, neither one ever leaves your machine. There's no upload consent screen because there's no upload.
- **Offline is real.** A closed API means "verification requires internet." An open-weight model means verification only needs your own computer.
- **No meter running.** Every photo check and every Debugger run costs nothing. Rewards that cost money per check would turn "go outside more" into "go outside less."
- **You own it, and you can swap it.** The model is one environment variable (`VITE_OLLAMA_MODEL`). If a better small vision model comes out tomorrow, you pull it and keep playing. Nobody can deprecate the model out from under you.
- **Everything is inspectable.** The prompts, schemas and decision threshold are in the repo, so you can see exactly why a photo passed or failed.

<!-- ## My Agent Session — optional: add a DevRelay link/embed if you saved one, otherwise delete this section. -->

<!-- ## Prize Categories — none of the listed partner technologies (Render, TabPFN, Tinker, Arduino, DigitalOcean, Gemma, Backboard, ElevenLabs, Entire, GitHub Copilot, Mastra, MongoDB Atlas, Sentry, SerpApi, Temporal, Tiger Data) are used, so this section is intentionally omitted. -->
