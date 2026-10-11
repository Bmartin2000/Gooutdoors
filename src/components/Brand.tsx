export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="brand-mark">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--surface-3)" stroke="var(--line-strong)" />
      <path d="M9 21.5 L13.2 17.3 L9 13.1" fill="none" stroke="var(--text)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.6 22.2 C 19.6 16.4 21.4 12.6 25 10.4 C 25.3 15.4 23.4 19.5 19.6 22.2 Z" fill="var(--accent)" />
      <path d="M19.6 22.2 C 19.4 19.8 18.4 18.1 16.4 17" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="wordmark">
      AFK<span className="wordmark__ext">.exe</span>
    </span>
  )
}
