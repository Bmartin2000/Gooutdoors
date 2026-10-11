# AFK.exe: 80-second demo script

**Format:** a short cinematic opening (Higgsfield or similar), then **real screen and phone recordings**. Every functional claim needs real footage behind it. Generated clips are for mood only. Never use them to show UI, AI results, GPS or rewards.

**Before recording:**

1. Run `npm run start:lan`.
2. Open the desk at https://127.0.0.1:4173 and accept the local certificate once.
3. In **Settings**, turn on **Jobs: Demo · 2 min**. Optionally turn on **Demo walk thresholds** (2 min / 30 m). It shows a "demo thresholds" label on screen, so leave it visible.
4. Warm up the model: open Outside, or run one Debugger request first.
5. Use the phone on the same Wi-Fi. Scan the QR code and accept the certificate once.

---

**0:00–0:07 · Cold open (cinematic)**

- **Visual:** night, a lone monitor glow, a hand on a mouse.
- **VO:** "Every developer knows this chair."

**0:07–0:20 · Sit down (real)**

- **Screen:** the first-person office. AFK OS is on the monitor, and a job offer slides in with a chime: *"New offer — Sproutly: The broken progress counter."*
- **VO:** "AFK.exe puts you at a desk. Clients send real jobs — every hour."

**0:20–0:32 · Work (real)**

- **Screen:** accept the job and watch energy drop. Pick a wrong option to show the real failing outputs, then the right one: *Paid $95 · +40 XP · Debugging +1*.
- Cut to the Inbox showing a locked offer: *"Needs Testing 1 · Level 2."*
- **VO:** "Real bugs, real tests. Some jobs you can't take yet — you grow into them."

**0:32–0:38 · Low energy (real)**

- **Screen:** the energy meter pulses red, and *Take a walk* is shown.
- **VO:** "And every job costs energy. The desk doesn't give it back."

**0:38–0:55 · Outside (real phone footage, filmed outdoors)**

- Scan the QR code, tap **Start walk**, and pocket the phone.
- Film the ring filling (minutes and metres).
- **The phone buzzes.** Show the screen: *Mission unlocked — Nature's Debugger*. Take a photo of a weed in a pavement crack, then pocket the phone.
- **Optional cinematic insert:** about 2 s of sunlight through leaves (mood only).
- **VO:** "Your phone checks the walk with GPS — no signal needed — and buzzes when there's something to find."

**0:55–1:08 · Back at the desk (real)**

- **Screen:** the phone shows *Send to my desk*. The desk shows *Walk verified by GPS · +3 🌿 +100 XP · energy full*. Then Outside › photo › *Your local AI is looking at the photo…* followed by the verdict.
- Show the real elapsed time. Don't speed up the inference without labelling it.
- **VO:** "Back home, an open-weight model on this laptop checks the photo. Nothing goes to the cloud."

**1:08–1:16 · Grow (real)**

- **Screen:** Shop › buy *Desk seedling* (2 🌿). Click **Look around** and the camera rises out of the chair to show the office with the new plant.
- **VO:** "Plants only come from outside. Your office grows when you step away."

**1:16–1:20 · Close**

- **Text:** *AFK.exe — Code. Explore. Upgrade.* · Qwen3.5 4B · Ollama · MIT · `github.com/<you>/<repo>`

### Shot checklist

- [ ] The seated office, with a job notification arriving
- [ ] Wrong option → real outputs; right option → paid
- [ ] A locked offer showing its skill requirement
- [ ] Low energy
- [ ] **Real** walk outdoors with the phone buzzing at the mission
- [ ] Walk credited on the desk
- [ ] Local AI verdict on the photo, with real time noted
- [ ] Buy a plant, then Look around
