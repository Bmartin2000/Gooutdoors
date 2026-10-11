import { ArrowRight, Bug, Gauge, Lock, MessageCircle, TestTubes } from 'lucide-react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAIStatus } from '../app/AIStatusContext.tsx'
import { useGame } from '../app/GameContext.tsx'
import AssistantChat from '../components/AssistantChat.tsx'
import { DebuggerTool, OptimizerTool, TestGeneratorTool } from '../components/CodeTools.tsx'
import LocalAIStatus from '../components/LocalAIStatus.tsx'
import { getContract, getMission } from '../content/contracts.ts'
import { S } from '../content/strings.ts'
import { getTool, TOOLS } from '../game/levels.ts'
import type { ToolId } from '../game/types.ts'

const ICONS: Record<ToolId, typeof Bug> = { assistant: MessageCircle, debugger: Bug, optimizer: Gauge, 'test-generator': TestTubes }

function MossAvatar({ level }: { level: number }) {
  return (
    <svg viewBox="0 0 64 64" width="56" height="56" className="moss" aria-hidden>
      <circle cx="32" cy="36" r="20" fill="var(--surface-3)" stroke="var(--line-strong)" />
      <rect x="20" y="31" width="24" height="11" rx="5.5" fill="var(--bg)" />
      <circle cx="27" cy="36.5" r="2.2" fill="var(--accent)" className="moss__eye" />
      <circle cx="37" cy="36.5" r="2.2" fill="var(--accent)" className="moss__eye" />
      {level >= 2 && (
        <g fill="var(--accent)">
          <path d="M32 16 v-4" stroke="var(--accent)" strokeWidth="1.5" />
          <path d="M32 12 c -6 0 -9 -3 -10 -7 c 5 0 9 2 10 7 Z" />
          <path d="M32 12 c 5 0 8 -3 9 -6 c -5 0 -8 2 -9 6 Z" opacity="0.8" />
        </g>
      )}
    </svg>
  )
}

function ToolCard({ id, active, unlocked, onSelect }: { id: ToolId; active: boolean; unlocked: boolean; onSelect: () => void }) {
  const tool = getTool(id)
  const Icon = ICONS[id]
  return (
    <button type="button" className={`tool-card ${active ? 'is-active' : ''} ${unlocked ? '' : 'is-locked'}`} onClick={onSelect} aria-pressed={active}>
      <span className="tool-card__icon">{unlocked ? <Icon size={18} aria-hidden /> : <Lock size={16} aria-hidden />}</span>
      <span className="tool-card__name">{tool.name}</span>
      <span className="tool-card__tag">{unlocked ? tool.tagline : `Unlocks with ${getMission(getContract(tool.unlockedBy!)!.missionId)!.title}`}</span>
    </button>
  )
}

function LockedTool({ id }: { id: ToolId }) {
  const tool = getTool(id)
  const contract = getContract(tool.unlockedBy!)!
  const mission = getMission(contract.missionId)!
  const navigate = useNavigate()
  return (
    <div className="locked stack-3">
      <Lock size={22} aria-hidden />
      <h3 className="h3">{tool.name} is grown outside.</h3>
      <p className="muted">
        Finish <strong>{contract.title}</strong> at your desk, then complete <strong>{mission.title}</strong> outdoors. Your local AI checks the photo
        and this tool unlocks — powered by the same on-device model, with a task-specific workflow.
      </p>
      <button type="button" className="btn btn--primary" onClick={() => navigate('/')}>
        Go to your workspace <ArrowRight size={16} aria-hidden />
      </button>
    </div>
  )
}

export default function CompanionPage() {
  const { profile } = useGame()
  const { diagnostics } = useAIStatus()
  const [params, setParams] = useSearchParams()
  const requested = params.get('tool') as ToolId | null
  const selected: ToolId = TOOLS.some((t) => t.id === requested) ? requested! : profile.unlockedToolIds.includes('debugger') ? 'debugger' : 'assistant'
  const unlocked = profile.unlockedToolIds.includes(selected)
  const tool = getTool(selected)

  return (
    <div className="page page--companion">
      <header className="companion-head">
        <MossAvatar level={profile.level} />
        <div className="stack-1">
          <p className="eyebrow">{S.companion.role}</p>
          <h1 className="h1">{S.companion.name}</h1>
          <p className="muted">
            One open-weight model, <code>{diagnostics.model}</code>, running through Ollama on this computer. Each tool is a focused workflow on top of it —
            the model doesn’t get smarter, you get more ways to use it.
          </p>
        </div>
        <LocalAIStatus />
      </header>

      <div className="companion-grid">
        <nav className="tool-list" aria-label="Tools">
          {TOOLS.map((t) => (
            <ToolCard key={t.id} id={t.id} active={t.id === selected} unlocked={profile.unlockedToolIds.includes(t.id)} onSelect={() => setParams({ tool: t.id }, { replace: true })} />
          ))}
        </nav>
        <section className="card card--pad tool-panel" aria-labelledby="tool-title">
          <header className="tool-panel__head">
            <h2 id="tool-title" className="h2">
              {tool.name}
            </h2>
            <p className="muted">{tool.tagline}</p>
          </header>
          {!unlocked ? (
            <LockedTool id={selected} />
          ) : selected === 'assistant' ? (
            <AssistantChat />
          ) : selected === 'debugger' ? (
            <DebuggerTool />
          ) : selected === 'optimizer' ? (
            <OptimizerTool />
          ) : (
            <TestGeneratorTool />
          )}
        </section>
      </div>
    </div>
  )
}
