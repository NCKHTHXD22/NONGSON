import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Loader2, Users, ChevronDown, ChevronRight, RefreshCw, Search, X } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'

function Avatar({ name, avatar, size = 8 }) {
  const initial = (name || '?')[0].toUpperCase()
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className={`h-${size} w-${size} rounded-full object-cover shrink-0`}
        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
      />
    )
  }
  return (
    <div className={`h-${size} w-${size} rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {initial}
    </div>
  )
}

function CategoryMemberPanel({ cat, followers, onDelete }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['zalo-members', cat._id],
    queryFn: () => api.get(`/api/zalo-members/${cat._id}`).then((r) => r.data),
    enabled: open,
  })

  const addMutation = useMutation({
    mutationFn: (follower) =>
      api.post(`/api/zalo-members/manual/${cat._id}`, {
        displayName: follower.display_name || follower.user_id,
        zaloUserId: follower.user_id,
      }).then((r) => r.data),
    onSuccess: (_, follower) => {
      toast.success(`Đã thêm ${follower.display_name || follower.user_id}`)
      queryClient.invalidateQueries({ queryKey: ['zalo-members', cat._id] })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi thêm'),
  })

  const deleteMutation = useMutation({
    mutationFn: (memberId) => api.delete(`/api/zalo-members/member/${memberId}`).then((r) => r.data),
    onSuccess: () => {
      toast.success('Đã xóa thành viên')
      queryClient.invalidateQueries({ queryKey: ['zalo-members', cat._id] })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi xóa'),
  })

  const syncMutation = useMutation({
    mutationFn: () => api.post(`/api/zalo-members/sync/${cat._id}`).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(`Đồng bộ xong — ${data.synced} thành viên`)
      queryClient.invalidateQueries({ queryKey: ['zalo-members', cat._id] })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi đồng bộ'),
  })

  const members = data?.members ?? []
  const memberIds = useMemo(() => new Set(members.map((m) => m.zaloUserId)), [members])

  const filteredFollowers = useMemo(() => {
    const q = search.toLowerCase()
    return followers.filter((f) => {
      if (memberIds.has(f.user_id)) return false
      if (!q) return true
      return (
        f.display_name?.toLowerCase().includes(q) ||
        f.user_id?.includes(q)
      )
    })
  }, [followers, memberIds, search])

  return (
    <Card>
      <CardHeader className="pb-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between py-1 text-left"
        >
          <CardTitle className="text-base flex items-center gap-2">
            {cat.icon} {cat.name}
            <span className="text-xs font-normal text-slate-400 ml-1">
              · <code className="bg-slate-100 px-1 rounded text-[11px]">{cat.zaloGroupId}</code>
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {members.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                {members.length} thành viên
              </span>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); syncMutation.mutate() }}
              disabled={syncMutation.isPending}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
            >
              {syncMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Đồng bộ
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (window.confirm(`Xóa nhóm "${cat.name}"? Toàn bộ ${members.length} thành viên cũng sẽ bị xóa.`)) {
                  onDelete(cat._id)
                }
              }}
              className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Xóa nhóm"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          </div>
        </button>
      </CardHeader>

      {open && (
        <CardContent className="pt-4 space-y-3">

          {/* Nút mở picker */}
          {!showPicker && (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-2 rounded-lg border border-blue-100 bg-blue-50 hover:bg-blue-100 transition-colors w-full"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm thành viên vào nhóm này
            </button>
          )}

          {/* Follower picker */}
          {showPicker && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-blue-700">Chọn từ danh sách follower</p>
                <button
                  type="button"
                  onClick={() => { setShowPicker(false); setSearch('') }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm theo tên hoặc ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                />
              </div>

              {/* Follower list */}
              <div className="max-h-52 overflow-y-auto rounded-md border border-slate-200 bg-white divide-y divide-slate-50">
                {followers.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-400">
                    Chưa có follower — đồng bộ follower ở trang Gửi tin nhắn trước
                  </p>
                ) : filteredFollowers.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-400">
                    {search ? 'Không tìm thấy follower phù hợp' : 'Tất cả follower đã được thêm vào nhóm này'}
                  </p>
                ) : (
                  filteredFollowers.map((f) => {
                    const hasName = f.display_name && f.display_name !== f.user_id
                    return (
                      <button
                        key={f.user_id}
                        type="button"
                        onClick={() => addMutation.mutate(f)}
                        disabled={addMutation.isPending}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
                      >
                        <Avatar name={f.display_name} avatar={f.avatar} size={8} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium truncate ${hasName ? 'text-slate-700' : 'text-slate-400 italic'}`}>
                            {hasName ? f.display_name : '(Chưa có tên)'}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">{f.user_id}</p>
                        </div>
                        <Plus className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      </button>
                    )
                  })
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {filteredFollowers.length} follower chưa trong nhóm · {members.length} đã trong nhóm
              </p>
            </div>
          )}

          {/* Danh sách thành viên đã thêm */}
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-5 text-sm text-slate-400">
              <Users className="h-8 w-8 mx-auto mb-2 text-slate-200" />
              Chưa có thành viên nào
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 overflow-hidden">
              {members.map((m) => {
                const follower = followers.find((f) => f.user_id === m.zaloUserId)
                return (
                  <div key={m._id} className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={m.displayName} avatar={follower?.avatar || m.avatar} size={8} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{m.displayName || '(Không tên)'}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{m.zaloUserId}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm(`Xóa ${m.displayName || m.zaloUserId} khỏi nhóm?`)) {
                          deleteMutation.mutate(m._id)
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors ml-2 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

const ICONS = ['🏗️', '🏫', '📋', '🚔', '🌿', '💧', '🏥', '🏛️', '🔧', '📢']

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState({ name: '', icon: '📋', zaloGroupId: '' })

  const { data: catsData, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/categories').then((r) => r.data),
  })

  const { data: followersData } = useQuery({
    queryKey: ['broadcast-followers'],
    queryFn: () => api.get('/api/broadcast/followers').then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/api/categories', data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Đã tạo nhóm mới')
      setShowAddForm(false)
      setForm({ name: '', icon: '📋', zaloGroupId: '' })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi tạo nhóm'),
  })

  const deleteCatMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/categories/${id}`).then((r) => r.data),
    onSuccess: () => {
      toast.success('Đã xóa nhóm')
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi xóa nhóm'),
  })

  const categories = catsData?.categories ?? []
  const followers = followersData?.followers ?? []

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.zaloGroupId.trim()) return
    createMutation.mutate({ ...form, order: categories.length + 1 })
  }

  return (
    <div className="space-y-4 animate-fade-in max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cài đặt nhóm Zalo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quản lý danh sách cán bộ trong từng nhóm để phân công xử lý phản ánh
          </p>
        </div>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors shrink-0"
          >
            <Plus className="h-4 w-4" /> Thêm nhóm
          </button>
        )}
      </div>

      {/* Form thêm nhóm mới */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-700">Thêm nhóm Zalo mới</p>

          <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
            <div className="space-y-1">
              <label className="text-xs text-slate-500 font-medium">Icon</label>
              <div className="flex flex-wrap gap-1 max-w-[160px]">
                {ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, icon: ic }))}
                    className={`h-8 w-8 rounded-md text-base transition-colors ${form.icon === ic ? 'bg-blue-200 ring-2 ring-blue-400' : 'bg-white hover:bg-blue-100'}`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-xs text-slate-500 font-medium">Tên nhóm</label>
                <input
                  type="text"
                  placeholder="VD: Môi trường, Hạ tầng..."
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500 font-medium">Zalo Group ID</label>
                <input
                  type="text"
                  placeholder="VD: 6f2ab62e124cfb12a25d"
                  value={form.zaloGroupId}
                  onChange={(e) => setForm((f) => ({ ...f, zaloGroupId: e.target.value }))}
                  required
                  className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setForm({ name: '', icon: '📋', zaloGroupId: '' }) }}
              className="px-3 py-1.5 rounded-md text-sm text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Tạo nhóm
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-400">
          <Users className="h-10 w-10 mx-auto mb-3 text-slate-200" />
          Chưa có nhóm nào — nhấn "Thêm nhóm" để tạo
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => (
            <CategoryMemberPanel
              key={cat._id}
              cat={cat}
              followers={followers}
              onDelete={(id) => deleteCatMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
