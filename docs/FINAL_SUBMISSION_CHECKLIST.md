# Final submission checklist

**Deadline:** October 11, 2026, 11:59 PM PDT = **October 12, 2026, 08:59 Budapest (CEST)**.

## What's verified (2026-10-11, development machine)

| Check | Result |
| --- | --- |
| `tsc -b`, `vite build`, `npm run licenses:check` | PASS |
| `npm test`: 58 tests | PASS |
| `oxlint` | PASS. Warnings only, no errors. |
| Desk: first-person office, OS projected onto the monitor at 1440×900; full-screen OS over a blurred room in a narrow window | PASS (browser) |
| Desk: accept a job, energy deducted, wrong answer shows real outputs and is struck through, right answer pays $95 / +40 XP / Debugging +1 | PASS (browser) |
| Desk: buy the desk seedling with 🌿; it appears in the 3D office; Look around switches to the room view | PASS (browser) |
| Phone UI at 390 px: start screen, live ring, mission sheet, toast | PASS (browser) |
| Phone GPS logic with a **simulated** walk (harness-injected geolocation, 0.5 m/s): mission buzz fired on time (vibration pattern recorded); live distance and time | PASS, simulated |
| Phone → desk over the LAN inbox: outing received; a verified walk credited +3 🌿 +100 XP, energy 100; re-sending the same walk not credited again; a forged "verified" walk below its thresholds rejected | PASS. Posted the way a phone does (curl to the inbox with the pairing token). |
| `start:lan` serves HTTPS; pairing returns `https://` LAN URLs; plain HTTP refused; model API refused from the LAN IP | PASS (curl) |
| Live `qwen3.5:4b` photo verification, Debugger, Optimizer, Test Generator | PASS. Tested earlier today: photo 12–35 s warm, tools 60–89 s. |
| **Real phone GPS walk outdoors** (the in-app browser can't open self-signed LAN HTTPS) | **NOT TESTED** |
| Real vibration and wake lock on a physical Android phone; iOS behaviour | **NOT TESTED** |
| Desktop system notification for a new job | **NOT TESTED**. Implemented; needs a manual check with permission granted and the tab in the background. |
| Screen reader pass | **NOT TESTED** |

| Phone app deployed to GitHub Pages: CI ran a clean install, all 68 tests and the build; the live site has a secure context, GPS, Wake Lock and an active service worker with an offline cache | PASS (https://bmartin2000.github.io/Gooutdoors/outside) |
| Moss announcements (greeting, new job, today's contract) and the featured offer | PASS (browser) |

## Your remaining personal actions

1. [ ] **Real walk (about 15 minutes, strongly recommended).** Install https://bmartin2000.github.io/Gooutdoors/outside on your phone (or use `npm run start:lan` and the Wi-Fi QR code), then walk 10+ minutes and 150+ m. Take the mission photo when the phone buzzes, come back, tap **Send to my desk**, and verify the photo on the desk. Note what happened, honestly, in a sentence or two for the post.
2. [ ] **Screenshots** into `docs/media/` (`desk.png`, `walk.png`, `room.png`), then reference them in the README.
3. [ ] **Recording** following `docs/DEMO_SCRIPT.md`. Every functional claim needs real footage.
4. [x] **Pushed** to `github.com/Bmartin2000/Gooutdoors` (created 2026-10-11) with your approval. Pages deploys automatically on every push.
5. [ ] **Check the repo:** `git ls-files`. Make sure there's no `.env`, no photos and no model weights.
6. [ ] **Fill in `docs/DEV_SUBMISSION.md`:** the video URL and repo URL. Optionally add an agent-session link. Leave Prize Categories out.
7. [ ] **Publish on DEV** before **08:59 Budapest, Oct 12**, with the tags `devchallenge, hf26challenge`.
8. [ ] **After the deadline:** list any later commits in the README.
