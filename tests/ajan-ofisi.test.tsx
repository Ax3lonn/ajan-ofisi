import type { AgentSpawnInput } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

// Kullanıcının kendi ayarı: Türkçe ve "Killua".
const TR = { options: { owner: 'Killua', language: 'tr' } } as const

// Agent aracının bir başlatması: testin söylemediği alanları motorun dolduracağı gibi verir.
let spawned = 0
const spawn = (
  args: Pick<AgentSpawnInput, 'prompt' | 'description'> & Partial<AgentSpawnInput>,
): AgentSpawnInput => ({
  tool_use_id: `toolu_${++spawned}`,
  subagentType: 'general-purpose',
  provider: { plugin: 'engine', tier: 'core' },
  parentModel: 'claude-fable-5-2',
  background: true,
  fork: false,
  ...args,
})

const PANE = {
  plugin: 'ajan-ofisi',
  component: 'Pane',
  requestId: 'ajan-ofisi',
  props: {
    title: 'Ajan ofisi',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('alt ajan odasına oturur, adım atar, biter', TR, async ($, on) => {
  const clock = mock.clock(on)
  on('command.register', () => ({ value: { command: 'ajan-ofisi' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.model', () => ({ value: 'claude-fable-5-2' }))
  on('agent.list', () => ({ value: [] }))
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: `a${++n}` }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.agent.spawn(spawn({ prompt: 'sesi incele', description: 'Ses incelemesi' }))
  await $.agent.spawn(spawn({ prompt: 'stok ara', description: 'Stok arama', model: 'haiku' }))
  await $.tool.call({ tool: 'Bash', command: 'ffprobe C3422.mp4', agentId: 'a1' })
  await $.tool.call({ tool: 'Read', file_path: '/x/Core.md', agentId: 'a2' })
  await clock.advance(10000)

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const svg = await ui.find({ type: 'Svg' })
    const source = String(svg?.props.source)
    expect(source).toContain('Ses incelemesi')
    expect(source).toContain('Sonnet 5.5')
    expect(source).toContain('Fable 5.2')
    expect(source).toContain('ffprobe')
    expect(source).toContain('2 çalışıyor')
    expect(source).toContain('sıra sende')
    expect(source).toContain('komut · 1 adım')
    expect(source).toContain('okuyor · 1 adım')
    expect(source).toContain('#k-read')
    expect(source.length).toBeLessThan(131072)
    await ui.unmount()
  }

  await $.turn.complete({
    answer: '12 klip bulundu.',
    durationMs: 1000,
    isAborted: false,
    turnId: 't1',
    agentId: 'a2',
    reason: 'answer',
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const after = String((await ui.find({ type: 'Svg' }))?.props.source)
  expect(after).toContain('Bitti · 1 adım')
  await ui.press({ key: 'ended-toggle' })
  expect((await ui.find({ type: 'Text', text: /Bitenler/ }))?.text).toContain('Bitenler')
  await ui.press({ key: 'view-tree' })
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('12 klip bulundu.')
  await ui.press({ key: 'agent-a2' })
  expect((await ui.find({ type: 'Markdown' }))?.text).toContain('12 klip bulundu.')
  expect((await ui.find({ type: 'Text', text: /stok ara/ }))?.text).toContain('stok ara')
  await ui.unmount()

  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await term.find({ type: 'Text', text: /Ses incelemesi/ }))?.text).toContain('Sonnet 5.5')
  await term.unmount()
})

test('ajan yokken boş ofis çizilir', TR, async $ => {
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const source = String((await ui.find({ type: 'Svg' }))?.props.source)
  expect(source).toContain('alt ajan yok')
  expect(source).toContain('KILLUA')
  await ui.unmount()
})

test('varsayılan ayarlarla panel İngilizce ve Claude adıyla', async ($, on) => {
  const clock = mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.model', () => ({ value: 'claude-fable-5-2' }))
  on('agent.list', () => ({ value: [] }))
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'b1' }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', () => ({ text: '' }))

  await $.agent.spawn(spawn({ prompt: 'read the notes', description: 'Notes review' }))
  await $.tool.call({ tool: 'Read', file_path: '/x/notes.md', agentId: 'b1' })
  await clock.advance(10000)

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    if (surface === 'terminal') {
      expect((await ui.find({ type: 'Text', text: /Claude/ }))?.text).toContain('1 running · 0 done')
    } else {
      const source = String((await ui.find({ type: 'Svg' }))?.props.source)
      expect(source).toContain('CLAUDE')
      expect(source).toContain('1 running · 0 done')
      expect(source).toContain('reading · 1 step')
      expect(source).toContain('Fable 5.2 · main chat')
      expect(source).not.toContain('çalışıyor')
      expect((await ui.find({ type: 'Button', key: 'view-office' }))?.text).toContain('Office')
      expect((await ui.find({ type: 'Button', key: 'view-tree' }))?.text).toContain('Tree')
    }
    await ui.unmount()
  }

  await $.turn.complete({
    answer: 'Done reading.',
    durationMs: 1000,
    isAborted: false,
    turnId: 't1',
    agentId: 'b1',
    reason: 'answer',
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Button', key: 'ended-toggle' }))?.text).toContain('Claude · 1 finished')
  await ui.unmount()
})
