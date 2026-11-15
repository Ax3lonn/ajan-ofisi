import { atom, read, update } from 'claude-code'
import type { AgentInfo, EngineInterface, PluginOptions, Register } from 'claude-code'

import type { AgentRow, Lang, UiState } from '../types'

const PANE = 'ajan-ofisi'
const DEFAULT_OWNER = 'Claude'

// ---------- dil ----------
// Kullanıcıya görünen bütün yazılar burada; Türkçe metinler önceki sürümle birebir aynı.

type Dict = {
  title: string
  command: string
  commandHelp: string
  opened: string
  unknownModel: string
  agent: string
  span: (m: number, s: number) => string
  steps: (n: number) => string
  kind: { read: string; write: string; run: string; search: string }
  done: string
  stopped: string
  waiting: string
  running: string
  starting: string
  justStarted: string
  noAgents: string
  counts: (running: number, ended: number) => string
  mood: { working: string; waiting: string; idle: string }
  mainSession: string
  emptyOffice: string
  emptyOfficeHint: string
  officeLabel: string
  treeLabel: string
  statRunning: string
  statDone: string
  statSteps: string
  waitingKids: string
  emptyTree: string
  office: string
  tree: string
  endedButton: (owner: string, n: number) => string
  pickAgent: string
  endedList: string
  stoppedLower: string
  doneLower: string
  waitingLower: string
  runningLower: string
  more: (n: number) => string
  task: string
  recent: string
  answer: string
  close: string
}

const DICT: Record<Lang, Dict> = {
  tr: {
    title: 'Ajan ofisi',
    command: 'ajan-ofisi',
    commandHelp: 'Alt ajanları gösteren ofis panelini aç',
    opened: 'Ajan ofisi açıldı.',
    unknownModel: 'Model bilinmiyor',
    agent: 'Ajan',
    span: (m, s) => (m === 0 ? `${s} sn` : `${m} dk ${s < 10 ? '0' : ''}${s} sn`),
    steps: n => `${n} adım`,
    kind: { read: 'okuyor', write: 'yazıyor', run: 'komut', search: 'arıyor' },
    done: 'Bitti',
    stopped: 'Durdu',
    waiting: 'bekliyor',
    running: 'çalışıyor',
    starting: 'Yeni · başlıyor',
    justStarted: 'Yeni · şimdi başladı',
    noAgents: 'Alt ajan yok',
    counts: (running, ended) => `${running} çalışıyor · ${ended} bitti`,
    mood: { working: 'çalışıyor', waiting: 'ajanları bekliyor', idle: 'sıra sende' },
    mainSession: 'ana oturum',
    emptyOffice: 'Şu an çalışan alt ajan yok.',
    emptyOfficeHint: 'Biri başlayınca odası burada belirir.',
    officeLabel: 'Ajan ofisi',
    treeLabel: 'Ajan ağacı',
    statRunning: 'çalışıyor',
    statDone: 'bitti',
    statSteps: 'adım',
    waitingKids: 'alt ajanlarını bekliyor',
    emptyTree: 'Bu oturumda henüz alt ajan çalışmadı.',
    office: 'Ofis',
    tree: 'Ağaç',
    endedButton: (owner, n) => `${owner} · ${n} biten iş`,
    pickAgent: 'Ayrıntı için bir ajan seç',
    endedList: 'Bitenler',
    stoppedLower: 'durdu',
    doneLower: 'bitti',
    waitingLower: 'bekliyor',
    runningLower: 'çalışıyor',
    more: n => `ve ${n} ajan daha (Ağaç görünümünde)`,
    task: 'Görevi',
    recent: 'Son adımlar',
    answer: 'Cevabı',
    close: 'Kapat',
  },
  en: {
    title: 'Agent office',
    command: 'agent-office',
    commandHelp: 'Open the office panel that shows subagents',
    opened: 'Agent office opened.',
    unknownModel: 'Unknown model',
    agent: 'Agent',
    span: (m, s) => (m === 0 ? `${s}s` : `${m}m ${s < 10 ? '0' : ''}${s}s`),
    steps: n => (n === 1 ? '1 step' : `${n} steps`),
    kind: { read: 'reading', write: 'writing', run: 'shell', search: 'search' },
    done: 'Done',
    stopped: 'Stopped',
    waiting: 'waiting',
    running: 'running',
    starting: 'New · starting',
    justStarted: 'New · just started',
    noAgents: 'No subagents',
    counts: (running, ended) => `${running} running · ${ended} done`,
    mood: { working: 'working', waiting: 'waiting on agents', idle: 'your turn' },
    mainSession: 'main chat',
    emptyOffice: 'No subagents running right now.',
    emptyOfficeHint: 'When one starts, its room shows up here.',
    officeLabel: 'Agent office',
    treeLabel: 'Agent tree',
    statRunning: 'running',
    statDone: 'done',
    statSteps: 'steps',
    waitingKids: 'waiting on its subagents',
    emptyTree: 'No subagents have run in this session yet.',
    office: 'Office',
    tree: 'Tree',
    endedButton: (owner, n) => `${owner} · ${n} finished`,
    pickAgent: 'Pick an agent for details',
    endedList: 'Finished',
    stoppedLower: 'stopped',
    doneLower: 'done',
    waitingLower: 'waiting',
    runningLower: 'running',
    more: n => `and ${n} more (see Tree view)`,
    task: 'Task',
    recent: 'Recent steps',
    answer: 'Answer',
    close: 'Close',
  },
}

// register() ayarlarla bunları kurar; her yeniden yüklemede modül baştan çalışır.
let L: Dict = DICT.en
let OWNER = DEFAULT_OWNER
// Eski kayıtlarda öbür dilin varsayılan adı kalmış olabilir; ikisi de "adsız" sayılır.
const UNNAMED = new Set([DICT.tr.agent, DICT.en.agent])

const applyOptions = (options: PluginOptions | undefined): void => {
  const lang = options?.language
  L = lang === 'tr' ? DICT.tr : DICT.en
  const owner = options?.owner
  const name = typeof owner === 'string' ? owner.replace(/\s+/g, ' ').trim() : ''
  OWNER = name === '' ? DEFAULT_OWNER : name
}

