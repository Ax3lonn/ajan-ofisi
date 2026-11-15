export type AgentStatus = 'running' | 'waiting' | 'done' | 'failed'

export type AgentRow = {
  id: string
  parentId?: string
  name: string
  type: string
  model: string
  status: AgentStatus
  steps: number
  last: string
  recent: string[]
  startedAt: number
  at: number
  endedAt?: number
  answer?: string
  task?: string
}

/** Panel dili: plugin.json userConfig `language` alanının değerleri. */
export type Lang = 'en' | 'tr'

export type UiState = { view: 'office' | 'tree'; selected: string; showEnded?: boolean }

declare module 'claude-code' {
  interface PluginState {
    'ajan-ofisi': {
      agents: Shaped<AgentRow[]>
      ui: Shaped<UiState>
      mainModel: string
      now: number
      mainBusy: boolean
      idleSince: number
    }
  }
}
