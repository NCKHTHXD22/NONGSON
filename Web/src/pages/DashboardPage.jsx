import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import {
  Inbox, Clock, Cog, CheckCircle2, ArrowRight, Loader2, TrendingUp, MessageSquarePlus,
} from 'lucide-react'
import { api } from '@/lib/api'
import StatusBadge from '@/components/feedback/StatusBadge'
import { formatDateShort } from '@/lib/utils'

function StatCard({ label, value, icon: Icon, colorClass, bgClass, iconBg }) {
  return (
    <div className={`card-hover relative overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-sm p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{label}</p>
          <p className={`text-3xl font-bold ${colorClass}`}>{value ?? '—'}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${colorClass}`} />
        </div>
      </div>
      {/* Subtle corner accent */}
      <div className={`absolute -bottom-3 -right-3 h-14 w-14 rounded-full opacity-10 ${bgClass}`} />
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

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('/api/stats').then((r) => r.data),
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm text-slate-400">Đang tải dữ liệu...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
        <p className="text-red-600 font-medium">Lỗi tải dữ liệu: {error.message}</p>
      </div>
    )
  }

  const chartData = (data.chartDays || []).map((day, i) => ({
    name: day,
    count: data.chartCounts?.[i] ?? 0,
  }))

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Hero banner card */}
      <div
        className="relative overflow-hidden rounded-2xl text-white p-6 shadow-lg"
        style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #0ea5e9 100%)' }}
      >
        <div className="pointer-events-none absolute -top-8 -right-8 h-40 w-40 rounded-full bg-white/8" />
        <div className="pointer-events-none absolute -bottom-10 right-24 h-32 w-32 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute top-4 right-1/3 h-16 w-16 rounded-full bg-cyan-300/10" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-blue-200 text-sm font-medium mb-1">Tổng góp ý & phản ánh</p>
            <p className="text-5xl font-extrabold tracking-tight">{data.stats?.total ?? 0}</p>
            <p className="text-blue-200/70 text-xs mt-1">Từ người dân UBND Nong Son</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 border border-white/20 px-3 py-1.5 text-sm">
              <Clock className="h-3.5 w-3.5 text-yellow-300" />
              Chờ xử lý: <b>{data.stats?.pending ?? 0}</b>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 border border-white/20 px-3 py-1.5 text-sm">
              <Cog className="h-3.5 w-3.5 text-cyan-300" />
              Đang xử lý: <b>{data.stats?.processing ?? 0}</b>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 border border-white/20 px-3 py-1.5 text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-300" />
              Hoàn thành: <b>{data.stats?.done ?? 0}</b>
            </span>
          </div>
        </div>
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Tổng cộng"
          value={data.stats?.total}
          icon={Inbox}
          colorClass="text-blue-600"
          bgClass="bg-blue-500"
          iconBg="bg-blue-50"
        />
        <StatCard
          label="Chờ xử lý"
          value={data.stats?.pending}
          icon={Clock}
          colorClass="text-amber-600"
          bgClass="bg-amber-500"
          iconBg="bg-amber-50"
        />
        <StatCard
          label="Đang xử lý"
          value={data.stats?.processing}
          icon={Cog}
          colorClass="text-sky-600"
          bgClass="bg-sky-500"
          iconBg="bg-sky-50"
        />
        <StatCard
          label="Đã xử lý"
          value={data.stats?.done}
          icon={CheckCircle2}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-500"
          iconBg="bg-emerald-50"
        />
      </div>

      {/* Chart + Recent */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Bar chart */}
        <div className="lg:col-span-3 card-hover rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Góp ý 7 ngày qua</h3>
              <p className="text-xs text-slate-400 mt-0.5">Thống kê số lượng theo ngày</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
              <TrendingUp className="h-4.5 w-4.5 text-blue-600" />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={1} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#eff6ff', radius: 6 }} />
              <Bar dataKey="count" fill="url(#barGrad)" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent feedbacks */}
        <div className="lg:col-span-2 card-hover rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                <MessageSquarePlus className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">Góp ý mới nhất</h3>
            </div>
            <Link
              to="/feedbacks"
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-semibold transition-colors"
            >
              Xem tất cả <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {!data.recent?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Inbox className="h-8 w-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">Chưa có góp ý nào</p>
              </div>
            ) : (
              data.recent.map((fb) => {
                const name = fb.displayName || fb.contact || '?'
                const initial = name[0].toUpperCase()
                return (
                  <Link
                    key={fb._id}
                    to={`/feedbacks/${fb._id}`}
                    className="flex items-start gap-3 px-5 py-3.5 hover:bg-blue-50/60 transition-colors group"
                  >
                    {fb.avatar ? (
                      <img
                        src={fb.avatar}
                        alt={name}
                        className="h-8 w-8 shrink-0 rounded-full object-cover shadow-sm"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                      />
                    ) : null}
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-white text-xs font-bold shadow-sm shadow-blue-200"
                      style={{ display: fb.avatar ? 'none' : 'flex' }}
                    >
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-slate-700 group-hover:text-blue-600 transition-colors">
                        {fb.displayName || '(Ẩn danh)'}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">{fb.contact}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{fb.content}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={fb.status} />
                      <p className="text-[11px] text-slate-300">{formatDateShort(fb.createdAt)}</p>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