// Yönetici odasındaki isim levhası 34 birim geniş, yazı 6 punto kalın büyük harf.
// Harf genişliği kabaca tahmin edilir (M/W geniş, I/1 dar); kenarlarda pay kalsın diye
// en çok 30 birim yazılır, sığmayan ad "…" ile kısalır ("KILLUA", "CLAUDE" olduğu gibi kalır).
const PLATE_ROOM = 30
const glyph = (c: string): number =>
  /[MWÆŒ@]/.test(c) ? 5.4 : /[IÍÌÎÏİ1!|.,:;' ]/.test(c) ? 2 : /[JLFTEPS0-9]/.test(c) ? 3.8 : 4.4
const plate = (name: string): string => {
  const chars = [...name.toUpperCase()]
  const wide = (list: string[]): number => list.reduce((sum, c) => sum + glyph(c), 0)
  if (wide(chars) <= PLATE_ROOM) return chars.join('')
  const kept: string[] = []
  for (const c of chars) {
    if (wide([...kept, c]) + 4 > PLATE_ROOM) break
    kept.push(c)
  }

  return `${kept.join('').trimEnd()}…`
}
// Biten ajanın odası bu kadar süre soluk kalır, sonra ofisten kalkar.
const DONE_MS = 60_000
const MAX_ROWS = 80
// Biten oda bu kadar süre kutlar (lamba, konfeti), sonra soluklaşır.
const CELEBRATE_MS = 10_000
// Kutlamadan sonra karakter bu süre içinde kapıya yürür, sonra oda boş kalır.
const LEAVE_MS = 6_000
// Kullanıcı bu kadar süre yazmazsa yönetici uyuklar.
const NAP_MS = 300_000
// Boşta hareketi bu aralıkla değişir; panel de boştayken bu aralıkla yenilenir.
const IDLE_SLOT_MS = 30_000
const TASK_MAX = 1500
const MAX_ENDED_LISTED = 15

const NO_ROWS: AgentRow[] = []
const UI0: UiState = { view: 'office', selected: '' }

const agentsAtom = atom({ plugin: 'ajan-ofisi', key: 'agents' } as const, NO_ROWS, {
  shape: 'agents-1',
})
const uiAtom = atom({ plugin: 'ajan-ofisi', key: 'ui' } as const, UI0, {
  shape: 'ui-1',
})
const mainAtom = atom({ plugin: 'ajan-ofisi', key: 'mainModel' } as const, '')
const nowAtom = atom({ plugin: 'ajan-ofisi', key: 'now' } as const, 0)
// Ana oturum bir turun içindeyse true; tur bitip sıra kullanıcıya geçince false.
const busyAtom = atom({ plugin: 'ajan-ofisi', key: 'mainBusy' } as const, false)
// Sıranın kullanıcıya geçtiği an; bilinmiyorsa 0.
const idleAtom = atom({ plugin: 'ajan-ofisi', key: 'idleSince' } as const, 0)

type Engine = EngineInterface
type Family = 'fable' | 'opus' | 'sonnet' | 'haiku' | 'other'

// ---------- küçük yardımcılar ----------

const family = (model: string): Family => {
  const s = model.toLowerCase()
  if (s.includes('fable') || s.includes('mythos')) return 'fable'
  if (s.includes('opus')) return 'opus'
  if (s.includes('sonnet')) return 'sonnet'
  if (s.includes('haiku')) return 'haiku'

  return 'other'
}

const modelLabel = (model: string): string => {
  const hit = /(fable|mythos|opus|sonnet|haiku)[-_ ]?(\d+)?(?:[-_.](\d+))?/i.exec(model)
  const word = hit?.[1]
  if (word === undefined) return model === '' ? L.unknownModel : model
  const name = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  const major = hit?.[2]
  const minor = hit?.[3]
  if (major === undefined || major.length > 2) return name
  if (minor === undefined || minor.length > 2) return `${name} ${major}`

  return `${name} ${major}.${minor}`
}

const COLOR: Record<Family, string> = {
  fable: '#8F87E8',
  opus: '#E0683C',
  sonnet: '#4A98E6',
  haiku: '#27AE84',
  other: '#9A998F',
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const clip = (s: string, n: number): string =>
  s.length <= n ? s : `${s.slice(0, Math.max(1, n - 1))}…`

const span = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60

  return L.span(m, s)
}

// Oda köşesi dar: süre saat biçiminde yazılır (2:14, 1:02:14).
const stopwatch = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const two = (n: number): string => (n < 10 ? `0${n}` : `${n}`)

  return h === 0 ? `${m}:${two(s)}` : `${h}:${two(m)}:${two(s)}`
}

const base = (path: string): string => {
  const parts = path.split('/').filter(p => p !== '')

  return parts[parts.length - 1] ?? path
}

const DETAIL_KEYS = [
  'file_path',
  'notebook_path',
  'path',
  'command',
  'pattern',
  'query',
  'url',
  'description',
  'skill',
] as const

const describe = (e: { tool: string }): string => {
  const args = e as unknown as Record<string, unknown>
  const tool = e.tool.startsWith('mcp__') ? (e.tool.split('__').pop() ?? e.tool) : e.tool
  let detail = ''
  for (const key of DETAIL_KEYS) {
    const value = args[key]
    if (typeof value === 'string' && value !== '') {
      detail = key.endsWith('path') ? base(value) : value
      break
    }
  }
  detail = detail.replace(/\s+/g, ' ').trim()

  return clip(detail === '' ? tool : `${tool} · ${detail}`, 80)
}

type Kind = 'read' | 'write' | 'run' | 'search' | ''

const kindWord = (kind: Kind): string => (kind === '' ? '' : L.kind[kind])

const toolOf = (last: string): string => last.split(' · ')[0] ?? ''

const detailOf = (last: string): string =>
  last.includes(' · ') ? last.slice(last.indexOf(' · ') + 3) : last

// Son adımın araç adından işin türünü çıkarır; tanımadığı araçta boş döner.
const kindOf = (last: string): Kind => {
  const tool = toolOf(last).toLowerCase()
  if (tool === '') return ''
  if (/edit|write/.test(tool)) return 'write'
  if (/bash|process|command|terminal/.test(tool)) return 'run'
  if (/grep|glob|search|fetch|find/.test(tool)) return 'search'
  if (/read/.test(tool)) return 'read'

  return ''
}

const isEnded = (row: AgentRow): boolean => row.status === 'done' || row.status === 'failed'

const prune = (rows: AgentRow[]): AgentRow[] => {
  if (rows.length <= MAX_ROWS) return rows
  const extra = rows.length - MAX_ROWS
  const drop = new Set(
    rows
      .filter(isEnded)
      .slice(0, extra)
      .map(r => r.id),
  )

  return rows.filter(r => !drop.has(r.id))
}

// ---------- durum yazan işlemler ----------

const addAgent = async ($: Engine, row: AgentRow): Promise<void> => {
  await update($, agentsAtom, rows =>
    prune(rows.some(r => r.id === row.id) ? rows : [...rows, row]),
  )
  await update($, nowAtom, now => Math.max(now, row.startedAt))
}

const noteStep = async ($: Engine, id: string, what: string): Promise<void> => {
  const now = await $.clock.now()
  await update($, agentsAtom, rows => {
    if (!rows.some(r => r.id === id)) {
      const fresh: AgentRow = {
        id,
        name: L.agent,
        type: '',
        model: '',
        status: 'running',
        steps: 1,
        last: what,
        recent: [what],
        startedAt: now,
        at: now,
      }

      return prune([...rows, fresh])
    }

    return rows.map(r => {
      if (r.id !== id) return r
      const { endedAt: _endedAt, ...open } = r

      return {
        ...open,
        status: 'running' as const,
        steps: r.steps + 1,
        last: what,
        recent: [...r.recent, what].slice(-6),
        at: now,
      }
    })
  })
}

const endAgent = async (
  $: Engine,
  id: string,
  isOk: boolean,
  answer: string,
): Promise<void> => {
  const now = await $.clock.now()
  await update($, agentsAtom, rows =>
    rows.map(r =>
      r.id === id
        ? {
            ...r,
            status: isOk ? ('done' as const) : ('failed' as const),
            endedAt: now,
            at: now,
            answer: clip(answer, 6000),
          }
        : r,
    ),
  )
  await update($, nowAtom, old => Math.max(old, now))
}

const setBusy = async ($: Engine, isBusy: boolean): Promise<void> => {
  // Tur her bittiğinde bekleme süresi baştan başlar (panel yeni yüklendiyse de).
  if (!isBusy) {
    const now = await $.clock.now()
    await update($, idleAtom, () => now)
  }
  if ((await read($, busyAtom)) !== isBusy) await update($, busyAtom, () => isBusy)
}

const reconcile = (rows: AgentRow[], list: AgentInfo[], now: number): AgentRow[] => {
  let out = rows
  for (const info of list) {
    const ended =
      info.status === 'completed' || info.status === 'failed' || info.status === 'killed'
    const row = out.find(r => r.id === info.id)
    if (row === undefined) {
      if (ended) continue
      const fresh: AgentRow = {
        id: info.id,
        name: info.description === '' ? (info.name ?? L.agent) : info.description,
        type: info.type,
        model: '',
        status: info.status === 'waiting' || info.status === 'idle' ? 'waiting' : 'running',
        steps: 0,
        last: '',
        recent: [],
        startedAt: now,
        at: now,
      }
      if (info.parentId !== undefined) fresh.parentId = info.parentId
      out = [...out, fresh]
      continue
    }
    if (isEnded(row)) continue
    if (ended) {
      const status = info.status === 'completed' ? ('done' as const) : ('failed' as const)
      out = out.map(r => (r.id === row.id ? { ...r, status, endedAt: now, at: now } : r))
      continue
    }
    const status =
      info.status === 'waiting' || info.status === 'idle' ? ('waiting' as const) : ('running' as const)
    if (status !== row.status || (row.type === '' && info.type !== '')) {
      out = out.map(r =>
        r.id === row.id
          ? {
              ...r,
              status,
              type: r.type === '' ? info.type : r.type,
              name: UNNAMED.has(r.name) && info.description !== '' ? info.description : r.name,
            }
          : r,
      )
    }
  }

  return out
}

