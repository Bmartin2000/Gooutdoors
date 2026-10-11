import { AlertTriangle, Check, Copy, Eraser, FileCode2, Loader2, Play, Square } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { MAX_CODE_CHARS, MAX_CONTEXT_CHARS, runDebugger, runOptimizer, runTestGenerator } from '../ai/developerAssistant.ts'
import type { ChatProgress } from '../ai/ollamaClient.ts'
import type { DebuggerResult, OptimizerResult, TestGenResult } from '../ai/schemas.ts'
import { useAIStatus } from '../app/AIStatusContext.tsx'
import { S } from '../content/strings.ts'
import CodeBlock from './CodeBlock.tsx'
import { OllamaSetupHelp } from './SettingsPanel.tsx'
import { useLocalTool, type ToolState } from './useLocalTool.ts'

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="btn btn--sm"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1600)
        })
      }}
    >
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied ? 'Copied' : label}
    </button>
  )
}

const LANGUAGES = ['TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'Java', 'C#', 'Other']

interface FormConfig {
  storageKey: string
  contextLabel: string
  contextPlaceholder: string
  runLabel: string
  example: { code: string; context: string; language: string }
}

function Progress({ state }: { state: ToolState<unknown> }) {
  const { warm } = useAIStatus()
  if (state.kind !== 'running') return null
  const p = state.progress
  const seconds = p ? Math.round(p.elapsedMs / 1000) : 0
  return (
    <div className="tool-progress" role="status">
      <Loader2 size={16} className="spin" aria-hidden />
      <span>
        {p?.phase === 'writing'
          ? `Writing… ${p.tokens} tokens`
          : seconds > 25 && warm !== 'warm'
            ? 'Reading your code… (first run loads the model, this can take a while on CPU)'
            : 'Reading your code…'}
      </span>
      <span className="muted">{seconds}s</span>
    </div>
  )
}

/** Shared form: language, code, context, run/cancel/clear, progress and error states. */
function CodeToolForm<T>({
  config,
  runner,
  render,
}: {
  config: FormConfig
  runner: (input: { code: string; context: string; language: string }, opts: { signal: AbortSignal; onProgress: (p: ChatProgress) => void }) => Promise<T>
  render: (result: T, seconds: number) => ReactNode
}) {
  const { diagnostics } = useAIStatus()
  // Drafts stay in this browser only (per-viewer convenience).
  const [code, setCode] = useState(() => {
    try {
      return sessionStorage.getItem(`${config.storageKey}:code`) ?? ''
    } catch {
      return ''
    }
  })
  const [context, setContext] = useState('')
  const [language, setLanguage] = useState('TypeScript')
  const { state, run, cancel, reset } = useLocalTool(runner)

  useEffect(() => {
    try {
      sessionStorage.setItem(`${config.storageKey}:code`, code)
    } catch {
      /* storage unavailable */
    }
  }, [code, config.storageKey])

  const ready = diagnostics.connection === 'ready'
  const tooLong = code.length > MAX_CODE_CHARS
  const running = state.kind === 'running'

  return (
    <div className="tool-form stack-4">
      <form
        className="stack-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!running) void run({ code, context, language })
        }}
      >
        <div className="row-between wrap">
          <label className="field field--inline">
            <span>Language</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => {
              setCode(config.example.code)
              setContext(config.example.context)
              setLanguage(config.example.language)
              reset()
            }}
          >
            <FileCode2 size={14} aria-hidden /> Load example
          </button>
        </div>
        <label className="field">
          <span className="row-between">
            Your code
            <span className={`small ${tooLong ? 'error-text' : 'muted'}`}>
              {code.length.toLocaleString('en')} / {MAX_CODE_CHARS.toLocaleString('en')}
            </span>
          </span>
          <textarea
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste a function or a small file…"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            rows={12}
          />
        </label>
        <label className="field">
          <span>{config.contextLabel}</span>
          <input value={context} maxLength={MAX_CONTEXT_CHARS} onChange={(e) => setContext(e.target.value)} placeholder={config.contextPlaceholder} />
        </label>
        <div className="row-2 wrap">
          {running ? (
            <button type="button" className="btn btn--primary" onClick={cancel}>
              <Square size={14} aria-hidden /> Cancel
            </button>
          ) : (
            <button type="submit" className="btn btn--primary" disabled={!ready || !code.trim() || tooLong}>
              <Play size={15} aria-hidden /> {config.runLabel}
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setCode('')
              setContext('')
              reset()
            }}
          >
            <Eraser size={14} aria-hidden /> Clear
          </button>
          <span className="muted small">Runs on {diagnostics.model} on this computer. Never executed.</span>
        </div>
      </form>
      <OllamaSetupHelp connection={diagnostics.connection} model={diagnostics.model} />
      <Progress state={state} />
      {state.kind === 'error' && (
        <div className="note note--warn" role="alert">
          <p>{state.message}</p>
          <button type="button" className="btn btn--sm" onClick={() => void run({ code, context, language })}>
            Try again
          </button>
        </div>
      )}
      {state.kind === 'done' && (
        <section className="result stack-4" aria-label="Result">
          <p className="warning">
            <AlertTriangle size={15} aria-hidden /> {S.companion.reviewWarning}
          </p>
          {render(state.result, state.seconds)}
        </section>
      )}
    </div>
  )
}

function Severity({ level }: { level: 'high' | 'medium' | 'low' }) {
  return <span className={`pill pill--${level === 'high' ? 'danger' : level === 'medium' ? 'warn' : 'muted'}`}>{level}</span>
}

