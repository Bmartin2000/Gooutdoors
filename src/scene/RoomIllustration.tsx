import type { RoomStage } from '../game/types.ts'

/**
 * Static 2.5D fallback of the workspace (no WebGL needed). Used while the 3D chunk loads,
 * when WebGL is unavailable, and if the 3D scene fails. Mirrors the same four stages.
 */
const TONES = [
  { wall: '#2b2e30', side: '#232628', floor: '#1f2123', glass: '#9fb2c7', light: 0.1, accent: '#9fb2c7' },
  { wall: '#34342f', side: '#2b2c28', floor: '#37312a', glass: '#ebe2c6', light: 0.22, accent: '#8dbb84' },
  { wall: '#3c3a33', side: '#33312b', floor: '#54412f', glass: '#ffe3ae', light: 0.32, accent: '#9fd08f' },
  { wall: '#443f37', side: '#3a352e', floor: '#644b38', glass: '#ffd38a', light: 0.42, accent: '#b5e3a2' },
]

function Leaf({ x, y, r, s, c }: { x: number; y: number; r: number; s: number; c: string }) {
  return <path d="M0 0 C 9 -4 8 -17 0 -22 C -8 -17 -9 -4 0 0 Z" transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} fill={c} />
}

export default function RoomIllustration({ stage }: { stage: RoomStage }) {
  const t = TONES[stage]
  return (
    <svg viewBox="0 0 640 420" className="room-illustration" role="img" aria-label={`Illustrated workspace, growth stage ${stage + 1} of 4`}>
      <defs>
        <linearGradient id="beam" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={t.glass} stopOpacity={t.light} />
          <stop offset="1" stopColor={t.glass} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* floor slab */}
      <path d="M90 300 L330 400 L570 300 L330 210 Z" fill={t.floor} />
      <path d="M90 300 L330 400 L330 414 L90 314 Z" fill="#141515" />
      <path d="M330 400 L570 300 L570 314 L330 414 Z" fill="#101111" />
      {/* walls */}
      <path d="M90 300 L90 80 L330 -10 L330 210 Z" fill={t.side} />
      <path d="M330 210 L330 -10 L570 80 L570 300 Z" fill={t.wall} />
      {/* window */}
      <path d="M150 190 L150 110 L250 72 L250 152 Z" fill={t.glass} opacity="0.92" />
      <path d="M200 171 L200 91" stroke="#d6d1c6" strokeWidth="3" />
      <path d="M150 190 L250 152 L470 260 L330 330 Z" fill="url(#beam)" />
      {/* desk */}
      <path d="M340 205 L470 160 L540 186 L410 232 Z" fill="#c9bba4" />
      <path d="M410 232 L410 290 M540 186 L540 244 M340 205 L340 262" stroke="#1c1e1d" strokeWidth="5" />
      {/* monitor */}
      <path d="M392 168 L470 140 L470 92 L392 120 Z" fill="#141615" />
      <path d="M397 162 L465 138 L465 98 L397 122 Z" fill="#0c0e0d" />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M403 ${128 + i * 8} L${440 - i * 6} ${116 + i * 8 - (i % 2) * 3}`} stroke={t.accent} strokeWidth="2.4" opacity="0.8" />
      ))}
      {/* bot */}
      <circle cx="505" cy="168" r="11" fill="#e9e6df" />
      <rect x="499" y="164" width="12" height="6" rx="3" fill="#121413" />
      <circle cx="502" cy="167" r="1.6" fill={t.accent} />
      <circle cx="508" cy="167" r="1.6" fill={t.accent} />
      {stage >= 1 && (
        <g>
          <path d="M360 200 l-7 -14 h18 l-4 14 Z" fill="#d9d3c7" />
          <Leaf x={362} y={186} r={-30} s={0.6} c="#7bb06a" />
          <Leaf x={362} y={186} r={35} s={0.5} c="#5f9152" />
          <Leaf x={505} y={158} r={-25} s={0.3} c="#7bb06a" />
        </g>
      )}
      {stage >= 2 && (
        <g>
          <path d="M120 300 l-14 -40 h40 l-8 40 Z" fill="#cfc6b6" />
          {[-60, -35, -10, 15, 40, 65, -80, 80].map((r, i) => (
            <Leaf key={r} x={126} y={262} r={r} s={1.3 + (i % 3) * 0.25} c={['#4f7f45', '#6fa35f', '#3f6d3a'][i % 3]} />
          ))}
          <path d="M500 40 v38" stroke="#8a8172" strokeWidth="1.5" />
          <path d="M486 78 h28 l-4 14 h-20 Z" fill="#e4ddcf" />
          {Array.from({ length: 9 }, (_, i) => (
            <Leaf key={i} x={492 + (i % 2) * 14} y={96 + i * 9} r={i % 2 ? 160 : 200} s={0.45} c={i % 3 ? '#5f9152' : '#7bb06a'} />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <Leaf key={`o${i}`} x={160 + i * 16} y={100 - i * 4} r={150 + i * 12} s={0.7} c="#3f6d3a" />
          ))}
        </g>
      )}
      {stage >= 3 && (
        <g>
          <ellipse cx="400" cy="300" rx="90" ry="34" fill="#56704a" opacity="0.9" />
          <path d="M540 300 l-12 -44 h36 l-6 44 Z" fill="#cfc6b6" />
          {[-70, -45, -20, 0, 20, 45, 70, -90, 90, -10].map((r, i) => (
            <Leaf key={r} x={546} y={256 - (i % 4) * 22} r={r} s={1.4} c={['#4f7f45', '#6fa35f', '#7bb06a'][i % 3]} />
          ))}
          {Array.from({ length: 14 }, (_, i) => (
            <Leaf key={`v${i}`} x={340 + i * 16} y={8 + i * 5} r={170 + (i % 3) * 20} s={0.55} c={i % 2 ? '#5f9152' : '#7bb06a'} />
          ))}
          {Array.from({ length: 10 }, (_, i) => (
            <circle key={`d${i}`} cx={190 + i * 23} cy={170 + (i % 4) * 22} r="1.6" fill="#ffd894" opacity="0.7" />
          ))}
        </g>
      )}
    </svg>
  )
}
