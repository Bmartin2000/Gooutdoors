# Gooutdoors

Nyílt forráskódú, ingyenes túratervező webalkalmazás interaktív 3D-s felülettel és **helyben futó AI-asszisztenssel**.
Nincs API-kulcs, nincs felhőszolgáltatás, nincs előfizetés – minden a saját gépeden fut.

## Technológiák

| Réteg      | Eszköz                                         | Licenc     |
| ---------- | ---------------------------------------------- | ---------- |
| Build      | [Vite](https://vite.dev) + TypeScript          | MIT / Apache-2.0 |
| UI         | React 19 + React Router (`react-router-dom`)   | MIT        |
| 3D         | three.js + React Three Fiber + drei            | MIT        |
| Helyi AI   | [Ollama](https://ollama.com)                   | MIT        |
| Modell     | [Qwen3.5 4B](https://ollama.com/library/qwen3.5) (`qwen3.5:4b`) | Apache-2.0 |
| Lint       | oxlint                                         | MIT        |

## Előfeltételek

- Node.js 20.19+ (ajánlott: 22 LTS vagy újabb)
- [Ollama](https://ollama.com/download) telepítve és futtatva
- Letöltött modell:

```bash
ollama pull qwen3.5:4b
```

## Indítás

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run ollama:check
```

```bash
npm run dev
```

Majd nyisd meg: http://localhost:5173

## Hogyan kapcsolódik az Ollamához?

A böngésző a `/ollama` útvonalat hívja, amit a Vite dev/preview szerver proxy-zik a helyi Ollama API-ra
(`OLLAMA_HOST`, alapértelmezés: `http://127.0.0.1:11434`). Így nincs szükség CORS / `OLLAMA_ORIGINS`
beállításra, és semmilyen adat nem hagyja el a gépet.

- Kliens: [src/lib/ollama.ts](src/lib/ollama.ts) – függőségmentes, streamelt `/api/chat` hívás
- React hook: [src/hooks/useOllamaChat.ts](src/hooks/useOllamaChat.ts)
- Rendszerprompt: [src/lib/prompts.ts](src/lib/prompts.ts)

### Környezeti változók (`.env`)

| Változó             | Leírás                                              | Alapérték                  |
| ------------------- | --------------------------------------------------- | -------------------------- |
| `OLLAMA_HOST`       | Helyi Ollama szerver címe (csak a proxy használja)  | `http://127.0.0.1:11434`   |
| `VITE_OLLAMA_MODEL` | Használt modell                                     | `qwen3.5:4b`               |
| `VITE_OLLAMA_THINK` | Qwen3.5 „thinking” mód (lassabb, alaposabb)         | `false`                    |

## Szkriptek

| Parancs                  | Leírás                                                  |
| ------------------------ | ------------------------------------------------------- |
| `npm run dev`            | Fejlesztői szerver                                      |
| `npm run build`          | Típusellenőrzés + produkciós build                      |
| `npm run preview`        | Build előnézet (Ollama proxy-val)                       |
| `npm run lint`           | oxlint                                                  |
| `npm run ollama:pull`    | A modell letöltése                                      |
| `npm run ollama:check`   | Fut-e az Ollama és elérhető-e a modell                  |
| `npm run licenses:check` | Minden függőség nyílt forráskódú licencű-e              |

## Projektstruktúra

```
src/
  components/   Layout, Ollama státuszjelző
  hooks/        useOllamaChat (streamelt chat állapot)
  lib/          Ollama kliens, promptok
  pages/        Főoldal (3D), Asszisztens, Nyílt forrás, 404
  scene/        React Three Fiber jelenet: terep, erdő, tábor
scripts/        Ollama- és licencellenőrző szkriptek
```

## Nyílt forrás irányelvek

- Csak OSI által elfogadott, megengedő licencű függőség vehető fel – ezt a `npm run licenses:check` ellenőrzi.
- Nincs fizetős vagy kulcsot igénylő külső API; az AI helyben fut az Ollamán.
- Nincs külső CDN, követőkód vagy távoli font/HDR – a 3D jelenet procedurálisan generált.
- Térképadatokhoz nyílt forrás (pl. OpenStreetMap) használandó.

## Licenc

[MIT](LICENSE)