const tick = async ($: Engine): Promise<void> => {
  const now = await $.clock.now()
  let list: AgentInfo[] = []
  try {
    list = await $.agent.list()
  } catch {
    list = []
  }
  const before = await read($, agentsAtom)
  const after = reconcile(before, list, now)
  if (after !== before) await update($, agentsAtom, rows => reconcile(rows, list, now))
  const isLive = after.some(r => r.endedAt === undefined || now - r.endedAt < DONE_MS + 15_000)
  const shownNow = await read($, nowAtom)
  const isNewSlot = Math.floor(now / IDLE_SLOT_MS) !== Math.floor(shownNow / IDLE_SLOT_MS)
  if (isLive || isNewSlot) await update($, nowAtom, () => now)
  const main = await read($, mainAtom)
  if (main === '') {
    try {
      const model = await $.session.model()
      if (model !== '') await update($, mainAtom, () => model)
    } catch {
      // model sorulamadıysa simge gri kalır
    }
  }
}

// ---------- çizim: ortak parçalar ----------

const FONT = '-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif'
const BG = '#17171f'
const HALL = '#22222e'
const FLOOR = '#2a2a38'
const FLOOR_OFF = '#1f1f29'
const WALL = '#4f4f66'
const WALL_OFF = '#34343f'
const INK = '#f0f0f5'
const SUB = '#a8a8ba'
const OK = '#7ac943'
const BAD = '#e24b4a'

const BODY =
  '<rect x="1" y="2" width="6" height="4"/><rect x="2" y="6" width="4" height="3"/><rect x="1" y="7" width="6" height="1"/><rect x="2" y="9" width="1" height="1"/><rect x="5" y="9" width="1" height="1"/><rect x="2" y="4" width="1" height="1" fill="#17171f"/><rect x="5" y="4" width="1" height="1" fill="#17171f"/>'

const DEFS = `<defs>
<g id="s-fable"><g fill="${COLOR.fable}">${BODY}</g><g fill="#d6d2fa"><rect x="3" y="0" width="2" height="1"/><rect x="2" y="1" width="4" height="1"/><rect x="0" y="2" width="8" height="1"/></g></g>
<g id="s-opus"><g fill="${COLOR.opus}">${BODY}</g><g fill="#f5b53d"><rect x="1" y="1" width="6" height="1"/><rect x="1" y="0" width="1" height="1"/><rect x="3" y="0" width="2" height="1"/><rect x="6" y="0" width="1" height="1"/></g></g>
<g id="s-sonnet"><g fill="${COLOR.sonnet}">${BODY}</g><g fill="#cfe3f8"><rect x="4" y="1" width="1" height="1"/><rect x="5" y="0" width="1" height="1"/><rect x="6" y="-1" width="1" height="1"/></g></g>
<g id="s-haiku"><g fill="${COLOR.haiku}">${BODY}</g><g fill="#a5d65c"><rect x="3" y="1" width="1" height="1"/><rect x="2" y="0" width="1" height="1"/><rect x="4" y="0" width="2" height="1"/></g></g>
<g id="s-other"><g fill="${COLOR.other}">${BODY}</g></g>
<g id="desk"><rect x="6" y="17" width="24" height="1" fill="#f0a52e"/><rect x="7" y="18" width="22" height="6" fill="#b9731a"/><rect x="7" y="20" width="22" height="0.5" fill="#85500d"/><rect x="15" y="13" width="6" height="4" fill="#8d8c84"/><rect x="24" y="15" width="2" height="2" fill="#d6d4ca"/><rect x="26" y="15.5" width="0.5" height="1" fill="#d6d4ca"/><rect x="8" y="15" width="2" height="2" fill="#a0421f"/><g fill="#6aa224"><rect x="8" y="13" width="2" height="2"/><rect x="7" y="14" width="1" height="1"/><rect x="10" y="14" width="1" height="1"/><rect x="9" y="12" width="1" height="1"/></g></g>
<g id="live"><rect x="17" y="14.5" width="2" height="1" fill="#f4f2ea"><animate attributeName="opacity" values="1;0.3;1" dur="0.9s" repeatCount="indefinite"/></rect><rect x="24.5" y="13" width="0.5" height="1" fill="#b9b7ae"><animate attributeName="opacity" values="0;1;0" dur="1.8s" repeatCount="indefinite"/></rect><rect x="25.5" y="12" width="0.5" height="1" fill="#b9b7ae"><animate attributeName="opacity" values="0;1;0" dur="1.8s" begin="0.6s" repeatCount="indefinite"/></rect></g>
<g id="k-read"><rect x="0" y="1" width="9" height="7" fill="#4A98E6"/><rect x="4" y="1" width="1" height="7" fill="#1d4f8a"/><rect x="1" y="3" width="2" height="1" fill="#cfe3f8"/><rect x="6" y="3" width="2" height="1" fill="#cfe3f8"/><rect x="1" y="5" width="2" height="1" fill="#cfe3f8"/><rect x="6" y="5" width="2" height="1" fill="#cfe3f8"/></g>
<g id="k-write"><rect x="6" y="0" width="2" height="2" fill="#E0683C"/><rect x="4" y="2" width="2" height="2" fill="#f0a52e"/><rect x="2" y="4" width="2" height="2" fill="#f0a52e"/><rect x="0" y="6" width="2" height="2" fill="#17171f"/></g>
<g id="k-run"><rect x="0" y="0" width="9" height="8" fill="#17171f"/><rect x="1" y="2" width="1" height="1" fill="#7ac943"/><rect x="2" y="3" width="1" height="1" fill="#7ac943"/><rect x="1" y="4" width="1" height="1" fill="#7ac943"/><rect x="4" y="5" width="3" height="1" fill="#7ac943"/></g>
<g id="k-search"><rect x="0" y="0" width="6" height="6" fill="#17171f"/><rect x="1" y="1" width="4" height="4" fill="#9cc8f5"/><rect x="5" y="5" width="2" height="2" fill="#17171f"/><rect x="7" y="7" width="2" height="1" fill="#17171f"/></g>
</defs>`

const HOP =
  '<animateTransform attributeName="transform" type="translate" values="0,0;0,-0.5;0,0" dur="0.6s" repeatCount="indefinite"/>'
const WALK_IN =
  '<animateTransform attributeName="transform" type="translate" values="-8,0;0,0;0,-0.5;0,0;0,-0.5;0,0" keyTimes="0;0.3;0.45;0.6;0.8;1" dur="3s" repeatCount="indefinite"/>'

const TYPE =
  '<animateTransform attributeName="transform" type="translate" values="0,0;0,-0.25;0,0" dur="0.28s" repeatCount="indefinite"/>'
const SWAY =
  '<animateTransform attributeName="transform" type="translate" values="-0.25,0;0.25,0;-0.25,0" dur="1.6s" repeatCount="indefinite"/>'

const dots = (x: number, y: number): string =>
  [0, 1, 2]
    .map(
      i =>
        `<rect x="${x + i * 2}" y="${y}" width="1" height="1" fill="${SUB}"><animate attributeName="opacity" values="1;0.2;1" dur="1.5s" begin="${i * 0.5}s" repeatCount="indefinite"/></rect>`,
    )
    .join('')

const text = (
  x: number,
  y: number,
  body: string,
  options: { size?: number; fill?: string; bold?: boolean; anchor?: 'start' | 'middle' | 'end' } = {},
): string =>
  `<text x="${x}" y="${y}" font-size="${options.size ?? 12}" fill="${options.fill ?? SUB}"${options.bold === true ? ' font-weight="600"' : ''}${options.anchor === undefined ? '' : ` text-anchor="${options.anchor}"`}>${esc(body)}</text>`

const check = (x: number, y: number): string =>
  `<path d="M${x},${y} l5,5 l10,-10" fill="none" stroke="${OK}" stroke-width="2.5" stroke-linecap="round"/>`

