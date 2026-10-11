# Final submission checklist

**Deadline:** October 11, 2026, 11:59 PM PDT = **October 12, 2026, 08:59 Budapest (CEST)**.

## What's verified (2026-10-11, development machine)

| Check | Result |
| --- | --- |
| `npm install`, `tsc -b`, `vite build` | PASS |
| `npm test` (30 tests: challenges, reward idempotency, AI-output parsing, IndexedDB, imports) | PASS |
| `oxlint` | PASS. Only fast-refresh "only-export-components" style warnings remain. |
| `npm run licenses:check` (148 packages) | PASS |
| Full loop in the browser: onboarding → contract (wrong, then right) → mission → photo → **live qwen3.5:4b verification** → reward reveal → AI Debugger unlocked | PASS. Verified with a real (non-field) forest photo on the "Any green signal" variant. |
| Live rejections | PASS. Abstract render, digital-art flower, collage and a synthetic canvas image were rejected. A forest shot on the strict variant was put on hold. |
| XP, level, tool and room survive a reload; no second grant | PASS. Covered by a unit test plus a manual reload check. |
| AI Debugger, Code Optimizer, Test Generator against the live model | PASS. Took 60 s, 68 s and 89 s on CPU. Output quality varies, which is why the review warning is shown. |
| Production build with the server stopped: shell, mission and capture load from the service worker; badge reads "Local AI offline" | PASS |
| Photo captured while offline, then verified after the server came back | PASS. The model correctly rejected the synthetic image. |
| Phone→desk handoff: QR link opened over the LAN IP, phone shows "Capture device", photo sent, desk received it "from phone" and verified it | PASS. The phone was simulated by a second browser origin on the same machine. |
| Adapter boundaries: model API, pairing and inbox refused from the LAN IP; bad token refused; `pull`/`delete` refused even from localhost | PASS |
| Layout at 390 px, tablet and 1440 px with no horizontal scroll | PASS at 390 and 1440. Tablet not separately screenshotted. |
| Physical phone (iOS or Android) camera capture | **NOT TESTED** |
| Real outdoor field test with a real "plant in a crack" photo | **NOT TESTED** |
| Screen-reader pass (VoiceOver or NVDA) | **NOT TESTED**. Labels, roles and focus handling were implemented. |

## Your remaining personal actions

1. [ ] **Field test (recommended, about 15 minutes).** Run `npm run start:lan`, scan the QR code, and go outside. Photograph a weed in a pavement crack, send it to the desk, and verify it. Write two or three honest sentences about it for the post. Don't invent results.
2. [ ] **Screenshots** into `docs/media/`, then reference them in the README:
   - `room-stage-1.png` (Level 1)
   - `room-stage-4.png` (after all three missions)
   - `mission-phone.png`, `verdict.png`, `debugger.png`
3. [ ] **Screen recording** following `docs/DEMO_SCRIPT.md`. Use real app footage for every functional claim. Higgsfield inserts are for mood only.
4. [ ] **Push to GitHub.**
   - Remote: `https://github.com/Bmartin2000/Gooutdoors.git`. It was created 2026-10-11, inside the window.
   - Nothing has been pushed yet. Run `git push -u origin main` yourself.
   - Optional: rename the repo to `afk-exe`.
5. [ ] **Check the repo:** no `.env`, no personal photos, no model weights. Check with `git ls-files`.
6. [ ] **Fill in `docs/DEV_SUBMISSION.md`:** the video URL, the repo URL, and your field-test sentence (optional).
   - Delete or keep the commented "My Agent Session" section. AFK.exe was built with Claude Code. AI use is allowed by the rules, and the agent session is optional.
   - Leave Prize Categories out: no partner technology is used.
7. [ ] **Publish on DEV** before 08:59 Budapest on Oct 12.
   - Use the official template (already followed) with the tags `devchallenge, hf26challenge`.
   - Set `published: true` only when you're ready.
8. [ ] **After the deadline:** any further commits must be listed in the README.
