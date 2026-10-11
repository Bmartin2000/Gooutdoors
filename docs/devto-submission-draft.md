*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)*

## What I Built

I built **AFK.exe**, a cozy developer game where your workspace grows when you step away.

You begin in a small 3D office. Sit at the desk, open the monitor, and work through short coding contracts. Your tiny plant-headed companion, **Inez**, keeps you company. Fix a bug, run its tests, and earn money, experience, and skill practice.

But completing contracts uses energy. Going outside restores it and earns fresh-air tokens, the currency for plants. A plain office gradually becomes a green workspace with vines, warm lighting, better equipment, and a second monitor.

The loop is simple:

**Code → take a walk → notice something in nature → bring life back to your office.**

The phone view asks you to start a walk, pocket the phone, and briefly return when a nature-photo mission appears. A normal qualifying walk needs **10 minutes and at least 150 metres from the starting point**. Walking itself earns rewards; the optional photo mission adds a reason to notice your surroundings.

AFK.exe is for developers and learners who enjoy progression games and could use a more inviting reason to take a break. Five skills—Debugging, TypeScript, Testing, Performance, and Async—lead through ten career titles and continuing mastery. Career milestones unlock developer workflows for your own code, so the rewards extend beyond decorating a room.

## Demo

{% youtube Y_kr_XDbQHI %}

[Play the browser demo](https://bmartin2000.github.io/Gooutdoors/) · [Watch on YouTube](https://youtu.be/Y_kr_XDbQHI)

The video shows a coding fix passing its tests, payment and skill rewards, an outdoor mission submission, office upgrades, and progression to Distinguished Engineer.

**Demo transparency:** the career tour uses labelled admin acceleration. The outdoor sequence uses a sample image and admin approval; it is not a demonstration of a real GPS-qualified outing or a successful local-model photo check. The developer-tool screens show the available workflows, not AI results generated during this recording.

The hosted browser build lets you explore the game and phone experience. **Local AI requires the repository version running on your computer with Ollama.** GitHub Pages does not host the model.

## Code

{% github https://github.com/bmartin2000/Gooutdoors %}

The project is **MIT-licensed**. The repository includes the game, phone PWA, local Ollama adapter, tests, setup instructions, and [third-party attributions](https://github.com/bmartin2000/Gooutdoors/blob/main/ATTRIBUTIONS.md).

## How I Built It

The interface uses **React, TypeScript, and Vite**. The office is built with procedural **Three.js geometry through React Three Fiber**. Game progress, walk records, and photo evidence are stored in **IndexedDB**.

The open AI component is **Qwen3.5 4B**, an open-weight multimodal model, served locally through **Ollama**.

It has two roles:

1. **Nature-photo checking.** Back at the desk, the model examines a downscaled photo against the selected mission's visual criteria. It returns structured JSON containing a match decision, estimated confidence, a reason, and a review flag. Zod validates the response. Uncertain results hold the bonus reward instead of silently granting it.
2. **Developer tools.** Level 2 unlocks an AI Debugger, level 4 a Code Optimizer, and level 6 a Test Generator. These are different workflows over the same local model. Generated suggestions are displayed as text and are never executed automatically.

I kept other checks deterministic. Coding contracts run authored test fixtures. Walk qualification uses GPS calculations on the phone. Neither relies on a language model to decide whether a test passed or a walk met its thresholds.

```text
Phone: GPS + mission photo + local storage
                     |
           LAN transfer or outing file
                     |
Desk: React game + IndexedDB
                     |
        local, loopback-only adapter
                     |
          Ollama → Qwen3.5 4B
                     |
       validated result → bonus reward
```

The phone-to-desk transfer carries a walk summary and re-encoded photos, rather than the GPS coordinate history. Reward grants use a transaction so importing the same outing again does not repeatedly pay out.

To run the full version:

```bash
git clone https://github.com/bmartin2000/Gooutdoors.git
cd Gooutdoors
npm install
ollama pull qwen3.5:4b
npm run dev
```

Ollama must be running; use `ollama serve` if needed. The README also covers the installed phone PWA, local HTTPS, LAN pairing, and file transfer.

The practical trade-off is device capability. Model downloads and initial setup need internet access, inference uses local compute, and browsers can pause GPS with the screen off. Pocket mode keeps a minimal screen awake where supported. The app also makes clear that photo matching is a plausibility check, not proof of where or when a photo was taken.

## Why Does Open Innovation Matter?

For AFK.exe, local open-weight AI makes the outdoor loop possible without turning a walk into a cloud-upload workflow.

After setup, a player can track a walk and save a mission photo without mobile data. The photo can be checked later on the player's own computer. Their submitted code and mission images do not need to go to an external inference service.

Open code also makes the reward rules inspectable. Someone can read the prompts, review the uncertainty threshold, add a nature mission, or adapt the local-model integration. There is no inference API key or per-request provider bill, although running the model still requires suitable hardware and electricity.

A cloud API could perform image analysis, but it would add a network dependency and third-party data transfer to this particular design. Keeping inference local lets a player bring the experience home on their own terms.

The idea I want to preserve is simple: **the most valuable thing the app asks you to do happens outside the app.**

## My Agent Session

I used **Codex** to help implement, debug, and refine the project. The iteration included faster contract replenishment, clearer skill-training requirements and rewards, mobile navigation back from a walk, an office-first opening, and a camera transition that completes consistently on slower devices.

The implementation is visible in the [commit history](https://github.com/bmartin2000/Gooutdoors/commits/main/). I have not attached a saved agent-session transcript to this draft.

The demo was produced with Higgsfield, English female narration through Seed Audio, and an original electronic instrumental. This post was drafted with AI assistance and is being reviewed before publication.

## Prize Categories

**Best Use of GitHub Copilot — GitHub Actions automation.** The [deployment workflow](https://github.com/bmartin2000/Gooutdoors/blob/main/.github/workflows/pages.yml) installs dependencies, runs the tests, builds the static app, and deploys it to GitHub Pages when `main` changes. The challenge lists GitHub Actions project automation as a qualifying use for this category; this entry does not claim that Copilot authored the game.

## Related Community Reading

While preparing this write-up, I read [Sanskar's *Building Local-First AI Apps: What Changes When the Data Stays on the Device*](https://dev.to/sanskarcodes/building-local-first-ai-apps-what-changes-when-the-data-stays-on-the-device-15mi) and [Arun Mahajan's *Lookout: The Offline AI Field Companion That Tells You to Put Your Phone Away*](https://dev.to/arun2232/lookout-the-offline-ai-field-companion-that-tells-you-to-put-your-phone-away-26na). They offer related perspectives on keeping useful work local and letting an outdoor app have a stopping point. They are contextual reading, rather than code dependencies.

**Code. Explore. Upgrade.**

