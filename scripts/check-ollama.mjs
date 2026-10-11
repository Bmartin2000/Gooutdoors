// Ellenőrzi, hogy fut-e a helyi Ollama és le van-e töltve a projekt modellje.
// Használat: npm run ollama:check
import { readFileSync, existsSync } from 'node:fs'

function readEnv() {
  const env = {}
  for (const file of ['.env.example', '.env', '.env.local']) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2]
    }
  }
  return { ...env, ...process.env }
}

const env = readEnv()
const host = env.OLLAMA_HOST || 'http://127.0.0.1:11434'
const model = env.VITE_OLLAMA_MODEL || 'qwen3.5:4b'

try {
  const { version } = await (await fetch(`${host}/api/version`)).json()
  console.log(`✔ Ollama fut: ${host} (v${version})`)
} catch {
  console.error(`✖ Az Ollama nem érhető el itt: ${host}\n  Indítsd el: ollama serve`)
  process.exit(1)
}

const { models } = await (await fetch(`${host}/api/tags`)).json()
const found = models.find((m) => m.name === model)
if (!found) {
  console.error(`✖ A(z) "${model}" modell nincs letöltve.\n  Töltsd le: ollama pull ${model}`)
  process.exit(1)
}
console.log(`✔ Modell elérhető: ${model} (${(found.size / 1e9).toFixed(1)} GB)`)
