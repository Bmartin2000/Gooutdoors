import { useMemo } from 'react'

/**
 * Tiny, safe syntax highlighter for TS/JS snippets. Produces React text nodes only —
 * never innerHTML — so model or user text cannot inject markup.
 */
const KEYWORDS = new Set(
  'const let var function return if else for while do break continue new class extends import export from type interface async await try catch finally throw typeof instanceof in of switch case default null undefined true false this void as readonly enum implements public private protected static yield'.split(' '),
)
const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|([^\s\w$])/g

type Kind = 'com' | 'str' | 'num' | 'kw' | 'fn' | 'type' | 'pun' | 'plain'

function tokenize(code: string): { text: string; kind: Kind }[] {
  const out: { text: string; kind: Kind }[] = []
  let m: RegExpExecArray | null
  TOKEN.lastIndex = 0
  while ((m = TOKEN.exec(code))) {
    const [text, com, str, num, word, , pun] = m
    if (com) out.push({ text, kind: 'com' })
    else if (str) out.push({ text, kind: 'str' })
    else if (num) out.push({ text, kind: 'num' })
    else if (word) {
      const next = code.slice(TOKEN.lastIndex).match(/^\s*\(/)
      out.push({ text, kind: KEYWORDS.has(word) ? 'kw' : next ? 'fn' : /^[A-Z]/.test(word) ? 'type' : 'plain' })
    } else if (pun) out.push({ text, kind: 'pun' })
    else out.push({ text, kind: 'plain' })
  }
  return out
}

export default function CodeBlock({
  code,
  focusLines = [],
  fileName,
  compact = false,
  label,
}: {
  code: string
  focusLines?: number[]
  fileName?: string
  compact?: boolean
  label?: string
}) {
  const lines = useMemo(() => code.split('\n').map((line) => tokenize(line)), [code])
  return (
    <figure className={`code ${compact ? 'code--compact' : ''}`} aria-label={label ?? fileName ?? 'Code'}>
      {fileName && (
        <figcaption className="code__bar">
          <span className="code__dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          {fileName}
        </figcaption>
      )}
      <pre className="code__pre" tabIndex={0}>
        <code>
          {lines.map((tokens, i) => (
            <span key={i} className={`code__line ${focusLines.includes(i + 1) ? 'is-focus' : ''}`}>
              {!compact && (
                <span className="code__ln" aria-hidden>
                  {i + 1}
                </span>
              )}
              <span className="code__src">
                {tokens.length ? tokens.map((t, j) => (t.kind === 'plain' ? t.text : <span key={j} className={`tok-${t.kind}`}>{t.text}</span>)) : '​'}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </figure>
  )
}