const cross = (x: number, y: number): string =>
  `<path d="M${x},${y - 5} l10,10 M${x + 10},${y - 5} l-10,10" fill="none" stroke="${BAD}" stroke-width="2.5" stroke-linecap="round"/>`

type Shown = 'running' | 'waiting' | 'done' | 'failed' | 'new'

const shownAs = (row: AgentRow, rows: AgentRow[], now: number): Shown => {
  if (row.status === 'done' || row.status === 'failed') return row.status
  if (row.status === 'waiting') return 'waiting'
  if (rows.some(r => r.parentId === row.id && !isEnded(r))) return 'waiting'
  if (row.steps <= 1 && now - row.startedAt < 8000) return 'new'

  return 'running'
}

const statusLine = (row: AgentRow, shown: Shown, now: number, room: number): string => {
  const end = row.endedAt ?? now
  if (shown === 'done') return clip(`${L.done} · ${span(end - row.startedAt)}`, room)
  if (shown === 'failed') return clip(`${L.stopped} · ${span(end - row.startedAt)}`, room)
  const tail = ` · ${L.steps(row.steps)}`
  if (shown === 'waiting') return clip(`${L.waiting}${tail}`, room)
  if (row.last === '') return clip(shown === 'new' ? L.starting : `${L.running}${tail}`, room)
  const what = row.last.includes(' · ') ? (row.last.split(' · ')[1] ?? row.last) : row.last

  return `${clip(what, Math.max(4, room - tail.length))}${tail}`
}

const wrap = (w: number, h: number, body: string, label: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}" font-family="${FONT}" role="img"><title>${esc(label)}</title><rect width="${w}" height="${h}" rx="10" fill="${BG}"/>${DEFS}${body}</svg>`

// ---------- çizim: ofis ----------

const RH = 112
const ROOM_GAP = 12
const RIGHT = 346
const BOSS_BOTTOM = 170
const GOLD = '#c9a24a'
const FLOOR_STRIP = '#24242f'

type Slot = { row: AgentRow; level: number; parent: number; left: number; top: number }

const isDayAt = (now: number): boolean => {
  const hour = new Date(now).getHours()

  return hour >= 7 && hour < 19
}

// Balon karakterin sağında durur, kuyruğu sola, karaktere bakar.
const bubble = (x: number, y: number, kind: Kind, body: string, wideMax: number): string => {
  const iconWide = kind === '' ? 0 : 17
  const label = clip(body, Math.max(4, Math.floor((wideMax - 18 - iconWide) / 6.3)))
  const wide = Math.min(wideMax, 18 + iconWide + label.length * 6.3)
  const icon =
    kind === ''
      ? ''
      : `<g transform="translate(${x + 6},${y + 5}) scale(1.4)" shape-rendering="crispEdges"><use href="#k-${kind}"/></g>`

  return [
    `<rect x="${x}" y="${y}" width="${wide.toFixed(1)}" height="21" rx="6" fill="${INK}"/>`,
    `<path d="M${x + 2},${y + 6} l-8,4.5 l8,4.5z" fill="${INK}"/>`,
    icon,
    `<text x="${x + 7 + iconWide}" y="${y + 14.5}" font-size="11" fill="${BG}">${esc(label)}</text>`,
  ].join('')
}

const CONFETTI = ['#E0683C', '#f0c040', '#8F87E8', '#27AE84', '#4A98E6']

const confetti = (x: number, y: number): string =>
  CONFETTI.map((fill, i) => {
    const dur = (1.3 + ((i * 3) % 5) * 0.2).toFixed(1)

    return `<rect x="${x + 14 + i * 22}" y="${y + 10}" width="3" height="3" fill="${fill}"><animate attributeName="y" values="${y + 10};${y + RH - 30}" dur="${dur}s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;1;0" dur="${dur}s" repeatCount="indefinite"/></rect>`
  }).join('')

// Alt ajan odasının döşemesi: pencere, raf, modelin renginde halı, sandalye.
// Sahne birimiyle çizilir (1 birim = 4 piksel).
const furniture = (tint: string, isDay: boolean): string => {
  const sky = isDay ? '#7fb8ea' : '#1b2a4a'

  return [
    `<rect x="6" y="0.5" width="7" height="6" fill="${WALL}"/><rect x="6.5" y="1" width="2.75" height="5" fill="${sky}"/><rect x="9.75" y="1" width="2.75" height="5" fill="${sky}"/><rect x="10.5" y="1.75" width="1" height="1" fill="${isDay ? '#f7d354' : '#f0e9b0'}"/>`,
    '<rect x="23" y="5.5" width="8" height="0.75" fill="#6b4520"/><rect x="23.5" y="3" width="1" height="2.5" fill="#E0683C"/><rect x="24.75" y="3.5" width="1" height="2" fill="#f0c040"/><rect x="26" y="3" width="1.25" height="2.5" fill="#27AE84"/><rect x="28.5" y="4" width="1.5" height="1.5" fill="#a8a8ba"/>',
    `<rect x="4" y="22.5" width="28" height="2.75" fill="${tint}" opacity="0.8"/>`,
    '<rect x="14" y="8.5" width="8" height="8.5" fill="#3d3d52"/>',
  ].join('')
}

type Prop = 'books' | 'screen' | 'board' | ''

// Ajanın türüne göre odasına gelen ek eşya.
const propOf = (type: string | undefined): Prop => {
  // Tür boş gelebilir (eski kayıt, türsüz başlatma); o zaman ek eşya yok.
  const t = (type ?? '').toLowerCase()
  if (/explore|fetch|guide|research/.test(t)) return 'books'
  if (/plan/.test(t)) return 'board'
  if (/general|^claude$/.test(t)) return 'screen'

  return ''
}

const PROP_ART: Record<Prop, string> = {
  books:
    '<rect x="21.5" y="16" width="2.25" height="1" fill="#E0683C"/><rect x="21.25" y="15" width="2.25" height="1" fill="#4A98E6"/><rect x="21.5" y="14" width="2.25" height="1" fill="#f0c040"/>',
  screen:
    '<rect x="21.5" y="12.5" width="2.5" height="3.5" fill="#8d8c84"/><rect x="21.75" y="12.75" width="2" height="2.75" fill="#9cc8f5"/><rect x="22.5" y="16" width="0.5" height="1" fill="#77766f"/>',
  board:
    '<rect x="15" y="0.5" width="6.5" height="5" fill="#b98a4a"/><rect x="15.75" y="1.25" width="2" height="1.5" fill="#f0c040"/><rect x="18.5" y="1.5" width="2" height="1.5" fill="#f4f2ea"/><rect x="16.5" y="3.5" width="2" height="1.25" fill="#9cc8f5"/>',
  '': '',
}

// Her 10 adımda masaya bir kâğıt eklenir, en çok 6.
const papers = (steps: number): string => {
  const count = Math.min(6, Math.floor(steps / 10))
  let out = ''
  for (let i = 0; i < count; i++) {
    out += `<rect x="${11.5 + (i % 2) * 0.25}" y="${16.5 - i * 0.5}" width="2.75" height="0.5" fill="${i % 2 === 0 ? '#f4f2ea' : '#d6d4ca'}"/>`
  }

  return out
}

const SECOND_CUP =
  '<rect x="27.5" y="15" width="2" height="2" fill="#d6d4ca"/><rect x="29.5" y="15.5" width="0.5" height="1" fill="#d6d4ca"/>'
const WALK_OUT =
  '<animateTransform attributeName="transform" type="translate" values="0,0;-12,0" dur="4s" fill="freeze"/><animate attributeName="opacity" values="1;1;0" keyTimes="0;0.7;1" dur="4s" fill="freeze"/>'

