// Shared Tailwind class constants & inline style objects used across admin pages.
// Import only what you need: import { page, card, gradient } from '@/styles/pageStyles'

// ── Page layout ───────────────────────────────────────────────────────────────
export const page = {
  wrapper:      'space-y-4 animate-fade-in',
  wrapperLg:    'space-y-5 animate-fade-in',
  wrapperXl:    'space-y-6',
  narrow:       'space-y-4 animate-fade-in max-w-lg',
  narrowMd:     'space-y-4 animate-fade-in max-w-2xl',
  header:       'flex items-center justify-between',
  title:        'text-2xl font-extrabold text-slate-800',
  titleMd:      'text-2xl font-bold',
  titleSm:      'text-xl font-bold',
  subtitle:     'text-sm text-slate-400 mt-0.5',
  subtitleAlt:  'text-sm text-slate-500 mt-1',
}

// ── Card (custom divs — not shadcn Card component) ────────────────────────────
export const card = {
  base:        'rounded-2xl bg-white border border-slate-100 shadow-sm',
  padded:      'rounded-2xl bg-white border border-slate-100 shadow-sm p-5',
  paddedSm:    'rounded-2xl bg-white border border-slate-100 shadow-sm p-4',
  hoverable:   'card-hover rounded-2xl bg-white border border-slate-100 shadow-sm p-5',
  overflow:    'rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden',
}

// ── Inline gradient / shadow style objects ────────────────────────────────────
export const gradient = {
  heroBanner:         { background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #0ea5e9 100%)' },
  tableHeader:        { background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)' },
  loginSidebar:       { background: 'linear-gradient(145deg, #0d1b2a 0%, #1a3a5c 50%, #0d2d4a 100%)' },
  btnBlue:            { background: 'linear-gradient(135deg, #2563eb, #0ea5e9)', boxShadow: '0 4px 14px rgba(37,99,235,0.35)' },
  btnBluePending:     { background: '#93c5fd', boxShadow: 'none' },
  btnEmerald:         { background: 'linear-gradient(135deg, #059669, #10b981)', boxShadow: '0 4px 14px rgba(5,150,105,0.35)' },
  btnEmeraldPending:  { background: '#6ee7b7', boxShadow: 'none' },
}

// ── Form / Input fields ───────────────────────────────────────────────────────
export const field = {
  label:        'text-xs font-semibold text-slate-600 uppercase tracking-wide',
  input:        'w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition-all',
  inputIcon:    'w-full h-11 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition-all',
  inputIconBoth:'w-full h-11 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-11 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition-all',
  search:       'h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-all',
  select:       'h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-all cursor-pointer',
  selectFull:   'w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
  iconLeft:     'absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none',
  iconRight:    'absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors',
}

// ── Buttons (non-shadcn) ──────────────────────────────────────────────────────
export const btn = {
  // Base for gradient full-width submit buttons; combine with gradient.btnBlue style
  primaryBase:  'w-full h-11 rounded-xl font-semibold text-sm text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2',
  view:         'inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 hover:border-blue-200 transition-all',
  clearFilter:  'h-9 px-3 rounded-xl text-sm text-slate-500 hover:text-red-500 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all font-medium',
  pageNav:      'flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:border-blue-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all',
  backLink:     'flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-4',
  syncBadge:    'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50',
}

// ── Table ─────────────────────────────────────────────────────────────────────
export const tbl = {
  headCell:     'text-left px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-white/80',
  headCellGray: 'text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground',
  cell:         'px-4 py-3.5',
  row:          'hover:bg-blue-50/40 transition-colors group',
  rowGray:      'hover:bg-gray-50',
  body:         'divide-y divide-slate-50',
}

// ── Avatar ────────────────────────────────────────────────────────────────────
export const avatar = {
  circle:     'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-white text-xs font-bold shadow-sm shadow-blue-200',
  circleAlt:  'h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-xs font-bold shrink-0',
  img:        'h-8 w-8 shrink-0 rounded-full object-cover shadow-sm',
}

// ── Loading state ─────────────────────────────────────────────────────────────
export const loading = {
  page:           'flex flex-col items-center justify-center h-64 gap-3',
  inline:         'flex items-center justify-center h-40',
  spinner:        'h-8 w-8 animate-spin text-blue-500',
  spinnerPrimary: 'h-8 w-8 animate-spin text-primary',
  spinnerMd:      'h-6 w-6 animate-spin text-primary',
  text:           'text-sm text-slate-400',
}

// ── Empty state ───────────────────────────────────────────────────────────────
export const empty = {
  container:   'flex flex-col items-center justify-center py-20 text-center',
  containerSm: 'flex flex-col items-center justify-center py-12 text-center',
  icon:        'h-10 w-10 text-slate-200 mb-3',
  iconSm:      'h-8 w-8 text-slate-200 mb-2',
  title:       'font-semibold text-slate-500',
  subtitle:    'text-sm text-slate-400 mt-1',
}

// ── Badge (role / status inline badges) ──────────────────────────────────────
export const bdg = {
  base:   'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
  amber:  'text-amber-700 bg-amber-50',
  purple: 'text-purple-700 bg-purple-50',
  blue:   'text-blue-700 bg-blue-50',
  slate:  'text-slate-600 bg-slate-50',
  sky:    'text-xs bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full',
}

// ── Pagination ────────────────────────────────────────────────────────────────
export const pager = {
  container: 'flex items-center justify-between px-5 py-3 border-t border-slate-50 bg-slate-50/50',
  info:      'text-xs text-slate-400',
  navGroup:  'flex gap-1.5',
}

// ── Content display boxes (feedback text areas) ───────────────────────────────
export const contentBox = {
  gray:   'bg-gray-50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap',
  sky:    'bg-sky-50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap',
  green:  'bg-green-50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap',
  yellow: 'bg-yellow-50 rounded-lg p-3 text-sm whitespace-pre-wrap',
}

// ── Alert / Banner ────────────────────────────────────────────────────────────
export const alertBox = {
  amber:     'flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3',
  amberNote: 'rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700',
  blue:      'flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2',
  red:       'bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700',
  green:     'flex items-center justify-between gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700',
}

// ── Tab bar ───────────────────────────────────────────────────────────────────
export const tabs = {
  container:   'flex gap-1 rounded-2xl bg-slate-100 p-1',
  containerSm: 'flex gap-1 rounded-xl bg-slate-100 p-1',
  tab:         'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
  tabSm:       'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
  active:      'bg-white text-blue-600 shadow-sm',
  inactive:    'text-slate-500 hover:text-slate-700',
}

// ── File drop zone ────────────────────────────────────────────────────────────
export const dropzone = {
  base: 'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all',
}
