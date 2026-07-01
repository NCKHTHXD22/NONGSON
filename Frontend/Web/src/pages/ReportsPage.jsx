import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Inbox, Clock, Cog, CheckCircle2, AlertTriangle, Download, Loader2, FileBarChart2, ArrowUp, ArrowDown, Minus, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const PERIODS = [
  { value: 'day',     label: 'Ngày' },
  { value: 'week',    label: 'Tuần' },
  { value: 'month',   label: 'Tháng' },
  { value: 'quarter', label: 'Quý' },
  { value: 'year',    label: 'Năm' },
]

function isoWeekString(d) {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const week1 = new Date(date.getFullYear(), 0, 4)
  const weekNo = 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${date.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function defaultValue(period) {
  const now = new Date()
  if (period === 'day')   return now.toISOString().slice(0, 10)
  if (period === 'week')  return isoWeekString(now)
  if (period === 'month') return now.toISOString().slice(0, 7)
  if (period === 'quarter') return `${now.getFullYear()}-${Math.floor(now.getMonth() / 3) + 1}`
  if (period === 'year')  return String(now.getFullYear())
  return ''
}

function ChangeBadge({ current, previous, goodDirection = 'up' }) {
  if (!previous) {
    return <span className="text-[11px] text-slate-300 inline-flex items-center gap-0.5"><Minus className="h-3 w-3" /> chưa có dữ liệu kỳ trước</span>
  }
  const diff = current - previous
  const pct = Math.round((diff / previous) * 100)
  const isUp = diff > 0
  const isGood = diff === 0 ? null : goodDirection === 'up' ? isUp : !isUp
  const colorClass = diff === 0 ? 'text-slate-400' : isGood ? 'text-blue-600' : 'text-red-500'
  const Icon = diff === 0 ? Minus : isUp ? ArrowUp : ArrowDown
  return (
    <span className={cn('text-[11px] font-semibold inline-flex items-center gap-0.5', colorClass)}>
      <Icon className="h-3 w-3" />
      {diff === 0 ? 'Không đổi' : `${Math.abs(pct)}%`} so với kỳ trước
    </span>
  )
}

function StatCard({ label, value, icon: Icon, colorClass, iconBg, changeNode }) {
  return (
    <div className="card-hover relative overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{label}</p>
          <p className={`text-3xl font-bold ${colorClass}`}>{value ?? '—'}</p>
          {changeNode && <div className="mt-1.5">{changeNode}</div>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${colorClass}`} />
        </div>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-xl bg-white shadow-lg border border-slate-100 px-4 py-3 text-sm">
        <p className="font-semibold text-slate-700">{label}</p>
        <p className="text-blue-600 font-bold mt-0.5">{payload[0].value} góp ý</p>
      </div>
    )
  }
  return null
}

export default function ReportsPage() {
  const [period, setPeriod] = useState('month')
  const [value, setValue] = useState(() => defaultValue('month'))
  const [exporting, setExporting] = useState(false)

  const changePeriod = (p) => {
    setPeriod(p)
    setValue(defaultValue(p))
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', period, value],
    queryFn: () => api.get('/api/reports/summary', { params: { period, value } }).then((r) => r.data),
  })

  const timelineData = useMemo(
    () => (data?.timeline || []).map((t) => ({ name: t.label, count: t.count })),
    [data]
  )
  const trendData = useMemo(
    () => (data?.trend || []).map((t) => ({ name: t.label, count: t.count })),
    [data]
  )
  const maxCategoryCount = useMemo(
    () => Math.max(1, ...(data?.byCategory || []).map((c) => c.count)),
    [data]
  )
  const maxOfficerCount = useMemo(
    () => Math.max(1, ...(data?.byOfficer || []).map((o) => o.total)),
    [data]
  )

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await api.get('/api/reports/export', { params: { period, value }, responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `BaoCao_GopY_${period}_${value}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Đã xuất file Excel thành công')
    } catch (err) {
      toast.error('Xuất file thất bại: ' + (err.response?.data?.error || err.message))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
            <FileBarChart2 className="h-4.5 w-4.5 text-blue-600" />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-lg">Thống kê - Báo cáo</h1>
            <p className="text-xs text-slate-400">{data?.range?.label || ''}</p>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting || isLoading}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 shadow-sm transition-colors"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Xuất Excel
        </button>
      </div>

      {/* Period selector */}
      <div className="card-hover rounded-2xl bg-white border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1 bg-slate-50 rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => changePeriod(p.value)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                period === p.value ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="sm:ml-auto">
          {period === 'day' && (
            <input type="date" value={value} onChange={(e) => setValue(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
          )}
          {period === 'week' && (
            <input type="week" value={value} onChange={(e) => setValue(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
          )}
          {period === 'month' && (
            <input type="month" value={value} onChange={(e) => setValue(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
          )}
          {period === 'quarter' && (
            <div className="flex gap-2">
              <select
                value={value.split('-')[1]}
                onChange={(e) => setValue(`${value.split('-')[0]}-${e.target.value}`)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              >
                {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Quý {q}</option>)}
              </select>
              <input
                type="number" value={value.split('-')[0]}
                onChange={(e) => setValue(`${e.target.value}-${value.split('-')[1]}`)}
                className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              />
            </div>
          )}
          {period === 'year' && (
            <input type="number" value={value} onChange={(e) => setValue(e.target.value)}
              className="w-28 rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-slate-400">Đang tải báo cáo...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
          <p className="text-red-600 font-medium">Lỗi tải dữ liệu: {error.message}</p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              label="Tổng cộng" value={data.totals.total} icon={Inbox}
              colorClass="text-slate-700" iconBg="bg-slate-100"
              changeNode={<ChangeBadge current={data.totals.total} previous={data.previous.total} goodDirection="up" />}
            />
            <StatCard
              label="Chờ xử lý" value={data.totals.pending} icon={Clock}
              colorClass="text-amber-600" iconBg="bg-amber-50"
              changeNode={<ChangeBadge current={data.totals.pending} previous={data.previous.pending} goodDirection="down" />}
            />
            <StatCard
              label="Đang xử lý" value={data.totals.processing} icon={Cog}
              colorClass="text-sky-600" iconBg="bg-sky-50"
              changeNode={<ChangeBadge current={data.totals.processing} previous={data.previous.processing} goodDirection="down" />}
            />
            <StatCard
              label="Đã xử lý" value={data.totals.resolved} icon={CheckCircle2}
              colorClass="text-blue-600" iconBg="bg-blue-50"
              changeNode={<ChangeBadge current={data.totals.resolved} previous={data.previous.resolved} goodDirection="up" />}
            />
            <StatCard
              label="Quá hạn" value={data.totals.overdue} icon={AlertTriangle}
              colorClass="text-red-600" iconBg="bg-red-50"
            />
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            {/* Timeline chart */}
            <div className="lg:col-span-3 card-hover rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <h3 className="font-bold text-slate-800 text-base mb-1">Số lượng theo thời gian</h3>
              <p className="text-xs text-slate-400 mb-4">{data.range.label}</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={timelineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1d4ed8" stopOpacity={1} />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#eff6ff', radius: 6 }} />
                  <Bar dataKey="count" fill="url(#barGrad2)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category breakdown */}
            <div className="lg:col-span-2 card-hover rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <h3 className="font-bold text-slate-800 text-base mb-1">Theo danh mục</h3>
              <p className="text-xs text-slate-400 mb-4">Phân loại phản ánh</p>
              {!data.byCategory?.length ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Inbox className="h-8 w-8 text-slate-200 mb-2" />
                  <p className="text-sm text-slate-400">Không có dữ liệu</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.byCategory.map((c) => (
                    <div key={c.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600 font-medium truncate pr-2">{c.name}</span>
                        <span className="text-slate-800 font-bold shrink-0">{c.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
                          style={{ width: `${(c.count / maxCategoryCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            {/* Trend line chart */}
            <div className="lg:col-span-3 card-hover rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-base">Xu hướng {PERIODS.find((p) => p.value === period)?.label.toLowerCase()} gần nhất</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">So sánh {data.trend?.length || 0} kỳ liên tiếp</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="count" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 4, fill: '#1d4ed8' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* By officer */}
            <div className="lg:col-span-2 card-hover rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <h3 className="font-bold text-slate-800 text-base mb-1">Theo cán bộ phụ trách</h3>
              <p className="text-xs text-slate-400 mb-4">Số hồ sơ trong kỳ</p>
              {!data.byOfficer?.length ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Inbox className="h-8 w-8 text-slate-200 mb-2" />
                  <p className="text-sm text-slate-400">Chưa có phân công nào trong kỳ</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {data.byOfficer.map((o) => (
                    <div key={o.officerName}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600 font-medium truncate pr-2">{o.officerName}</span>
                        <span className="text-slate-800 font-bold shrink-0">{o.total}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex">
                        <div className="h-full bg-blue-500" style={{ width: `${(o.resolved / maxOfficerCount) * 100}%` }} />
                        <div className="h-full bg-sky-400" style={{ width: `${(o.processing / maxOfficerCount) * 100}%` }} />
                        <div className="h-full bg-amber-400" style={{ width: `${(o.pending / maxOfficerCount) * 100}%` }} />
                      </div>
                      {o.overdue > 0 && (
                        <p className="text-[11px] text-red-500 font-semibold mt-1 inline-flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {o.overdue} hồ sơ quá hạn
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-50 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> Đã xử lý</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400" /> Đang xử lý</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Chờ xử lý</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