const room = (slot: Slot, rows: AgentRow[], now: number): string => {
  const { row, left: x, top: y } = slot
  const w = RIGHT - x
  const cy = y + RH / 2
  const fam = family(row.model)
  const tint = COLOR[fam]
  const shown = shownAs(row, rows, now)
  const off = shown === 'done' || shown === 'failed'
  const active = shown === 'running' || shown === 'new'
  // Yeni biten oda önce kutlar, sonra soluklaşır.
  const fresh = off && row.endedAt !== undefined && now - row.endedAt < CELEBRATE_MS
  const dim = off && !fresh
  // Kutlama bitince karakter kapıya yürür, ardından oda boş kalır.
  const leaving = dim && row.endedAt !== undefined && now - row.endedAt < CELEBRATE_MS + LEAVE_MS
  const gone = dim && !leaving
  const lampColor = shown === 'done' ? OK : BAD
  const kind = kindOf(row.last)
  const prop = propOf(row.type)
  const elapsed = (row.endedAt ?? now) - row.startedAt
  const frame =
    shown === 'new'
      ? `stroke="${tint}" stroke-width="1.5" stroke-dasharray="6 4"`
      : fresh
        ? `stroke="${lampColor}" stroke-width="1.5"`
        : `stroke="${dim ? WALL_OFF : WALL}" stroke-width="1.5"`
  const mover =
    shown === 'new'
      ? WALK_IN
      : shown !== 'running'
        ? ''
        : kind === 'write' || kind === 'run'
          ? TYPE
          : kind === 'read' || kind === 'search'
            ? SWAY
            : HOP
  const wave =
    fresh && shown === 'done'
      ? `<rect x="21" y="11" width="1" height="2" fill="${tint}"><animateTransform attributeName="transform" type="rotate" values="0 21.5 13;40 21.5 13;0 21.5 13" dur="0.6s" repeatCount="indefinite"/></rect>`
      : ''
  const lamp = fresh
    ? `<rect x="28" y="14.5" width="0.5" height="2.5" fill="#77766f"/><rect x="27.25" y="12.5" width="2" height="2" fill="${lampColor}"><animate attributeName="opacity" values="1;0.45;1" dur="1.2s" repeatCount="indefinite"/></rect>`
    : ''
  const figure = gone
    ? ''
    : `<g>${leaving ? WALK_OUT : mover}<use href="#s-${fam}" transform="translate(14,7)"/>${wave}</g>`
  const onDesk = `${prop === 'board' ? '' : PROP_ART[prop]}${papers(row.steps)}${elapsed >= 300_000 && !fresh ? SECOND_CUP : ''}`
  const scene = `<g transform="translate(${x - 12},${y + 8}) scale(4)" shape-rendering="crispEdges"${dim ? ' opacity="0.4"' : ''}>${furniture(tint, isDayAt(now))}${prop === 'board' ? PROP_ART.board : ''}${figure}<use href="#desk"/>${onDesk}${lamp}${active ? '<use href="#live"/>' : ''}${shown === 'waiting' ? dots(23, 9) : ''}</g>`

  const tx = x + 124
  const textWide = w - 124 - 12
  const status = off
    ? `${shown === 'done' ? L.done : L.stopped} · ${L.steps(row.steps)}`
    : active && row.last !== ''
      ? `${kind === '' ? clip(toolOf(row.last), 12) : kindWord(kind)} · ${L.steps(row.steps)}`
      : statusLine(row, shown, now, 22)
  // Dar odada model adı düşer; model zaten karakterin renginden ve şapkasından belli.
  const lineRoom = Math.max(8, Math.floor((textWide - (off ? 26 : 0)) / 5.2))
  const full = `${modelLabel(row.model)} · ${status}`
  const line = full.length <= lineRoom ? full : clip(status, lineRoom)
  const mark =
    shown === 'done' ? check(x + w - 30, y + 40) : shown === 'failed' ? cross(x + w - 26, y + 42) : ''
  const said =
    active && row.last !== '' ? bubble(tx + 4, y + 56, kind, detailOf(row.last), textWide - 4) : ''

  return [
    `<rect x="${x}" y="${y}" width="${w}" height="${RH}" rx="6" fill="${dim ? FLOOR_OFF : FLOOR}" ${frame}/>`,
    dim
      ? ''
      : `<rect x="${x + 1}" y="${y + RH - 24}" width="${w - 2}" height="23" rx="5" fill="${FLOOR_STRIP}"/>`,
    `<line x1="${x}" y1="${cy - 11}" x2="${x}" y2="${cy + 11}" stroke="${dim ? '#77766f' : tint}" stroke-width="4" stroke-linecap="round"/>`,
    scene,
    fresh && shown === 'done' ? confetti(x, y) : '',
    text(tx, y + 26, clip(row.name, Math.max(6, Math.floor((textWide - 44) / 7.8))), {
      size: 14,
      fill: dim ? SUB : INK,
      bold: true,
    }),
    text(x + w - 12, y + 26, stopwatch((row.endedAt ?? now) - row.startedAt), {
      fill: dim ? SUB : INK,
      anchor: 'end',
    }),
    text(tx, y + 44, line, fresh ? { fill: lampColor } : {}),
    mark,
    said,
  ].join('')
}

const counts = (rows: AgentRow[]): string => {
  const running = rows.filter(r => !isEnded(r)).length
  const ended = rows.length - running

  return rows.length === 0 ? L.noAgents : L.counts(running, ended)
}

// Duvar saati gerçek saati gösterir.
const wallClock = (cx: number, cy: number, now: number): string => {
  const at = new Date(now)
  const minute = at.getMinutes()
  const hourTurn = ((at.getHours() % 12) + minute / 60) * 30
  const hand = (turn: number, long: number, wide: number): string =>
    `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - long}" stroke="${BG}" stroke-width="${wide}" stroke-linecap="round" transform="rotate(${turn.toFixed(1)} ${cx} ${cy})"/>`

  return `<circle cx="${cx}" cy="${cy}" r="11" fill="${INK}" stroke="${GOLD}" stroke-width="2"/>${hand(hourTurn, 5, 2)}${hand(minute * 6, 8, 1.4)}`
}

