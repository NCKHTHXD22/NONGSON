import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, Inbox } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'

const TYPE_ICON = {
  assigned: '📋',
  draft_submitted: '📄',
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/api/notifications').then((r) => r.data),
    refetchInterval: 20_000,
  })

  const notifications = data?.notifications ?? []
  const unreadCount = data?.unreadCount ?? 0

  const readMutation = useMutation({
    mutationFn: (id) => api.post(`/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const readAllMutation = useMutation({
    mutationFn: () => api.post('/api/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const handleClick = (n) => {
    if (!n.isRead) readMutation.mutate(n._id)
    setOpen(false)
    if (n.feedbackId?._id) navigate(`/feedbacks/${n.feedbackId._id}`)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 border border-white/20 hover:bg-white/25 transition-all"
      >
        <Bell className="h-4 w-4 text-white" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-400 ring-1 ring-blue-700" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-2xl bg-white border border-slate-100 shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-bold text-slate-700">Thông báo</span>
            {unreadCount > 0 && (
              <button
                onClick={() => readAllMutation.mutate()}
                className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
              >
                <CheckCheck className="h-3 w-3" /> Đánh dấu đã đọc
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Inbox className="h-8 w-8 text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">Chưa có thông báo nào</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {notifications.map((n) => (
                <button
                  key={n._id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 transition-colors hover:bg-blue-50/60 ${!n.isRead ? 'bg-blue-50/40' : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-base shrink-0">{TYPE_ICON[n.type] ?? '🔔'}</span>
                    <div className="min-w-0">
                      <p className={`text-sm leading-snug ${!n.isRead ? 'font-semibold text-slate-700' : 'text-slate-500'}`}>
                        {n.message}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(n.createdAt)}</p>
                    </div>
                    {!n.isRead && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
