# AFK.exe: 75-second demo script

**Format:** a cinematic opening (Higgsfield or similar) followed by **real screen recordings of the working app**. Every claim about functionality must be backed by actual app footage. Generated visuals are only for mood. Never use them to depict UI, AI results or rewards.

**Before recording:**

- Run `npm start`. Use a fresh browser profile, or Settings › Delete all data.
- **Warm the model** so the verification shot isn't three minutes long: open Explore once, or run a quick Debugger request first. On CPU-only laptops a warm photo check took about 12–35 s here. Cut the wait with an on-screen "real time: 24 s" label rather than faking speed.
- Take a **real photo outdoors** for the mission. The step only makes sense with your own footage.
- Use 1440×900 for desktop shots, and a real phone or a 390×844 window for the Explore shots.

---

## 0:00–0:08 · Cold open (cinematic insert)

- **Visual (generated):** a dark desk at night. Monitor glow on a tired face. Slow push-in.
- **VO:** "Every developer knows this room."
- **Text:** `AFK.exe`, then *Code. Explore. Upgrade.*

## 0:08–0:16 · The cold workspace (real footage)

- **Screen:** the Workspace at **Level 1 · Cold Start**. The graphite 3D room with one desk and a quiet bot. The badge in the corner reads **"Ollama connected · qwen3.5:4b"**.
- **VO:** "AFK.exe is a workspace that only grows when you step away from it."

## 0:16–0:28 · The contract (real footage)

- **Screen:** Accept *Bug Fix: The Broken Counter*. Pick option **B** and show the red test table (`countDone([✓])` → actual `0`). Then pick **A** and show "Fix accepted" with the lesson.
- **VO:** "A 90-second bug. Real tests, deterministic checking: no AI grading your code."

## 0:28–0:40 · Touch grass (mixed)

- **Screen:** the mission card: *Nature's Debugger. Find something growing through or around a crack.*
- **Cut (real phone footage, filmed outside):** a hand takes one photo of a weed in a pavement crack, then the phone goes into a pocket.
- **Optional cinematic insert (generated, clearly mood only):** sunlight through leaves, about 2 s.
- **VO:** "One sentence. One photo. Then the phone goes away."

## 0:40–0:55 · Local verification (real footage)

- **Screen:** back at the desk, the photo card shows *"Your local AI is looking at the photo…"* with the elapsed time. Then the verdict: the reason text, the detected elements, and "match estimate · a model guess, not proof".
- **Optional quick cut:** an unrelated image (a screenshot) getting *"This photo doesn't match"*. This shows the check is real.
- **VO:** "The photo is checked by an open-weight vision model running on this laptop. No cloud. No upload. If it isn't sure, it says so."

## 0:55–1:05 · Upgrade (real footage)

- **Screen:** the reward reveal: *AI Debugger unlocked · +250 XP · Level 2 · First Growth*. Click **See your workspace**. The room is warmer and a seedling is growing on the desk.
- **Optional:** cut to a stage-4 room recorded after all three missions, golden and full of plants.
- **VO:** "Your workspace grows."

## 1:05–1:15 · The tool is real (real footage)

- **Screen:** the Companion › AI Debugger. Paste a buggy `averageRating` function and run it. Show the issue list, the suggested fix, "How to verify", and the **Copy** button.
- **VO:** "And what you unlocked actually works: the same local model, debugging your code."

## 1:15–1:20 · Close

- **Text:** *Your workspace grows when you step away.* · Open source (MIT) · Qwen3.5 4B via Ollama · `github.com/<you>/<repo>`
- **VO:** "AFK.exe. Code. Explore. Upgrade."

---

### Shot list checklist

- [ ] Level 1 workspace (desktop)
- [ ] A wrong option, then the right option, in the contract
- [ ] The mission on a phone, outdoors
- [ ] Verification in progress, then the verdict (real time noted)
- [ ] A rejected image (optional)
- [ ] The reward reveal, and the room after it
- [ ] A Debugger run with Copy
- [ ] *(Optional)* Offline proof: stop the server, reload, and the mission still loads with "Local AI offline"