const r = (x: number, y: number, w: number, h: number, fill: string): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`

// Yönetici odası: altın çerçeve, üç kanatlı pencere, kitaplık, koltuk, halı, geniş masa.
type Mood = 'working' | 'waiting' | 'idle'


type IdleAct = 'sip' | 'read' | 'window' | 'walk' | 'nap'

const IDLE_ACTS: IdleAct[] = ['sip', 'read', 'window', 'walk']

// Dolaşma: koltuktaki karakter kaybolur, masanın önünde (halının üstünde) belirir,
// sola pencere tarafına, sonra sağa kitaplık tarafına yürür ve koltuğuna döner.
// Masanın arkasından yürüyünce masa hizasında kayan bir gövde gibi duruyordu.
const STROLL_KEYS = '0;0.04;0.8;0.84;1'
const SEAT_FADE = `<animate attributeName="opacity" values="1;0;0;1;1" keyTimes="${STROLL_KEYS}" dur="28s" repeatCount="indefinite"/>`
const FLOOR_FADE = `<animate attributeName="opacity" values="0;1;1;0;0" keyTimes="${STROLL_KEYS}" dur="28s" repeatCount="indefinite"/>`
const STROLL =
  '<animateTransform attributeName="transform" type="translate" values="0,13;0,13;-11,13;-11,13;14,13;14,13;0,13;0,13" keyTimes="0;0.04;0.14;0.32;0.5;0.68;0.8;1" dur="28s" repeatCount="indefinite"/>'
const STEP =
  '<animateTransform attributeName="transform" type="translate" values="0,0;0,-0.25;0,0" dur="0.5s" repeatCount="indefinite"/>'

const bossRoom = (
  all: AgentRow[],
  main: string,
  now: number,
  isBusy: boolean,
  idleSince: number,
): string => {
  const fam = family(main)
  // Tur içindeyse çalışıyor; o sırada açık ajan varsa onları bekliyor; tur bittiyse sıra kullanıcıda.
  const mood: Mood = !isBusy ? 'idle' : all.some(r => !isEnded(r)) ? 'waiting' : 'working'
  // Sıra kullanıcıdayken: kahve, kitap, pencere ve dolaşma 30 saniyede bir değişir; uzun beklemede uyuklar.
  const act: IdleAct | '' =
    mood !== 'idle'
      ? ''
      : idleSince > 0 && now - idleSince >= NAP_MS
        ? 'nap'
        : (IDLE_ACTS[Math.floor(now / IDLE_SLOT_MS) % IDLE_ACTS.length] ?? 'sip')
  const face = COLOR[fam]
  const glance = `<g><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.15;0.6;0.75;1" dur="5s" repeatCount="indefinite"/><rect x="2" y="4" width="1" height="1" fill="${face}"/><rect x="5" y="4" width="1" height="1" fill="${face}"/><rect x="1" y="4" width="1" height="1" fill="${BG}"/><rect x="4" y="4" width="1" height="1" fill="${BG}"/></g>`
  const shutEyes = `<rect x="2" y="4" width="1" height="1" fill="${face}"/><rect x="5" y="4" width="1" height="1" fill="${face}"/><rect x="2" y="4.5" width="1" height="0.5" fill="${BG}"/><rect x="5" y="4.5" width="1" height="0.5" fill="${BG}"/>`
  const sprite =
    mood === 'working'
      ? `<g>${TYPE}<use href="#s-${fam}"/></g>`
      : mood === 'waiting'
        ? `<use href="#s-${fam}" transform="translate(0,0.5)"/>${dots(9, 2)}`
        : act === 'window'
          ? `<use href="#s-${fam}"/>${glance}`
          : act === 'walk'
            ? `<g>${SEAT_FADE}<use href="#s-${fam}"/></g>`
          : act === 'nap'
            ? `<g><animateTransform attributeName="transform" type="translate" values="0,0.5;0,1;0,0.5" dur="3s" repeatCount="indefinite"/><use href="#s-${fam}"/>${shutEyes}</g>`
            : `<use href="#s-${fam}"/>`
  const cupArt = r(160, 104, 8, 8, '#d6d4ca') + r(168, 106, 2, 4, '#d6d4ca')
  const cup =
    act === 'sip'
      ? `<g><animateTransform attributeName="transform" type="translate" values="0,0;-46,-18;-46,-18;0,0;0,0" keyTimes="0;0.2;0.5;0.7;1" dur="4s" repeatCount="indefinite"/>${cupArt}</g>`
      : cupArt
  const book =
    act === 'read'
      ? `<g><animateTransform attributeName="transform" type="translate" values="0,0;0,-1;0,0" dur="2.4s" repeatCount="indefinite"/>${r(90, 92, 24, 12, '#E0683C')}${r(101, 92, 2, 12, '#7a2f14')}</g>`
      : ''
  const stroller =
    act === 'walk'
      ? `<g transform="translate(86,72) scale(4)" opacity="0">${FLOOR_FADE}<g>${STROLL}<g>${STEP}<use href="#s-${fam}"/></g></g></g>`
      : ''
  const snore =
    act === 'nap'
      ? `<g fill="${SUB}" font-weight="700"><text x="122" y="72" font-size="9">z<animate attributeName="opacity" values="0;1;0" dur="3s" repeatCount="indefinite"/></text><text x="129" y="62" font-size="12">Z<animate attributeName="opacity" values="0;1;0" dur="3s" begin="1s" repeatCount="indefinite"/></text></g>`
      : ''
  const screen =
    mood === 'working'
      ? '<rect x="98" y="102" width="8" height="4" fill="#f4f2ea"><animate attributeName="opacity" values="1;0.3;1" dur="0.9s" repeatCount="indefinite"/></rect>'
      : r(98, 102, 8, 4, mood === 'waiting' ? '#f4f2ea' : '#55544e')
  const isDay = isDayAt(now)
  const sky = isDay ? '#7fb8ea' : '#1b2a4a'
  const view = isDay
    ? r(76, 34, 7, 7, '#f7d354') + r(36, 46, 10, 3, '#f4f2ea') + r(38, 44, 6, 2, '#f4f2ea') + r(56, 38, 8, 3, '#f4f2ea')
    : r(76, 34, 7, 7, '#f0e9b0') + r(38, 38, 2, 2, INK) + r(58, 50, 2, 2, INK) + r(62, 36, 1, 1, INK)
  const books =
    r(143, 31, 4, 11, '#E0683C') + r(148, 33, 4, 9, '#4A98E6') + r(153, 31, 5, 11, '#27AE84') + r(160, 34, 4, 8, '#f0c040') + r(166, 31, 6, 11, '#8F87E8') +
    r(143, 48, 6, 10, '#8F87E8') + r(151, 47, 4, 11, '#f0c040') + r(157, 50, 4, 8, '#E0683C') + r(164, 52, 8, 6, GOLD) +
    r(143, 63, 4, 11, '#27AE84') + r(149, 65, 5, 9, '#4A98E6') + r(160, 63, 4, 11, '#E0683C') + r(166, 66, 5, 8, INK)
  const decor = [
    r(30, 28, 62, 36, WALL) + r(32, 30, 18, 32, sky) + r(52, 30, 18, 32, sky) + r(72, 30, 18, 32, sky) + view,
    r(138, 26, 40, 52, '#6b4520') + r(141, 29, 34, 13, '#2a1c0e') + r(141, 45, 34, 13, '#2a1c0e') + r(141, 61, 34, 13, '#2a1c0e') + books,
    r(26, 128, 162, 32, '#4a3478') + r(30, 132, 154, 2, GOLD) + r(30, 154, 154, 2, GOLD) + r(30, 132, 2, 24, GOLD) + r(182, 132, 2, 24, GOLD),
    r(82, 64, 40, 52, '#5a3d7a') + r(86, 60, 32, 6, '#5a3d7a'),
    `<g transform="translate(86,72) scale(4)">${sprite}</g>`,
    r(38, 112, 140, 4, '#f0a52e') + r(42, 116, 132, 28, '#8a4f12') + r(42, 126, 132, 2, '#5e3508') + r(50, 132, 24, 8, '#5e3508') + r(142, 132, 24, 8, '#5e3508'),
    r(90, 96, 24, 16, '#8d8c84') + screen + book,
    r(122, 104, 34, 8, GOLD),
    cup,
    r(50, 104, 8, 8, '#a0421f') + r(50, 92, 8, 12, '#6aa224') + r(46, 96, 4, 4, '#6aa224') + r(58, 98, 4, 4, '#6aa224'),
    r(70, 92, 2, 20, GOLD) + r(64, 86, 14, 6, '#f0c040'),
    stroller,
  ].join('')

  return [
    `<rect x="14" y="14" width="332" height="156" rx="6" fill="#2d2a3d" stroke="${GOLD}" stroke-width="2"/>`,
    `<rect x="19" y="19" width="322" height="146" rx="4" fill="none" stroke="${GOLD}" stroke-opacity="0.35"/>`,
    `<g shape-rendering="crispEdges">${decor}</g>`,
    `<text x="139" y="110.5" font-size="6" font-weight="700" fill="${BG}" text-anchor="middle">${esc(plate(OWNER))}</text>`,
    snore,
    wallClock(324, 38, now),
    `<line x1="17" y1="${BOSS_BOTTOM}" x2="31" y2="${BOSS_BOTTOM}" stroke="${COLOR[fam]}" stroke-width="4" stroke-linecap="round"/>`,
    text(200, 70, clip(OWNER, 14), { size: 16, fill: INK, bold: true }),
    text(200, 89, main === '' ? L.mainSession : `${modelLabel(main)} · ${L.mainSession}`),
    text(200, 109, counts(all)),
    text(200, 129, L.mood[mood], { fill: mood === 'idle' ? SUB : INK }),
  ].join('')
}

