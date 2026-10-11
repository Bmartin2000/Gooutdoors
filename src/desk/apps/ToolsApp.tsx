import { Lock } from 'lucide-react'
import { useState } from 'react'
import { useAIStatus } from '../../app/AIStatusContext.tsx'
import { useGame } from '../../app/GameContext.tsx'
import AssistantChat from '../../components/AssistantChat.tsx'
import { DebuggerTool, OptimizerTool, TestGeneratorTool } from '../../components/CodeTools.tsx'
import { levelForXp, TOOLS } from '../../game/levels.ts'
import type { ToolId } from '../../game/types.ts'

export default function ToolsApp() {
  const { profile } = useGame()
  const { diagnostics } = useAIStatus()
  const level = levelForXp(profile.xp).level
  const best = [...TOOLS].reverse().find((t) => t.minLevel <= level)?.id ?? 'assistant'
  const [tool, setTool] = useState<ToolId>(best === 'assistant' ? 'assistant' : 'debugger')
  const info = TOOLS.find((t) => t.id === tool)!
  const unlocked = level >= info.minLevel

  return (
    <div className="tools">
      <header className="app-head">
        <h2>Tools</h2>
        <p className="muted small">
          All tools run on <code>{diagnostics.model}</code> on this computer. Levelling up unlocks new workflows — the model itself stays the same.
        </p>
      </header>
      <div className="tool-tabs" role="tablist">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === tool} className={`tool-tab ${t.id === tool ? 'is-on' : ''}`} onClick={() => setTool(t.id)}>
            {level < t.minLevel && <Lock size={11} aria-hidden />} {t.name}
          </button>
        ))}
      </div>
      {!unlocked ? (
        <div className="empty empty--center">
          <Lock size={20} aria-hidden />
          <p>
            {info.name} unlocks at level {info.minLevel}.
          </p>
          <p className="muted small">XP comes from jobs at the desk and from walks and photo missions outside.</p>
        </div>
      ) : tool === 'assistant' ? (
        <AssistantChat />
      ) : tool === 'debugger' ? (
        <DebuggerTool />
      ) : tool === 'optimizer' ? (
        <OptimizerTool />
      ) : (
        <TestGeneratorTool />
      )}
    </div>
  )
}