function ResultCode({ title, code, language }: { title: string; code: string; language: string }) {
  if (!code.trim()) return null
  return (
    <div className="stack-2">
      <div className="row-between">
        <h4 className="h4">{title}</h4>
        <CopyButton text={code} />
      </div>
      <CodeBlock code={code} fileName={language} label={title} />
    </div>
  )
}

/* ───────────── tools ───────────── */

export function DebuggerTool() {
  return (
    <CodeToolForm<DebuggerResult>
      config={{
        storageKey: 'afk-debugger',
        contextLabel: 'What goes wrong? (optional)',
        contextPlaceholder: 'e.g. Total is always one too low; crashes with a single item',
        runLabel: 'Debug with local AI',
        example: {
          language: 'JavaScript',
          context: 'The average is wrong and sometimes NaN.',
          code: `function averageRating(reviews) {
  let total = 0
  for (const r of reviews) {
    total += r.rating
  }
  return total / reviews.length - 1
}`,
        },
      }}
      runner={(i, o) => runDebugger({ code: i.code, symptom: i.context, language: i.language }, o)}
      render={(r, s) => (
        <>
          <div className="stack-2">
            <p className="result__summary">{r.summary}</p>
            <p className="muted small">{s}s on your machine</p>
          </div>
          {r.issues.length > 0 && (
            <ul className="issues">
              {r.issues.map((i, n) => (
                <li key={n}>
                  <div className="row-2">
                    <Severity level={i.severity} />
                    <strong>{i.title}</strong>
                  </div>
                  <p>{i.detail}</p>
                </li>
              ))}
            </ul>
          )}
          <ResultCode title="Suggested fix" code={r.fixedCode} language="fix" />
          {r.explanation && (
            <div className="stack-2">
              <h4 className="h4">Why</h4>
              <p>{r.explanation}</p>
            </div>
          )}
          {r.verification.length > 0 && (
            <div className="stack-2">
              <div className="row-between">
                <h4 className="h4">How to verify</h4>
                <CopyButton text={r.verification.map((v) => `- ${v}`).join('\n')} />
              </div>
              <ul className="bullets">
                {r.verification.map((v, n) => (
                  <li key={n}>{v}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    />
  )
}

export function OptimizerTool() {
  return (
    <CodeToolForm<OptimizerResult>
      config={{
        storageKey: 'afk-optimizer',
        contextLabel: 'Goal (optional)',
        contextPlaceholder: 'e.g. Faster for 50k items, keep the public API',
        runLabel: 'Optimize with local AI',
        example: {
          language: 'TypeScript',
          context: 'This runs on every keystroke with ~20k contacts.',
          code: `export function findShared(a: string[], b: string[]): string[] {
  const shared: string[] = []
  for (const x of a) {
    if (b.includes(x) && !shared.includes(x)) shared.push(x)
  }
  return shared
}`,
        },
      }}
      runner={(i, o) => runOptimizer({ code: i.code, goal: i.context, language: i.language }, o)}
      render={(r, s) => (
        <>
          <div className="stack-2">
            <p className="result__summary">{r.summary}</p>
            <p className="muted small">{s}s on your machine</p>
          </div>
          <dl className="complexity">
            <div>
              <dt>Before</dt>
              <dd>{r.complexityBefore}</dd>
            </div>
            <div>
              <dt>After</dt>
              <dd>{r.complexityAfter}</dd>
            </div>
          </dl>
          {r.suggestions.length > 0 && (
            <ul className="issues">
              {r.suggestions.map((i, n) => (
                <li key={n}>
                  <div className="row-2">
                    <Severity level={i.impact} />
                    <strong>{i.title}</strong>
                  </div>
                  <p>{i.detail}</p>
                </li>
              ))}
            </ul>
          )}
          <ResultCode title="Refactored code" code={r.refactoredCode} language="refactor" />
          {r.caveats.length > 0 && (
            <div className="stack-2">
              <h4 className="h4">Check before shipping</h4>
              <ul className="bullets">
                {r.caveats.map((c, n) => (
                  <li key={n}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    />
  )
}

export function TestGeneratorTool() {
  return (
    <CodeToolForm<TestGenResult>
      config={{
        storageKey: 'afk-testgen',
        contextLabel: 'Focus (optional)',
        contextPlaceholder: 'e.g. Leap years and invalid dates',
        runLabel: 'Generate tests',
        example: {
          language: 'TypeScript',
          context: 'Edge cases first.',
          code: `export function slugify(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}`,
        },
      }}
      runner={(i, o) => runTestGenerator({ code: i.code, focus: i.context, language: i.language }, o)}
      render={(r, s) => (
        <>
          <div className="stack-2">
            <p className="result__summary">{r.summary}</p>
            <p className="muted small">{s}s on your machine · Vitest</p>
          </div>
          {r.cases.length > 0 && (
            <ul className="issues">
              {r.cases.map((c, n) => (
                <li key={n}>
                  <strong>{c.name}</strong>
                  <p>{c.why}</p>
                </li>
              ))}
            </ul>
          )}
          <ResultCode title="subject.test.ts" code={r.testCode} language="subject.test.ts" />
          {r.notes.length > 0 && (
            <ul className="bullets">
              {r.notes.map((c, n) => (
                <li key={n}>{c}</li>
              ))}
            </ul>
          )}
        </>
      )}
    />
  )
}