const office = (
  all: AgentRow[],
  main: string,
  now: number,
  isBusy: boolean,
  idleSince: number,
): string => {
  const W = 360
  const rows = all.filter(r => r.endedAt === undefined || now - r.endedAt < DONE_MS)
  const ids = new Set(rows.map(r => r.id))
  // Her ajan tam genişlikte tek oda; alt ajan, başlatanın altında ve içeriden başlar.
  const slots: Slot[] = []
  const walk = (row: AgentRow, level: number, parent: number): void => {
    const index = slots.length
    slots.push({
      row,
      level,
      parent,
      left: 38 + Math.min(level, 3) * 24,
      top: BOSS_BOTTOM + 16 + index * (RH + ROOM_GAP),
    })
    if (level >= 5) return
    for (const kid of rows.filter(r => r.parentId === row.id)) walk(kid, level + 1, index)
  }
  for (const row of rows.filter(r => r.parentId === undefined || !ids.has(r.parentId))) {
    walk(row, 0, -1)
  }

  const halls: string[] = []
  const flows: string[] = []
  const lastKid = new Map<number, number>()
  let lastTop = 0
  for (const slot of slots) {
    const cy = slot.top + RH / 2
    const up = slots[slot.parent]
    const shown = shownAs(slot.row, rows, now)
    let path = `M24,${BOSS_BOTTOM} V${cy} H${slot.left}`
    if (up === undefined) {
      lastTop = cy
      halls.push(`<rect x="30" y="${cy - 6}" width="${slot.left - 30}" height="12" fill="${HALL}"/>`)
    } else {
      lastKid.set(slot.parent, cy)
      const from = up.left + 16
      if (slot.left > from) {
        halls.push(`<rect x="${from}" y="${cy - 6}" width="${slot.left - from}" height="12" fill="${HALL}"/>`)
      }
      path = `M${up.left + 10},${up.top + RH} V${cy} H${slot.left}`
    }
    if (shown === 'running' || shown === 'new') {
      flows.push(
        `<circle r="3.5" fill="${COLOR[family(slot.row.model)]}"><animateMotion dur="${(1.4 + (slot.row.steps % 5) * 0.2).toFixed(1)}s" repeatCount="indefinite" path="${path}"/></circle>`,
      )
    }
  }
  if (lastTop > 0) {
    halls.push(
      `<rect x="18" y="${BOSS_BOTTOM}" width="12" height="${lastTop + 6 - BOSS_BOTTOM}" rx="3" fill="${HALL}"/>`,
    )
  }
  for (const [index, cy] of lastKid) {
    const up = slots[index]
    if (up === undefined) continue
    halls.push(
      `<rect x="${up.left + 4}" y="${up.top + RH}" width="12" height="${cy + 6 - up.top - RH}" rx="3" fill="${HALL}"/>`,
    )
  }

  const last = slots[slots.length - 1]
  const H = last === undefined ? 232 : last.top + RH + 14
  const empty =
    last === undefined
      ? text(W / 2, 198, L.emptyOffice, { anchor: 'middle' }) +
        text(W / 2, 216, L.emptyOfficeHint, { anchor: 'middle' })
      : ''

  return wrap(
    W,
    H,
    halls.join('') + flows.join('') + bossRoom(all, main, now, isBusy, idleSince) + slots.map(s => room(s, rows, now)).join('') + empty,
    `${L.officeLabel}: ${counts(all)}`,
  )
}

// ---------- çizim: ağaç ----------

const tree = (rows: AgentRow[], main: string, now: number): string => {
  const W = 410
  const CARD = 70
  const PITCH = 80
  const ids = new Set(rows.map(r => r.id))
  const order: { row: AgentRow; level: number; parentIndex: number }[] = []
  const walk = (row: AgentRow, level: number, parentIndex: number): void => {
    const index = order.length
    order.push({ row, level, parentIndex })
    if (level >= 5) return
    for (const kid of rows.filter(r => r.parentId === row.id)) walk(kid, level + 1, index)
  }
  for (const row of rows.filter(r => r.parentId === undefined || !ids.has(r.parentId))) {
    walk(row, 0, -1)
  }

  const cardX = (level: number): number => 56 + level * 28
  const cardY = (index: number): number => 88 + index * PITCH
  const fam = family(main)
  const steps = rows.reduce((sum, r) => sum + r.steps, 0)
  const running = rows.filter(r => !isEnded(r)).length

  const stat = (x: number, value: string, label: string): string =>
    `<rect x="${x}" y="16" width="62" height="46" rx="8" fill="${FLOOR}"/>${text(x + 31, 36, value, { size: 15, fill: INK, bold: true, anchor: 'middle' })}${text(x + 31, 53, label, { size: 11, anchor: 'middle' })}`

  const head = [
    `<g transform="translate(14,18) scale(4)" shape-rendering="crispEdges"><use href="#s-${fam}"/></g>`,
    text(56, 36, clip(OWNER, 15), { size: 15, fill: INK, bold: true }),
    text(56, 54, main === '' ? L.mainSession : `${modelLabel(main)} · ${L.mainSession}`),
    stat(206, String(running), L.statRunning),
    stat(272, String(rows.length - running), L.statDone),
    stat(338, String(steps), L.statSteps),
  ].join('')

  const lines: string[] = []
  const cards: string[] = []
  order.forEach((item, index) => {
    const { row, level, parentIndex } = item
    const x = cardX(level)
    const y = cardY(index)
    const cy = y + CARD / 2
    const px = parentIndex < 0 ? 30 : cardX(order[parentIndex]?.level ?? 0) + 14
    const py = parentIndex < 0 ? 62 : cardY(parentIndex) + CARD
    const tint = COLOR[family(row.model)]
    const shown = shownAs(row, rows, now)
    const off = shown === 'done' || shown === 'failed'
    const path = `M${px},${py} V${cy} H${x}`
    lines.push(`<path d="${path}" fill="none" stroke="${WALL}" stroke-width="1.5"/>`)
    if (shown === 'running' || shown === 'new') {
      lines.push(
        `<circle r="3.5" fill="${tint}"><animateMotion dur="${(1.4 + (index % 4) * 0.3).toFixed(1)}s" repeatCount="indefinite" path="${path}"/></circle>`,
      )
    }
    const end = row.endedAt ?? now
    const stats = off
      ? `${shown === 'done' ? L.done : L.stopped} · ${L.steps(row.steps)} · ${span(end - row.startedAt)}`
      : shown === 'new'
        ? L.justStarted
        : `${L.steps(row.steps)} · ${span(now - row.startedAt)}`
    const ticks = Math.min(row.steps, 14)
    const stripColor = shown === 'failed' ? BAD : off ? OK : tint
    const strip =
      ticks === 0
        ? ''
        : `<line x1="${W - 24 - ticks * 5}" y1="${y + 54}" x2="${W - 24}" y2="${y + 54}" stroke="${stripColor}" stroke-opacity="0.55" stroke-width="8" stroke-dasharray="3 2"/>` +
          (off
            ? ''
            : `<rect x="${W - 29}" y="${y + 50}" width="3" height="8" fill="${INK}"><animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite"/></rect>`)
    const wide = W - 12 - x - 58
    const doing =
      shown === 'waiting'
        ? L.waitingKids
        : off
          ? (row.answer ?? '').replace(/\s+/g, ' ').trim()
          : row.last
    const sub = clip(
      doing === '' ? modelLabel(row.model) : `${modelLabel(row.model)} · ${doing}`,
      Math.max(8, Math.floor(wide / 6.4)),
    )
    const frame =
      shown === 'new'
        ? `stroke="${tint}" stroke-width="1" stroke-dasharray="5 3"`
        : `stroke="${off ? WALL_OFF : WALL}" stroke-width="0.75"`
    cards.push(
      [
        `<rect x="${x}" y="${y}" width="${W - 12 - x}" height="${CARD}" rx="8" fill="${off ? FLOOR_OFF : FLOOR}" ${frame}/>`,
        `<g transform="translate(${x + 8},${y + 16}) scale(4)" shape-rendering="crispEdges"${off ? ' opacity="0.45"' : ''}><g>${shown === 'running' || shown === 'new' ? HOP : ''}<use href="#s-${family(row.model)}"/></g></g>`,
        text(x + 50, y + 22, clip(row.name, Math.max(6, Math.floor((wide - (off ? 26 : 0)) / 8.4))), {
          size: 14,
          fill: off ? SUB : INK,
          bold: true,
        }),
        text(x + 50, y + 40, sub),
        text(x + 50, y + 58, stats, { size: 11 }),
        shown === 'done' ? check(W - 40, y + 17) : shown === 'failed' ? cross(W - 36, y + 18) : '',
        strip,
      ].join(''),
    )
  })

  const empty =
    order.length === 0
      ? text(W / 2, 112, L.emptyTree, { anchor: 'middle' })
      : ''
  const H = order.length === 0 ? 140 : cardY(order.length) + 2

  return wrap(W, H, lines.join('') + head + cards.join('') + empty, `${L.treeLabel}: ${counts(rows)}`)
}

