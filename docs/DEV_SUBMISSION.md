---
title: AFK.exe — a dev office that only comes alive when you go outside (GPS walks + local Qwen3.5 vision)
published: false
tags: devchallenge, hf26challenge
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)*

## What I Built

**AFK.exe** puts you at a desk in a small 3D office. The whole game runs on the computer in front of you.

Client jobs land in your inbox every hour. **Moss**, a small hovering robot with a plant growing out of its head, turns to you and announces them. Half the offers are generated fresh (new app, story, names and test data each time), and one *Today's contract* each day pays 1.5×. Each job is a real, two-minute coding problem: an off-by-one error that crashes a progress badge, a type guard that lies about `null`, an `await` inside `forEach` that silently returns nothing, a refactor that passes every test and is still O(n²). Every option you pick is run against authored test cases, and you see the real outputs. No AI grades your code.

Jobs pay money, XP and skill points, and they have **requirements**. *"Needs Testing 1 · Level 2"* means you take the jobs you're qualified for and grow into the ones you aren't, the way a real career works.

The twist is **energy**. Every job uses some, and sitting at the desk barely refills it. A walk outside refills it completely:

1. Open the installable phone app (or scan the same-Wi-Fi QR code), tap **Start walk**, and pocket your phone.
2. The phone measures the walk with **GPS, entirely offline**: 10 minutes and 150 m from where you started. It filters inaccurate fixes and teleport jumps.
3. A verified walk alone is worth fresh-air tokens and XP. No task is required.
4. Partway through, **the phone buzzes**: *"Mission unlocked: find something growing through a crack."* Take one photo and pocket the phone again.
5. Back home, the phone hands the walk to your desk, over Wi-Fi or as a shared file.
6. An **open-weight vision model running on your own computer** checks the photo, worth bonus tokens.

Tokens buy **plants**: a seedling beside the keyboard, a monstera, a hanging pothos, wall vines. Money from jobs buys **gear**: a lamp, coffee, a second monitor. The office starts cool and graphite and turns warm and green, and the plants can only come from outside. Levels also unlock real local AI tools that run on the same model: an **AI Debugger**, a **Code Optimizer** and a **Test Generator**.

It's for developers who know they should step away and don't. AFK.exe never blocks you, nags you or uses streaks. It just makes the outside the place where your work recharges.

## Demo

<!-- TODO: replace with your video link -->
🎬 `{% embed https://YOUR-VIDEO-URL %}`

The video is real footage: the seated office view, a job notification, a job done and paid, energy running low, a real walk with the phone buzzing, the walk credited at the desk, the photo checked by the local model, and a plant growing on the desk.

📱 **Try the phone app now:** https://bmartin2000.github.io/Gooutdoors/outside. Add it to your home screen and it works offline. The desk with the local AI runs on your own computer (see Code).

## Code

<!-- TODO: replace with your repository URL -->
{% embed https://github.com/YOUR-USERNAME/YOUR-REPO %}

```bash
ollama pull qwen3.5:4b
npm install
npm run dev          # the desk
npm run start:lan    # + your phone, over local HTTPS
```

The code is MIT-licensed. Third-party licenses are listed in `ATTRIBUTIONS.md`.

## How I Built It

**The open-source AI at the core:**

- **Qwen3.5 4B** (`qwen3.5:4b`), an Apache-2.0, open-weight multimodal model.
- **Ollama** as the local inference server.

One model does all the AI work, through separate prompts and JSON schemas:

- **Photo missions.** The photo is downscaled to 640 px and sent to `/api/chat` as a base64 image, with a JSON schema in `format` and `temperature: 0`. The prompt describes what the mission looks for, tells the model to ignore any text inside the image and not to infer location, and to mark uncertain photos for review. The answer is validated with zod before anything trusts it. A reward needs a match, at least 0.6 confidence and no review flag. Everything else is put on hold with the model's reason shown, and retries are unlimited.
- **Developer tools.** The Debugger, Optimizer and Test Generator each have a task prompt and an output schema. Input is capped and treated as untrusted, and output is rendered as text and never executed.

The model is strict enough that rewards feel earned. In testing it rejected a photorealistic digital flower (*"digitally rendered… not a real living plant"*), an abstract wallpaper, a three-panel collage and a computer-drawn image. It verified a real forest photo for the "any living plant" mission.

**The office.** It's one procedural React Three Fiber room with no downloaded models. The trick that makes it feel like *sitting at* the computer: every frame, the camera rig projects the monitor's four corners to screen pixels, and **the real DOM OS is laid exactly over the 3D screen**. It stays crisp, clickable and screen-reader friendly. Narrow windows fall back to a full-screen OS over a blurred room.

**The phone.**

- The walk is pure geometry: a haversine distance from the first good fix, and time counted only while fixes keep arriving.
- Fixes worse than ±50 m are dropped, jumps faster than 12 m/s are rejected, and the distance must exceed twice the GPS noise at the start.
- Browsers pause GPS when the screen is off, so **pocket mode** keeps the screen on (black and OLED-dark) through the Wake Lock API, and vibrates when a mission appears.
- **Raw coordinates never leave the phone.** The desk only receives minutes, metres and a fix count, and it checks again that a "verified" walk actually meets its own thresholds.

**Offline end to end.**

- Phones only allow GPS on secure pages, so `npm run start:lan` serves the app over **local HTTPS** with a certificate generated on your computer. There's one certificate warning on the phone and no outside service.
- GPS needs no signal.
- The phone stores walks and photos in IndexedDB until it's back on Wi-Fi, and an `.afk.json` export works over AirDrop or USB.
- The local adapter answers model requests only from the computer itself: a phone on the LAN gets a 403.

**Correctness.**

- Every reward (job, walk, photo) is written in one IndexedDB transaction under a unique ledger key. Double clicks, reloads and re-sent walks can't pay twice.
- 68 unit tests (including about 1,800 generated-job checks) cover:
  - every job's answer key against its real outputs
  - the economy
  - GPS verification, including staying home, a short dash and teleports
  - one-time grants under concurrency
  - import validation

**What I'm honest about:**

- My laptop has no GPU. A warm photo check takes about 12–35 s, the first request about 3 minutes, and a tool run about 60–90 s. The UI shows real progress and lets you cancel.
- GPS can be spoofed and a photo can't prove where or when it was taken. AFK.exe rewards stepping out, it doesn't police it.
- There's no push service, so notifications only fire while AFK.exe is open.
- Vibration works on Android; iOS ignores it.

## Why Does Open Innovation Matter?

AFK.exe works with your **location history and photos of where you walk**. With a closed API, all of that would leave your phone. With an open-weight model and local inference, none of it does.

- **Privacy is the design.** Coordinates stay on the phone, photos stay on your computer, and the model runs locally. There's no upload consent screen because there's no upload.
- **It works where you're actually going.** Parks don't have great signal. GPS, the phone app, the desk and the model all work with no internet at all.
- **No meter running.** Every photo check and every Debugger run is free. A reward that costs money per check would quietly teach you to go outside less.
- **You can swap the model.** The model is one environment variable. When a better small vision model ships, pull it and keep playing. Nobody can deprecate the model out from under you.
- **Everything is inspectable.** The prompts, schemas, thresholds and GPS rules are all in the repo, so you can see exactly why a walk or a photo counted.

<!-- ## My Agent Session — optional. AFK.exe was built with Claude Code; add a DevRelay link/embed if you saved one, otherwise delete this comment. -->

<!-- ## Prize Categories — none of the partner technologies are used, so this section is omitted. -->
