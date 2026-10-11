# Attributions

AFK.exe's original code is MIT-licensed (see `LICENSE`). It builds on the open-source work listed below. Every installed package is checked with `npm run licenses:check`: every package, all MIT, ISC, Apache-2.0, BSD-3-Clause, MPL-2.0 or OFL-1.1.

## AI model and runtime

| Component | License | Notes |
| --- | --- | --- |
| **Qwen3.5 4B** (`qwen3.5:4b`) by the Qwen team, Alibaba Cloud | Apache-2.0 | Open-weight multimodal model. The license was read from the model itself with `ollama show qwen3.5:4b --license`. The weights are **not** included in this repository. |
| **Ollama** | MIT | Local inference server. Not bundled: the user installs it. |

## Runtime dependencies

| Package | Version | License |
| --- | --- | --- |
| react, react-dom | 19.3.0 | MIT |
| react-router-dom | 7.18.4 | MIT |
| three | 0.186.1 | MIT |
| @react-three/fiber | 9.8.1 | MIT |
| @react-three/drei | 10.7.9 | MIT |
| zod | 4.6.5 | MIT |
| idb | 8.0.4 | ISC |
| lucide-react (icons) | 1.55.0 | ISC |
| qrcode | 1.5.4 | MIT |
| @fontsource-variable/inter (Inter by Rasmus Andersson) | 5.3.0 | OFL-1.1 |
| @fontsource-variable/jetbrains-mono (JetBrains Mono) | 5.3.0 | OFL-1.1 |

## Development dependencies

| Package | License |
| --- | --- |
| vite, @vitejs/plugin-react | MIT |
| @vitejs/plugin-basic-ssl (local self-signed HTTPS for `start:lan`) | MIT |
| typescript | Apache-2.0 |
| vitest | MIT |
| oxlint | MIT |
| fake-indexeddb | Apache-2.0 |

## Visual assets

All visuals are original and were created for this project:

- the 3D office and its items (procedural three.js geometry, with no external models or textures)
- the brand mark, favicon and app icons (drawn programmatically)
- the plant-growth animation and the Moss companion avatar

## Images used only for local testing

During development, verification was exercised with images that were already on the development machine: Windows wallpapers and a sample photo bundled with an installed application. They were kept outside the repository, are **not** part of it, and must not be used in demo material.