// ---------- kayıt ----------

export const register: Register = (on, options) => {
  applyOptions(options)
  const title = L.title
  const command = L.command

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: command,
      description: L.commandHelp,
    })
    void $.ui.open({ id: PANE, title })
    $.clock.every(5000, () => {
      void tick($).catch(() => undefined)
    })
    void tick($).catch(() => undefined)

    return next(e)
  })

  on('command.run', { command }, async $ => {
    await $.ui.open({ id: PANE, title })

    return { text: L.opened }
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    try {
      const id = started.agentId
      if (typeof id === 'string') {
        const now = await $.clock.now()
        const row: AgentRow = {
          id,
          name: e.description === '' ? e.subagentType : e.description,
          type: e.subagentType,
          model: [started.model, e.model, e.parentModel].find(m => typeof m === 'string' && m !== '') ?? '',
          status: 'running',
          steps: 0,
          last: '',
          recent: [],
          startedAt: now,
          at: now,
        }
        const parentModel: unknown = e.parentModel
        const task: unknown = e.prompt
        if (typeof task === 'string' && task.trim() !== '') row.task = clip(task.trim(), TASK_MAX)
        if (typeof e.parentAgentId === 'string') row.parentId = e.parentAgentId
        await addAgent($, row)
        if (row.parentId === undefined && typeof parentModel === 'string' && parentModel !== '') {
          await update($, mainAtom, () => parentModel)
        }
        void $.ui.open({ id: PANE, title })
      }
    } catch {
      // panel yüzünden ajanın başlaması asla bozulmamalı
    }

    return started
    }).catch(($, e, next) => next(e))

  on('tool.call', ($, e, next) => {
    if (e.agentId !== undefined) void noteStep($, e.agentId, describe(e)).catch(() => undefined)
    else void setBusy($, true).catch(() => undefined)

    return next(e)
    }).catch(($, e, next) => next(e))

  on('prompt.submit', ($, e, next) => {
    void setBusy($, true).catch(() => undefined)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      try {
        await setBusy($, false)
      } catch {
        // durum yazılamadıysa tur yine de biter
      }
    } else {
      try {
        await endAgent($, e.agentId, e.reason === 'answer', e.answer)
      } catch {
        // kayıt tutulamadıysa tur yine de biter
      }
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const rows = await read($, agentsAtom)
    const ui = await read($, uiAtom)
    const main = await read($, mainAtom)
    const clock = await read($, nowAtom)
    const isBusy = await read($, busyAtom)
    const idleSince = await read($, idleAtom)
    const now = rows.reduce((most, r) => Math.max(most, r.at), clock)

    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)

      return (
        <Box flexDirection="column">
          <Text bold>
            {clip(OWNER, 24)} · {counts(rows)}
          </Text>
          {rows.map(row => (
            <Text dimColor={isEnded(row)}>
              {modelLabel(row.model)} · {clip(row.name, 24)} ·{' '}
              {statusLine(row, shownAs(row, rows, now), now, 40)}
            </Text>
          ))}
        </Box>
      )
    }

    const { Box, Text, Button, Svg, Markdown } = $.ui.resolve(e)
    const isTree = ui.view === 'tree'
    const source = isTree ? tree(rows, main, now) : office(rows, main, now, isBusy, idleSince)
    const alt = `${isTree ? L.treeLabel : L.officeLabel}: ${counts(rows)}`

    if (e.props.placement === 'widget') return <Svg source={source} alt={alt} />

    const open = rows.filter(r => !isEnded(r))
    const ended = rows.filter(isEnded).reverse()
    const isEndedOpen = ui.showEnded === true
    const pick = (id: string) =>
      update($, uiAtom, s => ({ ...s, selected: s.selected === id ? '' : id }))
    const chosen = rows.find(r => r.id === ui.selected)

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" gap={1} alignItems="center">
          <Button
            key="view-office"
            variant={isTree ? 'secondary' : 'primary'}
            onPress={() => update($, uiAtom, s => ({ ...s, view: 'office' as const }))}
          >
            {L.office}
          </Button>
          <Button
            key="view-tree"
            variant={isTree ? 'primary' : 'secondary'}
            onPress={() => update($, uiAtom, s => ({ ...s, view: 'tree' as const }))}
          >
            {L.tree}
          </Button>
          {ended.length > 0 && (
            <Button
              key="ended-toggle"
              variant={isEndedOpen ? 'primary' : 'secondary'}
              onPress={() => update($, uiAtom, s => ({ ...s, showEnded: s.showEnded !== true }))}
            >
              {L.endedButton(clip(OWNER, 24), ended.length)}
            </Button>
          )}
        </Box>
        <Svg source={source} alt={alt} />
        {open.length > 0 && (
          <Box flexDirection="column" gap={1}>
            <Text dimColor>{L.pickAgent}</Text>
            <Box flexDirection="row" flexWrap="wrap" gap={1}>
              {open.map(row => (
                <Button
                  key={`agent-${row.id}`}
                  label={clip(row.name, 28)}
                  variant={row.id === ui.selected ? 'primary' : 'secondary'}
                  onPress={() => pick(row.id)}
                />
              ))}
            </Box>
          </Box>
        )}
        {isEndedOpen && ended.length > 0 && (
          <Box flexDirection="column" gap={1}>
            <Text bold>{L.endedList}</Text>
            {ended.slice(0, MAX_ENDED_LISTED).map(row => (
              <Box flexDirection="row" gap={1} alignItems="center">
                <Button
                  key={`agent-${row.id}`}
                  label={clip(row.name, 24)}
                  variant={row.id === ui.selected ? 'primary' : 'secondary'}
                  onPress={() => pick(row.id)}
                />
                <Text dimColor>
                  {modelLabel(row.model)} · {row.status === 'failed' ? `${L.stoppedLower} · ` : ''}
                  {L.steps(row.steps)} · {stopwatch((row.endedAt ?? now) - row.startedAt)}
                </Text>
              </Box>
            ))}
            {ended.length > MAX_ENDED_LISTED && (
              <Text dimColor>{L.more(ended.length - MAX_ENDED_LISTED)}</Text>
            )}
          </Box>
        )}
        {chosen !== undefined && (
          <Box flexDirection="column" gap={1} borderStyle="round" paddingX={1}>
            <Text bold>{chosen.name}</Text>
            <Text dimColor>
              {modelLabel(chosen.model)}
              {chosen.type === '' ? '' : ` · ${chosen.type}`} · {L.steps(chosen.steps)} ·{' '}
              {span((chosen.endedAt ?? now) - chosen.startedAt)} ·{' '}
              {chosen.status === 'done'
                ? L.doneLower
                : chosen.status === 'failed'
                  ? L.stoppedLower
                  : chosen.status === 'waiting'
                    ? L.waitingLower
                    : L.runningLower}
            </Text>
            {chosen.task !== undefined && <Text bold>{L.task}</Text>}
            {chosen.task !== undefined && <Text>{chosen.task}</Text>}
            {chosen.recent.length > 0 && <Text bold>{L.recent}</Text>}
            {chosen.recent.map(step => (
              <Text mono wrap="truncate-end">
                {step}
              </Text>
            ))}
            {chosen.answer !== undefined && chosen.answer !== '' && <Text bold>{L.answer}</Text>}
            {chosen.answer !== undefined && chosen.answer !== '' && (
              <Markdown text={chosen.answer} />
            )}
            <Button
              key="detail-close"
              onPress={() => update($, uiAtom, s => ({ ...s, selected: '' }))}
            >
              {L.close}
            </Button>
          </Box>
        )}
      </Box>
    )
  })
}
