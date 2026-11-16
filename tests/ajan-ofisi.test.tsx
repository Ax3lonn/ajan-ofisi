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

test('boşta hareketler 30 sn tur izler ve dilimin saniyesinden sürer', TR, async ($, on) => {
  const clock = mock.clock(on)
  on('turn.complete', () => ({ text: '' }))
  const draw = async (): Promise<string> => {
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    const source = String((await ui.find({ type: 'Svg' }))?.props.source)
    await ui.unmount()
    return source
  }

  // 0. dilim: kahve, tur tam başında.
  const sip = await draw()
  expect(sip).toContain('begin="0s"')
  expect(sip).toContain('-46,-18')
  expect(sip).toContain('dur="30s"')
  expect(sip).not.toContain('dur="4s"')

  // Yeniden çizim dilimin 12.5. saniyesinden sürer.
  await clock.advance(12_500)
  expect(await draw()).toContain('begin="-12.50s"')

  // 1. dilim: kitap kucaktan kalkar.
  await clock.advance(17_500)
  const read = await draw()
  expect(read).toContain('clip-path="url(#boss-lap)"')
  expect(read).toContain('begin="0s"')

  // 2. dilim: pencere.
  await clock.advance(30_000)
  expect(await draw()).toContain('-0.25,0')

  // 3. dilim: dolaşma; öndeki kopya köşede anlık belirir ve kaybolur.
  await clock.advance(30_000)
  const walk = await draw()
  expect(walk).toContain('calcMode="discrete" values="0;1;0" keyTimes="0;0.325;0.79167"')
  expect(walk.split('21.5,11').length).toBeGreaterThan(2)
  expect(walk).not.toContain('values="1;0;0;1;1"')

  // 5 dakika beklemede uyuklar.
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't9', reason: 'answer' })
  await clock.advance(300_000)
  const nap = await draw()
  expect(nap).toContain('>Z<')
})

test('ana oturumun modeli değişince yönetici odası da değişir', TR, async ($, on) => {
  const clock = mock.clock(on)
  let model = 'claude-fable-5-2'
  on('command.register', () => ({ value: { command: 'ajan-ofisi' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.model', () => ({ value: model }))
  on('agent.list', () => ({ value: [] }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const draw = async (): Promise<string> => {
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    const source = String((await ui.find({ type: 'Svg' }))?.props.source)
    await ui.unmount()
    return source
  }

  await clock.advance(5_000)
  const before = await draw()
  expect(before).toContain('href="#s-fable"')
  expect(before).toContain('Fable 5.2')

  // Oturumun modeli Opus'a çevrilir: bir sonraki yenilemede karakter ve yazı değişir.
  model = 'claude-opus-5-5'
  await clock.advance(5_000)
  const after = await draw()
  expect(after).toContain('href="#s-opus"')
  expect(after).toContain('Opus 5.5')
  expect(after).not.toContain('href="#s-fable"')
})
