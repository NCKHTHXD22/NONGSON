import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { api } from '@/lib/api'

function timeAgo(date) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000
  if (diff < 60) return 'vừa xong'
  if (diff < 3600) return `${Math.floor(diff / 60)} phút`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ`
  return `${Math.floor(diff / 86400)} ngày`
}

export default function NotificationBell() {
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifPos, setNotifPos] = useState(null)
  const notifRef = useRef(null)

  const { data: notifData } = useQuery({
    queryKey: ['notif-pending'],
    queryFn: () => api.get('/api/feedbacks', { params: { status: 'pending' } }).then(r => r.data),
    refetchInterval: 60000,
  })
  
  const pendingList = notifData?.feedbacks ?? []
  const pendingCount = notifData?.pagination?.total ?? 0

  useEffect(() => {
    if (!notifOpen) return
    const onClick = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [notifOpen])

  return (
    <div className="relative" ref={notifRef}>
      <button
        onClick={() => {
          if (!notifOpen && notifRef.current) {
            const r = notifRef.current.getBoundingClientRect()
            setNotifPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) })
          }
          setNotifOpen(v => !v)
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 border border-white/20 hover:bg-white/25 transition-all"
      >
        <Bell className="h-4 w-4 text-white" />
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-yellow-400 px-1 text-[10px] font-bold text-blue-900 ring-1 ring-blue-700">
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}
      </button>

      {notifOpen && (
        <div
          className="fixed z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-xl text-slate-700"
          style={{ top: notifPos?.top ?? 60, right: notifPos?.right ?? 24 }}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-semibold">Thông báo</p>
            <span className="text-xs text-slate-400">{pendingCount} chờ xử lý</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {pendingList.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">Không có góp ý mới</p>
            ) : (
              pendingList.slice(0, 8).map(fb => (
                <Link
                  key={fb._id}
                  to={`/feedbacks/${fb._id}`}
                  onClick={() => setNotifOpen(false)}
                  className="flex flex-col gap-0.5 border-b border-slate-50 px-4 py-2.5 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold truncate">{fb.displayName || 'Người dân'}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">{timeAgo(fb.createdAt)}</span>
                  </div>
                  <span className="text-xs text-slate-500 line-clamp-2">
                    {fb.categoryId?.icon ? fb.categoryId.icon + ' ' : ''}{fb.content || '(không có nội dung)'}
                  </span>
                </Link>
              ))
            )}
          </div>
          {pendingCount > 0 && (
            <Link
              to="/feedbacks?status=pending"
              onClick={() => setNotifOpen(false)}
              className="block border-t border-slate-100 px-4 py-2.5 text-center text-xs font-semibold text-blue-600 hover:bg-blue-50"
            >
              Xem tất cả
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

