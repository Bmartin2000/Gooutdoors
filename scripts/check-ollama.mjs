// Checks that the local Ollama server is running and the project's model is installed.
// Usage: npm run ollama:check
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
  console.log(`✔ Ollama is running: ${host} (v${version})`)
} catch {
  console.error(`✖ Ollama is not reachable at ${host}\n  Start it with: ollama serve`)
  process.exit(1)
}

const { models } = await (await fetch(`${host}/api/tags`)).json()
const found = models.find((m) => m.name === model)
if (!found) {
  console.error(`✖ Model "${model}" is not installed.\n  Install it with: ollama pull ${model}`)
  process.exit(1)
}
console.log(`✔ Model available: ${model} (${(found.size / 1e9).toFixed(1)} GB)`)
