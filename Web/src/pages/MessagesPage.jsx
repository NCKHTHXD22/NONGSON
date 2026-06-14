import { useState, useRef, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Send, RefreshCw, Loader2, Image, Video, FileText, Users, History,
  X, Plus, Trash2, Search, CheckSquare, Square, ChevronDown, ChevronUp,
  AlertTriangle, ExternalLink, Clock, CalendarClock, Ban, Pencil, Check,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

function TokenExpiredBanner() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-amber-800">Token Zalo OA đã hết hạn</p>
        <p className="text-amber-700 mt-0.5">
          Cần cập nhật token mới để gửi tin và đồng bộ follower.{' '}
          <a
            href="/admin/set-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:text-amber-900"
          >
            Cập nhật tại đây <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </p>
      </div>
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────────
function fmtBytes(b) {
  return b < 1024 * 1024 ? (b / 1024).toFixed(1) + ' KB' : (b / 1024 / 1024).toFixed(1) + ' MB'
}
function fmtTs(iso) {
  try { return new Date(iso).toLocaleString('vi-VN') } catch { return iso }
}
function hasRealName(f) {
  return f.display_name && f.display_name !== f.user_id
}

function FollowerAvatar({ f, size = 8 }) {
  const name = hasRealName(f) ? f.display_name : '?'
  const initial = name[0]?.toUpperCase() ?? '?'
  if (f.avatar) {
    return (
      <img
        src={f.avatar}
        alt={name}
        className={`h-${size} w-${size} rounded-full object-cover shrink-0`}
        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
      />
    )
  }
  return (
    <div className={`h-${size} w-${size} rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {initial}
    </div>
  )
}

// ── Tab bar ────────────────────────────────────────────────────────────────────
function TabBar({ active, onChange }) {
  const tabs = [
    { id: 'send',      label: 'Gửi tin nhắn', icon: Send },
    { id: 'followers', label: 'Followers & Nhóm', icon: Users },
    { id: 'logs',      label: 'Lịch sử gửi', icon: History },
    { id: 'schedule',  label: 'Lên lịch', icon: CalendarClock },
  ]
  return (
    <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
            active === id
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}

// ── Attachment type tabs ───────────────────────────────────────────────────────
function AttachTypeTabs({ active, onChange }) {
  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1 mb-3">
      {[
        { id: 'image', label: 'Hình ảnh', icon: Image },
        { id: 'video', label: 'Video',    icon: Video },
        { id: 'file',  label: 'File',     icon: FileText },
      ].map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
            active === id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <Icon className="h-3.5 w-3.5" /> {label}
        </button>
      ))}
    </div>
  )
}

// ── SendTab ────────────────────────────────────────────────────────────────────
function SendTab({ followers, groups, syncedAt }) {
  const [attachType, setAttachType] = useState('image')
  const [imgPreviews, setImgPreviews] = useState([])   // [{file, url, id?}]
  const [videoInfo, setVideoInfo] = useState(null)     // {file, articleToken?}
  const [fileInfo, setFileInfo] = useState(null)       // {file, attachmentId?, filename}
  const [message, setMessage] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [recipientText, setRecipientText] = useState('')   // user IDs
  const [groupText, setGroupText] = useState('')           // group IDs
  const [followerPickerOpen, setFollowerPickerOpen] = useState(false)
  const [groupPickerOpen, setGroupPickerOpen] = useState(false)
  const [followerSearch, setFollowerSearch] = useState('')
  const [selectedFollowers, setSelectedFollowers] = useState(new Set())
  const [jobId, setJobId] = useState(null)
  const [job, setJob] = useState(null)
  const pollRef = useRef(null)

  const linkMatch = message.match(/https?:\/\/[^\s]+/)?.[0] || ''

  // Upload mutations
  const uploadImageMut = useMutation({
    mutationFn: (formData) => api.post('/api/broadcast/upload/image', formData).then(r => r.data),
  })
  const uploadVideoMut = useMutation({
    mutationFn: (formData) => api.post('/api/broadcast/upload/video', formData).then(r => r.data),
  })
  const uploadFileMut = useMutation({
    mutationFn: (formData) => api.post('/api/broadcast/upload/file', formData).then(r => r.data),
  })
  const sendMut = useMutation({
    mutationFn: (body) => api.post('/api/broadcast/send', body).then(r => r.data),
    onSuccess: (data) => {
      setJobId(data.jobId)
      setJob({ total: data.total, sent: 0, failed: 0, done: false })
    },
    onError: (e) => {
      const code = e.response?.data?.code
      if (code === 'TOKEN_EXPIRED') toast.error('Token Zalo hết hạn — vào Followers tab để xem hướng dẫn')
      else toast.error(e.response?.data?.error || 'Lỗi gửi tin nhắn')
    },
  })

  // Poll job status
  useEffect(() => {
    if (!jobId) return
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/api/broadcast/status/${jobId}`)
        setJob(data)
        if (data.done) {
          clearInterval(pollRef.current)
          toast.success(`Gửi hoàn tất: ${data.sent} thành công${data.failed ? `, ${data.failed} thất bại` : ''}`)
        }
      } catch { clearInterval(pollRef.current) }
    }, 800)
    return () => clearInterval(pollRef.current)
  }, [jobId])

  // Image file change
  async function handleImageFiles(files) {
    const allowed = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 5 - imgPreviews.length)
    if (!allowed.length) return
    const previews = allowed.map(f => ({ file: f, url: URL.createObjectURL(f), id: null }))
    setImgPreviews(prev => [...prev, ...previews])

    const fd = new FormData()
    allowed.forEach(f => fd.append('images', f))
    try {
      const data = await uploadImageMut.mutateAsync(fd)
      setImgPreviews(prev => {
        const next = [...prev]
        let idx = 0
        for (let i = 0; i < next.length; i++) {
          if (!next[i].id && idx < data.attachmentIds.length) {
            next[i] = { ...next[i], id: data.attachmentIds[idx++] }
          }
        }
        return next
      })
    } catch (e) {
      toast.error(e.response?.data?.error || 'Upload ảnh thất bại')
    }
  }

  async function handleVideoFile(file) {
    if (!file) return
    setVideoInfo({ file, articleToken: null })
    const fd = new FormData()
    fd.append('video', file)
    try {
      const data = await uploadVideoMut.mutateAsync(fd)
      setVideoInfo(prev => prev ? { ...prev, articleToken: data.articleToken } : null)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Upload video thất bại')
      setVideoInfo(null)
    }
  }

  async function handleFileUpload(file) {
    if (!file) return
    setFileInfo({ file, attachmentId: null, filename: file.name })
    const fd = new FormData()
    fd.append('file', file)
    try {
      const data = await uploadFileMut.mutateAsync(fd)
      setFileInfo(prev => prev ? { ...prev, attachmentId: data.attachmentId } : null)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Upload file thất bại')
      setFileInfo(null)
    }
  }

  function buildRecipientList() {
    const ids = []
    recipientText.split('\n').forEach(line => { const s = line.trim(); if (s) ids.push(s) })
    groupText.split('\n').forEach(line => { const s = line.trim(); if (s) ids.push(`g:${s}`) })
    return ids
  }

  async function handleSend() {
    const userIds = buildRecipientList()
    if (!userIds.length) return toast.error('Chưa nhập người nhận')
    const attachmentIds = imgPreviews.filter(p => p.id).map(p => p.id)
    const hasContent = message.trim() || attachmentIds.length
      || videoInfo?.articleToken || fileInfo?.attachmentId || linkMatch
    if (!hasContent) return toast.error('Chưa có nội dung tin nhắn')

    setJob(null); setJobId(null)
    sendMut.mutate({
      userIds,
      message: message.trim() || undefined,
      attachmentIds: attachmentIds.length ? attachmentIds : undefined,
      videoAttachmentId: videoInfo?.articleToken || undefined,
      fileAttachmentId: fileInfo?.attachmentId || undefined,
      adminNote: adminNote.trim() || undefined,
      linkUrl: linkMatch || undefined,
    })
  }

  function addFollowersToPicker() {
    const lines = Array.from(selectedFollowers).join('\n')
    setRecipientText(prev => {
      const existing = prev.trim()
      return existing ? `${existing}\n${lines}` : lines
    })
    setFollowerPickerOpen(false)
    setSelectedFollowers(new Set())
  }

  const filteredFollowers = (followers || []).filter(f =>
    !followerSearch || f.display_name?.toLowerCase().includes(followerSearch.toLowerCase()) || f.user_id?.includes(followerSearch)
  )

  const totalRecipients = buildRecipientList().length

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Cột trái: soạn tin ── */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Đính kèm (tuỳ chọn)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <AttachTypeTabs active={attachType} onChange={setAttachType} />

            {/* Image panel */}
            {attachType === 'image' && (
              <div className="space-y-2">
                <label
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleImageFiles(e.dataTransfer.files) }}
                >
                  <Image className="h-6 w-6 text-slate-300" />
                  <span className="text-sm text-slate-400">Chọn hoặc kéo thả ảnh · tối đa 5 ảnh · 10MB/ảnh</span>
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={e => handleImageFiles(e.target.files)} />
                </label>
                {imgPreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {imgPreviews.map((p, i) => (
                      <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border border-slate-200">
                        <img src={p.url} alt="" className="h-full w-full object-cover" />
                        {!p.id && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="h-4 w-4 text-white animate-spin" /></div>}
                        <button
                          onClick={() => setImgPreviews(prev => prev.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 rounded-full bg-red-500 text-white h-4 w-4 flex items-center justify-center text-[10px] hover:bg-red-600"
                        ><X className="h-2.5 w-2.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Video panel */}
            {attachType === 'video' && (
              <div className="space-y-2">
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  ⚠️ Video chỉ gửi được vào <strong>nhóm</strong> — user cá nhân sẽ nhận link text.
                </div>
                {!videoInfo ? (
                  <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                    <Video className="h-6 w-6 text-slate-300" />
                    <span className="text-sm text-slate-400">Chọn video MP4/MOV · tối đa 100MB</span>
                    <input type="file" accept="video/mp4,video/quicktime" className="hidden"
                      onChange={e => handleVideoFile(e.target.files[0])} />
                  </label>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                    <Video className="h-5 w-5 text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{videoInfo.file.name}</p>
                      <p className="text-xs text-slate-400">{fmtBytes(videoInfo.file.size)}</p>
                    </div>
                    {!videoInfo.articleToken && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                    {videoInfo.articleToken && <span className="text-xs text-green-600 font-medium">✓ Sẵn sàng</span>}
                    <button onClick={() => setVideoInfo(null)} className="text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            )}

            {/* File panel */}
            {attachType === 'file' && (
              <div className="space-y-2">
                {!fileInfo ? (
                  <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                    <FileText className="h-6 w-6 text-slate-300" />
                    <span className="text-sm text-slate-400">Chọn file .docx .pdf .xlsx · tối đa 20MB</span>
                    <input type="file" accept=".docx,.pdf,.xlsx,.xls" className="hidden"
                      onChange={e => handleFileUpload(e.target.files[0])} />
                  </label>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                    <FileText className="h-5 w-5 text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{fileInfo.filename}</p>
                      <p className="text-xs text-slate-400">{fmtBytes(fileInfo.file.size)}</p>
                    </div>
                    {!fileInfo.attachmentId && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                    {fileInfo.attachmentId && <span className="text-xs text-green-600 font-medium">✓ Sẵn sàng</span>}
                    <button onClick={() => setFileInfo(null)} className="text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Nội dung tin nhắn</CardTitle>
              <span className={cn('text-xs font-mono', message.length > 1800 ? 'text-red-500' : 'text-slate-400')}>
                {message.length}/2000
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, 2000))}
              placeholder="Nhập nội dung tin nhắn&#10;&#10;Nếu có link (https://...) sẽ tự động nhúng nút bấm"
              rows={5}
              className="resize-none text-sm"
            />
            {linkMatch && (
              <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
                <span className="shrink-0">🔗 Phát hiện link:</span>
                <span className="truncate font-mono">{linkMatch}</span>
              </div>
            )}
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Ghi chú nội bộ (không gửi đến người dùng)</Label>
              <Input value={adminNote} onChange={e => setAdminNote(e.target.value)}
                placeholder="VD: Thông báo sự kiện tháng 6" className="text-sm" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Cột phải: người nhận ── */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">👤 Người nhận cá nhân</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Follower picker */}
            <div className="relative">
              <button
                onClick={() => setFollowerPickerOpen(v => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 hover:border-blue-400 transition-all"
              >
                <span>Chọn từ danh sách Follower...</span>
                {followerPickerOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {followerPickerOpen && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="p-2 border-b border-slate-100">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-xs outline-none focus:border-blue-400"
                        placeholder="Tìm tên hoặc ID..."
                        value={followerSearch}
                        onChange={e => setFollowerSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {filteredFollowers.length === 0 && (
                      <p className="py-4 text-center text-xs text-slate-400">
                        {followers?.length === 0 ? 'Chưa có follower. Vào tab Followers để đồng bộ.' : 'Không tìm thấy.'}
                      </p>
                    )}
                    {filteredFollowers.map(f => {
                      const checked = selectedFollowers.has(f.user_id)
                      const realName = hasRealName(f)
                      return (
                        <button
                          key={f.user_id}
                          onClick={() => setSelectedFollowers(prev => {
                            const next = new Set(prev)
                            if (checked) next.delete(f.user_id); else next.add(f.user_id)
                            return next
                          })}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-blue-50 transition-colors"
                        >
                          {checked ? <CheckSquare className="h-4 w-4 text-blue-500 shrink-0" /> : <Square className="h-4 w-4 text-slate-300 shrink-0" />}
                          <FollowerAvatar f={f} size={7} />
                          <div className="min-w-0">
                            <p className={cn('text-xs font-medium truncate', !realName && 'text-slate-400 italic')}>
                              {realName ? f.display_name : 'Chưa có tên'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">{f.user_id}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {selectedFollowers.size > 0 && (
                    <div className="p-2 border-t border-slate-100">
                      <Button size="sm" className="w-full" onClick={addFollowersToPicker}>
                        Thêm {selectedFollowers.size} người vào danh sách
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <Textarea
              value={recipientText}
              onChange={e => setRecipientText(e.target.value)}
              placeholder="Nhập Zalo ID, mỗi ID một dòng&#10;&#10;VD:&#10;1234567890&#10;9876543210"
              rows={4}
              className="resize-none text-sm font-mono"
            />
            <p className="text-xs text-slate-400">
              {recipientText.split('\n').filter(l => l.trim()).length} người
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">💬 Nhóm nhận</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Group picker */}
            <div className="relative">
              <button
                onClick={() => setGroupPickerOpen(v => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 hover:border-blue-400 transition-all"
              >
                <span>Chọn nhóm từ danh sách...</span>
                {groupPickerOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {groupPickerOpen && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="max-h-52 overflow-y-auto">
                    {!groups?.length && <p className="py-4 text-center text-xs text-slate-400">Chưa có nhóm. Vào tab Followers để thêm nhóm.</p>}
                    {groups?.map(g => (
                      <button
                        key={g.group_id}
                        onClick={() => {
                          setGroupText(prev => {
                            const existing = prev.trim()
                            if (existing.split('\n').includes(g.group_id)) return prev
                            return existing ? `${existing}\n${g.group_id}` : g.group_id
                          })
                          setGroupPickerOpen(false)
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-blue-50 transition-colors"
                      >
                        <div>
                          <p className="text-xs font-medium">{g.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{g.group_id}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Textarea
              value={groupText}
              onChange={e => setGroupText(e.target.value)}
              placeholder="Nhập Group ID, mỗi ID một dòng"
              rows={3}
              className="resize-none text-sm font-mono"
            />
            <p className="text-xs text-slate-400">
              {groupText.split('\n').filter(l => l.trim()).length} nhóm
            </p>
          </CardContent>
        </Card>

        {/* Send button + progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">
              Tổng: <strong className="text-slate-800">{totalRecipients}</strong> người nhận
            </span>
          </div>
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={handleSend}
            disabled={sendMut.isPending || (job && !job.done)}
          >
            {sendMut.isPending || (job && !job.done)
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang gửi...</>
              : <><Send className="h-4 w-4" /> Gửi Tin Nhắn</>
            }
          </Button>
          {job && (
            <div className="space-y-1.5">
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${job.total ? ((job.sent + job.failed) / job.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 text-center">
                {job.done ? '✅ Hoàn tất' : `${job.sent + job.failed}/${job.total}`}
                {job.sent > 0 && ` · ${job.sent} thành công`}
                {job.failed > 0 && ` · ${job.failed} thất bại`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── FollowersTab ───────────────────────────────────────────────────────────────
function FollowersTab() {
  const qc = useQueryClient()
  const [subTab, setSubTab] = useState('followers')
  const [search, setSearch] = useState('')
  const [checkedIds, setCheckedIds] = useState(new Set())
  const [newGroup, setNewGroup] = useState({ group_id: '', name: '' })

  const { data: followersData, isLoading: fLoading } = useQuery({
    queryKey: ['broadcast-followers'],
    queryFn: () => api.get('/api/broadcast/followers').then(r => r.data),
  })
  const { data: groupsData, isLoading: gLoading } = useQuery({
    queryKey: ['broadcast-groups'],
    queryFn: () => api.get('/api/broadcast/groups').then(r => r.data),
  })

  const { data: catsData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/categories').then(r => r.data),
  })

  const [tokenExpired, setTokenExpired] = useState(false)

  const syncMut = useMutation({
    mutationFn: () => api.post('/api/broadcast/followers/sync').then(r => r.data),
    onSuccess: (d) => {
      setTokenExpired(false)
      qc.invalidateQueries({ queryKey: ['broadcast-followers'] })
      toast.success(`Đã đồng bộ ${d.count} follower`)
    },
    onError: (e) => {
      const code = e.response?.data?.code
      const msg  = e.response?.data?.error || 'Lỗi đồng bộ'
      if (code === 'TOKEN_EXPIRED') {
        setTokenExpired(true)
        toast.error('Token Zalo hết hạn — cập nhật token để tiếp tục')
      } else {
        toast.error(msg)
      }
    },
  })

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ group_id: '', name: '' })

  const addGroupMut = useMutation({
    mutationFn: () => api.post('/api/broadcast/groups', newGroup).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['broadcast-groups'] })
      setNewGroup({ group_id: '', name: '' })
      toast.success('Đã thêm nhóm')
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi thêm nhóm'),
  })

  const updateGroupMut = useMutation({
    mutationFn: ({ oldId, group_id, name }) =>
      api.put(`/api/broadcast/groups/${oldId}`, { group_id, name }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['broadcast-groups'] })
      setEditingId(null)
      toast.success('Đã cập nhật nhóm')
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi cập nhật'),
  })

  const removeGroupMut = useMutation({
    mutationFn: (id) => api.delete(`/api/broadcast/groups/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['broadcast-groups'] })
      toast.success('Đã xoá nhóm')
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi xoá'),
  })

  const importCatsMut = useMutation({
    mutationFn: async () => {
      const cats = catsData?.categories || []
      const existingIds = new Set((groupsData?.groups || []).map(g => g.group_id))
      const toAdd = cats.filter(c => c.zaloGroupId && !existingIds.has(c.zaloGroupId))
      if (!toAdd.length) return 0
      await Promise.all(toAdd.map(c => api.post('/api/broadcast/groups', { group_id: c.zaloGroupId, name: c.name })))
      return toAdd.length
    },
    onSuccess: (count) => {
      if (count > 0) {
        qc.invalidateQueries({ queryKey: ['broadcast-groups'] })
        toast.success(`Đã tự động thêm ${count} nhóm từ danh mục`)
      }
    },
    onError: () => {},
  })

  // Tự động import nhóm từ danh mục khi groups rỗng
  useEffect(() => {
    if (
      !gLoading &&
      !importCatsMut.isPending &&
      groupsData &&
      (groupsData.groups || []).length === 0 &&
      catsData?.categories?.length > 0
    ) {
      importCatsMut.mutate()
    }
  }, [gLoading, groupsData, catsData])

  const followers = followersData?.followers || []
  const groups = groupsData?.groups || []
  const filtered = search
    ? followers.filter(f => f.display_name?.toLowerCase().includes(search.toLowerCase()) || f.user_id?.includes(search))
    : followers

  const allChecked = filtered.length > 0 && filtered.every(f => checkedIds.has(f.user_id))

  return (
    <div className="space-y-4">
      {tokenExpired && <TokenExpiredBanner />}

      <div className="flex gap-2 rounded-2xl bg-slate-100 p-1">
        {[
          { id: 'followers', label: `Followers${followers.length ? ` (${followers.length})` : ''}` },
          { id: 'groups', label: `Nhóm${groups.length ? ` (${groups.length})` : ''}` },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setSubTab(id)}
            className={cn('flex-1 rounded-xl py-2 text-sm font-medium transition-all',
              subTab === id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}>{label}</button>
        ))}
      </div>

      {subTab === 'followers' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Danh sách Follower</CardTitle>
                {followersData?.syncedAt && (
                  <p className="text-xs text-slate-400 mt-0.5">Đồng bộ lần cuối: {fmtTs(followersData.syncedAt)}</p>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    className="rounded-xl border border-slate-200 pl-8 pr-3 py-2 text-sm outline-none focus:border-blue-400 w-48"
                    placeholder="Tìm tên hoặc ID..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
                  {syncMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span className="ml-1.5">Đồng bộ</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {fLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>}
            {!fLoading && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="w-8 pb-2">
                        <input type="checkbox" checked={allChecked}
                          onChange={e => {
                            if (e.target.checked) setCheckedIds(new Set(filtered.map(f => f.user_id)))
                            else setCheckedIds(new Set())
                          }}
                          className="rounded"
                        />
                      </th>
                      <th className="text-left pb-2 font-medium text-slate-500 pl-2">Người dùng</th>
                      <th className="text-left pb-2 font-medium text-slate-500">Zalo ID</th>
                      <th className="w-16 pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr><td colSpan={4} className="py-8 text-center text-slate-400">
                        {followers.length === 0 ? 'Chưa có dữ liệu. Nhấn "Đồng bộ" để lấy danh sách.' : 'Không tìm thấy.'}
                      </td></tr>
                    )}
                    {filtered.map(f => {
                      const realName = hasRealName(f)
                      return (
                        <tr key={f.user_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="py-2">
                            <input type="checkbox" checked={checkedIds.has(f.user_id)}
                              onChange={e => {
                                const next = new Set(checkedIds)
                                if (e.target.checked) next.add(f.user_id); else next.delete(f.user_id)
                                setCheckedIds(next)
                              }}
                              className="rounded"
                            />
                          </td>
                          <td className="py-2 pl-2">
                            <div className="flex items-center gap-2.5">
                              <FollowerAvatar f={f} size={8} />
                              <div>
                                <p className={cn('text-sm font-medium', !realName && 'text-slate-400 italic')}>
                                  {realName ? f.display_name : 'Chưa có tên'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 font-mono text-xs text-slate-500">{f.user_id}</td>
                          <td className="py-2">
                            <button
                              onClick={() => navigator.clipboard.writeText(f.user_id).then(() => {})}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 transition-colors"
                              title="Sao chép ID"
                            >
                              Sao chép
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {subTab === 'groups' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Danh sách Nhóm</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
              <span>✅ Nhóm được thêm bằng Group ID từ OA Manager.</span>
              <button
                onClick={() => importCatsMut.mutate()}
                disabled={importCatsMut.isPending || !catsData?.categories?.length}
                className="flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-md bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {importCatsMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Nhập từ danh mục
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                placeholder="Group ID *"
                value={newGroup.group_id}
                onChange={e => setNewGroup(p => ({ ...p, group_id: e.target.value }))}
                className="text-sm font-mono sm:col-span-1"
              />
              <Input
                placeholder="Tên nhóm (tuỳ chọn)"
                value={newGroup.name}
                onChange={e => setNewGroup(p => ({ ...p, name: e.target.value }))}
                className="text-sm sm:col-span-1"
              />
              <Button
                onClick={() => addGroupMut.mutate()}
                disabled={!newGroup.group_id.trim() || addGroupMut.isPending}
                className="gap-1"
              >
                {addGroupMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Thêm nhóm
              </Button>
            </div>

            {gLoading && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>}
            {!gLoading && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left pb-2 font-medium text-slate-500">Tên nhóm</th>
                      <th className="text-left pb-2 font-medium text-slate-500">Group ID</th>
                      <th className="w-12 pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {groups.length === 0 && (
                      <tr><td colSpan={4} className="py-6 text-center text-slate-400">Chưa có nhóm nào.</td></tr>
                    )}
                    {groups.map(g => {
                      const isEditing = editingId === g.group_id
                      return (
                        <tr key={g.group_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          {isEditing ? (
                            <>
                              <td className="py-2 pr-2">
                                <input
                                  className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                                  value={editForm.name}
                                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                                  placeholder="Tên nhóm"
                                />
                              </td>
                              <td className="py-2 pr-2">
                                <input
                                  className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                                  value={editForm.group_id}
                                  onChange={e => setEditForm(p => ({ ...p, group_id: e.target.value }))}
                                  placeholder="Group ID"
                                />
                              </td>
                              <td className="py-2">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => updateGroupMut.mutate({ oldId: g.group_id, ...editForm })}
                                    disabled={!editForm.group_id.trim() || updateGroupMut.isPending}
                                    className="text-green-600 hover:text-green-800 disabled:opacity-40"
                                    title="Lưu"
                                  >
                                    {updateGroupMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                  </button>
                                  <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600" title="Hủy">
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2.5 font-medium">{g.name}</td>
                              <td className="py-2.5 font-mono text-xs text-slate-500">{g.group_id}</td>
                              <td className="py-2.5">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => { setEditingId(g.group_id); setEditForm({ group_id: g.group_id, name: g.name || '' }) }}
                                    className="text-slate-400 hover:text-blue-500 transition-colors"
                                    title="Sửa"
                                  ><Pencil className="h-4 w-4" /></button>
                                  <button
                                    onClick={() => removeGroupMut.mutate(g.group_id)}
                                    disabled={removeGroupMut.isPending}
                                    className="text-slate-400 hover:text-red-500 transition-colors"
                                    title="Xóa"
                                  ><Trash2 className="h-4 w-4" /></button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── LogsTab ────────────────────────────────────────────────────────────────────
function LogsTab() {
  const qc = useQueryClient()
  const [confirmClearAll, setConfirmClearAll] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['broadcast-logs'],
    queryFn: () => api.get('/api/broadcast/logs').then(r => r.data),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/api/broadcast/logs/${id}`).then(r => r.data),
    onSuccess: () => {
      toast.success('Đã xóa')
      qc.invalidateQueries({ queryKey: ['broadcast-logs'] })
    },
    onError: () => toast.error('Xóa thất bại'),
  })

  const clearAllMut = useMutation({
    mutationFn: () => api.delete('/api/broadcast/logs/all').then(r => r.data),
    onSuccess: () => {
      toast.success('Đã xóa toàn bộ lịch sử')
      setConfirmClearAll(false)
      qc.invalidateQueries({ queryKey: ['broadcast-logs'] })
    },
    onError: () => toast.error('Xóa thất bại'),
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Lịch sử gửi tin</CardTitle>
          <div className="flex items-center gap-2">
            {data?.logs?.length > 0 && (
              confirmClearAll ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">Xóa tất cả?</span>
                  <button
                    onClick={() => clearAllMut.mutate()}
                    disabled={clearAllMut.isPending}
                    className="text-xs font-medium text-red-600 hover:text-red-800 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                  >
                    {clearAllMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Xác nhận'}
                  </button>
                  <button onClick={() => setConfirmClearAll(false)} className="text-xs text-slate-400 hover:text-slate-600">Hủy</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClearAll(true)}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Xóa tất cả
                </button>
              )
            )}
            <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['broadcast-logs'] })}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tải lại
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>}
        {!isLoading && (!data?.logs?.length) && (
          <p className="py-8 text-center text-slate-400">Chưa có lịch sử gửi.</p>
        )}
        {!isLoading && data?.logs?.length > 0 && (
          <div className="space-y-2">
            {data.logs.map((log, i) => (
              <div key={log.id || i} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{log.message || '[ảnh/file/video]'}</p>
                  {log.adminNote && <p className="text-xs text-slate-400 mt-0.5">📝 {log.adminNote}</p>}
                  <p className="text-xs text-slate-400 mt-1">{fmtTs(log.timestamp)}</p>
                </div>
                <div className="flex items-start gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-700">{log.recipientCount} người</p>
                    <p className="text-xs text-green-600">{log.sent} thành công</p>
                    {log.failed > 0 && <p className="text-xs text-red-500">{log.failed} thất bại</p>}
                  </div>
                  {log.id && (
                    <button
                      onClick={() => deleteMut.mutate(log.id)}
                      disabled={deleteMut.isPending}
                      className="mt-0.5 text-slate-300 hover:text-red-500 transition-colors"
                      title="Xóa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── helpers cho ScheduleTab ───────────────────────────────────────────────────
const STATUS_LABEL = {
  pending:   { text: 'Chờ gửi',   cls: 'bg-blue-100 text-blue-700' },
  sending:   { text: 'Đang gửi',  cls: 'bg-amber-100 text-amber-700' },
  done:      { text: 'Đã gửi',    cls: 'bg-green-100 text-green-700' },
  failed:    { text: 'Thất bại',  cls: 'bg-red-100 text-red-700' },
  cancelled: { text: 'Đã hủy',   cls: 'bg-slate-100 text-slate-500' },
}

function toLocalDatetimeValue(date) {
  const d = new Date(date)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── ScheduleTab ────────────────────────────────────────────────────────────────
function ScheduleTab({ followers, groups }) {
  const qc = useQueryClient()

  // form state
  const [title, setTitle] = useState('')
  const [attachType, setAttachType] = useState('image')
  const [imgPreviews, setImgPreviews] = useState([])
  const [videoInfo, setVideoInfo] = useState(null)
  const [fileInfo, setFileInfo] = useState(null)
  const [message, setMessage] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [recipientText, setRecipientText] = useState('')
  const [groupText, setGroupText] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [followerPickerOpen, setFollowerPickerOpen] = useState(false)
  const [followerSearch, setFollowerSearch] = useState('')
  const [selectedFollowers, setSelectedFollowers] = useState(new Set())
  const [groupPickerOpen, setGroupPickerOpen] = useState(false)

  const linkMatch = message.match(/https?:\/\/[^\s]+/)?.[0] || ''

  // upload mutations (reuse same endpoints)
  const uploadImageMut = useMutation({
    mutationFn: (fd) => api.post('/api/broadcast/upload/image', fd).then(r => r.data),
  })
  const uploadVideoMut = useMutation({
    mutationFn: (fd) => api.post('/api/broadcast/upload/video', fd).then(r => r.data),
  })
  const uploadFileMut = useMutation({
    mutationFn: (fd) => api.post('/api/broadcast/upload/file', fd).then(r => r.data),
  })

  const scheduleMut = useMutation({
    mutationFn: (body) => api.post('/api/broadcast/schedule', body).then(r => r.data),
    onSuccess: () => {
      toast.success('Đã lên lịch gửi tin thành công!')
      setTitle(''); setMessage(''); setAdminNote('')
      setRecipientText(''); setGroupText(''); setScheduledAt('')
      setImgPreviews([]); setVideoInfo(null); setFileInfo(null)
      qc.invalidateQueries({ queryKey: ['scheduled-messages'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi đặt lịch'),
  })

  const cancelMut = useMutation({
    mutationFn: (id) => api.delete(`/api/broadcast/schedule/${id}`).then(r => r.data),
    onSuccess: () => {
      toast.success('Đã hủy lịch gửi')
      qc.invalidateQueries({ queryKey: ['scheduled-messages'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi hủy lịch'),
  })

  const { data: schedData, isLoading: schedLoading } = useQuery({
    queryKey: ['scheduled-messages'],
    queryFn: () => api.get('/api/broadcast/schedule').then(r => r.data),
    refetchInterval: 15000,
  })

  async function handleImageFiles(files) {
    const allowed = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 5 - imgPreviews.length)
    if (!allowed.length) return
    const previews = allowed.map(f => ({ file: f, url: URL.createObjectURL(f), id: null }))
    setImgPreviews(prev => [...prev, ...previews])
    const fd = new FormData()
    allowed.forEach(f => fd.append('images', f))
    try {
      const data = await uploadImageMut.mutateAsync(fd)
      setImgPreviews(prev => {
        const next = [...prev]
        let idx = 0
        for (let i = 0; i < next.length; i++) {
          if (!next[i].id && idx < data.attachmentIds.length) {
            next[i] = { ...next[i], id: data.attachmentIds[idx++] }
          }
        }
        return next
      })
    } catch (e) { toast.error(e.response?.data?.error || 'Upload ảnh thất bại') }
  }

  async function handleVideoFile(file) {
    if (!file) return
    setVideoInfo({ file, articleToken: null })
    const fd = new FormData()
    fd.append('video', file)
    try {
      const data = await uploadVideoMut.mutateAsync(fd)
      setVideoInfo(prev => prev ? { ...prev, articleToken: data.articleToken } : null)
    } catch (e) { toast.error(e.response?.data?.error || 'Upload video thất bại'); setVideoInfo(null) }
  }

  async function handleFileUpload(file) {
    if (!file) return
    setFileInfo({ file, attachmentId: null, filename: file.name })
    const fd = new FormData()
    fd.append('file', file)
    try {
      const data = await uploadFileMut.mutateAsync(fd)
      setFileInfo(prev => prev ? { ...prev, attachmentId: data.attachmentId } : null)
    } catch (e) { toast.error(e.response?.data?.error || 'Upload file thất bại'); setFileInfo(null) }
  }

  function buildUserIds() {
    return recipientText.split('\n').map(l => l.trim()).filter(Boolean)
  }
  function buildGroupIds() {
    return groupText.split('\n').map(l => l.trim()).filter(Boolean)
  }

  function addFollowersToPicker() {
    const lines = Array.from(selectedFollowers).join('\n')
    setRecipientText(prev => prev.trim() ? `${prev.trim()}\n${lines}` : lines)
    setFollowerPickerOpen(false)
    setSelectedFollowers(new Set())
  }

  const filteredFollowers = (followers || []).filter(f =>
    !followerSearch || f.display_name?.toLowerCase().includes(followerSearch.toLowerCase()) || f.user_id?.includes(followerSearch)
  )

  async function handleSchedule() {
    const userIds = buildUserIds()
    const groupIds = buildGroupIds()
    if (!userIds.length && !groupIds.length) return toast.error('Chưa nhập người nhận hoặc nhóm')
    if (!scheduledAt) return toast.error('Chưa chọn thời gian gửi')
    const scheduledDate = new Date(scheduledAt)
    if (scheduledDate <= new Date()) return toast.error('Thời gian gửi phải ở tương lai')
    const attachmentIds = imgPreviews.filter(p => p.id).map(p => p.id)
    const hasContent = message.trim() || attachmentIds.length || videoInfo?.articleToken || fileInfo?.attachmentId || linkMatch
    if (!hasContent) return toast.error('Chưa có nội dung tin nhắn')

    scheduleMut.mutate({
      title: title.trim() || undefined,
      message: message.trim() || undefined,
      adminNote: adminNote.trim() || undefined,
      attachmentIds: attachmentIds.length ? attachmentIds : undefined,
      videoAttachmentId: videoInfo?.articleToken || undefined,
      fileAttachmentId: fileInfo?.attachmentId || undefined,
      linkUrl: linkMatch || undefined,
      userIds,
      groupIds,
      scheduledAt: scheduledDate.toISOString(),
    })
  }

  const totalRecipients = buildUserIds().length + buildGroupIds().length

  return (
    <div className="space-y-6">
      {/* ── Form đặt lịch ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cột trái: nội dung */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Đính kèm (tuỳ chọn)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <AttachTypeTabs active={attachType} onChange={setAttachType} />
              {attachType === 'image' && (
                <div className="space-y-2">
                  <label
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); handleImageFiles(e.dataTransfer.files) }}
                  >
                    <Image className="h-6 w-6 text-slate-300" />
                    <span className="text-sm text-slate-400">Chọn hoặc kéo thả ảnh · tối đa 5 ảnh · 10MB/ảnh</span>
                    <input type="file" accept="image/*" multiple className="hidden"
                      onChange={e => handleImageFiles(e.target.files)} />
                  </label>
                  {imgPreviews.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {imgPreviews.map((p, i) => (
                        <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border border-slate-200">
                          <img src={p.url} alt="" className="h-full w-full object-cover" />
                          {!p.id && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="h-4 w-4 text-white animate-spin" /></div>}
                          <button onClick={() => setImgPreviews(prev => prev.filter((_, j) => j !== i))}
                            className="absolute top-0.5 right-0.5 rounded-full bg-red-500 text-white h-4 w-4 flex items-center justify-center hover:bg-red-600">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {attachType === 'video' && (
                <div className="space-y-2">
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                    ⚠️ Video chỉ gửi được vào <strong>nhóm</strong> — user cá nhân sẽ nhận link text.
                  </div>
                  {!videoInfo ? (
                    <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                      <Video className="h-6 w-6 text-slate-300" />
                      <span className="text-sm text-slate-400">Chọn file video · tối đa 100MB</span>
                      <input type="file" accept="video/*" className="hidden" onChange={e => handleVideoFile(e.target.files[0])} />
                    </label>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <Video className="h-5 w-5 text-slate-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{videoInfo.file.name}</p>
                        <p className="text-xs text-slate-400">{fmtBytes(videoInfo.file.size)}</p>
                        {!videoInfo.articleToken && <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5"><Loader2 className="h-3 w-3 animate-spin" />Đang upload...</p>}
                        {videoInfo.articleToken && <p className="text-xs text-green-600 mt-0.5">Đã upload</p>}
                      </div>
                      <button onClick={() => setVideoInfo(null)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              )}
              {attachType === 'file' && (
                <div className="space-y-2">
                  {!fileInfo ? (
                    <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                      <FileText className="h-6 w-6 text-slate-300" />
                      <span className="text-sm text-slate-400">Chọn file · .docx .pdf .xlsx · tối đa 20MB</span>
                      <input type="file" accept=".docx,.pdf,.xlsx,.xls" className="hidden" onChange={e => handleFileUpload(e.target.files[0])} />
                    </label>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <FileText className="h-5 w-5 text-slate-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{fileInfo.filename}</p>
                        <p className="text-xs text-slate-400">{fmtBytes(fileInfo.file.size)}</p>
                        {!fileInfo.attachmentId && <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5"><Loader2 className="h-3 w-3 animate-spin" />Đang upload...</p>}
                        {fileInfo.attachmentId && <p className="text-xs text-green-600 mt-0.5">Đã upload</p>}
                      </div>
                      <button onClick={() => setFileInfo(null)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="space-y-1.5">
                <Label>Tên lịch (ghi chú nội bộ)</Label>
                <Input
                  placeholder="VD: Thông báo họp tháng 6"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Nội dung tin nhắn</Label>
                  <span className="text-xs text-slate-400">{message.length}/2000</span>
                </div>
                <Textarea
                  placeholder="Nhập nội dung tin nhắn&#10;Nếu có link (https://...) sẽ tự động nhúng nút bấm"
                  value={message}
                  onChange={e => setMessage(e.target.value.slice(0, 2000))}
                  className="min-h-[120px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400">Ghi chú nội bộ (không gửi đến người dùng)</Label>
                <Input
                  placeholder="VD: Thông báo sự kiện tháng 6"
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cột phải: người nhận + thời gian */}
        <div className="space-y-4">
          {/* Người nhận cá nhân */}
          <Card>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5"><Users className="h-4 w-4" />Người nhận cá nhân</Label>
                {followers?.length > 0 && (
                  <button onClick={() => setFollowerPickerOpen(v => !v)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                    <Plus className="h-3.5 w-3.5" />Chọn từ danh sách Follower
                  </button>
                )}
              </div>
              {followerPickerOpen && (
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="p-2 border-b border-slate-100">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        placeholder="Tìm follower..."
                        value={followerSearch}
                        onChange={e => setFollowerSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                    {filteredFollowers.slice(0, 50).map(f => (
                      <label key={f.user_id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                        <div onClick={() => setSelectedFollowers(prev => { const s = new Set(prev); s.has(f.user_id) ? s.delete(f.user_id) : s.add(f.user_id); return s })}>
                          {selectedFollowers.has(f.user_id) ? <CheckSquare className="h-4 w-4 text-blue-500" /> : <Square className="h-4 w-4 text-slate-300" />}
                        </div>
                        <FollowerAvatar f={f} size={7} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{hasRealName(f) ? f.display_name : f.user_id}</p>
                          {hasRealName(f) && <p className="text-xs text-slate-400 truncate">{f.user_id}</p>}
                        </div>
                      </label>
                    ))}
                    {filteredFollowers.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Không tìm thấy</p>}
                  </div>
                  {selectedFollowers.size > 0 && (
                    <div className="p-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Đã chọn {selectedFollowers.size} người</span>
                      <Button size="sm" onClick={addFollowersToPicker}>Thêm vào danh sách</Button>
                    </div>
                  )}
                </div>
              )}
              <Textarea
                placeholder={'Nhập Zalo ID, mỗi ID một dòng\n\nVD:\n1234567890\n9876543210'}
                value={recipientText}
                onChange={e => setRecipientText(e.target.value)}
                className="min-h-[100px] text-sm font-mono"
              />
              <p className="text-xs text-slate-400">{buildUserIds().length} người</p>
            </CardContent>
          </Card>

          {/* Nhóm */}
          <Card>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-slate-600">💬 Nhóm nhận</Label>
                {groups?.length > 0 && (
                  <button onClick={() => setGroupPickerOpen(v => !v)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                    <Plus className="h-3.5 w-3.5" />Chọn nhóm từ danh sách
                  </button>
                )}
              </div>
              {groupPickerOpen && (
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-50">
                    {(groups || []).map(g => (
                      <label key={g.group_id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                        onClick={() => {
                          setGroupText(prev => {
                            const lines = prev.split('\n').map(l => l.trim()).filter(Boolean)
                            if (lines.includes(g.group_id)) return prev
                            return [...lines, g.group_id].join('\n')
                          })
                          setGroupPickerOpen(false)
                        }}>
                        <div className="h-7 w-7 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold shrink-0">
                          {(g.name || g.group_id)[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{g.name || g.group_id}</p>
                          <p className="text-xs text-slate-400 truncate">{g.group_id}</p>
                        </div>
                      </label>
                    ))}
                    {!groups?.length && <p className="py-4 text-center text-sm text-slate-400">Chưa có nhóm</p>}
                  </div>
                </div>
              )}
              <Textarea
                placeholder="Nhập Group ID, mỗi ID một dòng"
                value={groupText}
                onChange={e => setGroupText(e.target.value)}
                className="min-h-[80px] text-sm font-mono"
              />
              <p className="text-xs text-slate-400">{buildGroupIds().length} nhóm</p>
            </CardContent>
          </Card>

          {/* Thời gian gửi */}
          <Card>
            <CardContent className="pt-5 space-y-3">
              <Label className="flex items-center gap-1.5"><Clock className="h-4 w-4" />Thời gian gửi</Label>
              <input
                type="datetime-local"
                value={scheduledAt}
                min={toLocalDatetimeValue(new Date(Date.now() + 60000))}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {scheduledAt && (
                <p className="text-xs text-slate-500">
                  Gửi lúc: <strong>{fmtTs(new Date(scheduledAt).toISOString())}</strong>
                </p>
              )}
            </CardContent>
          </Card>

          <div className="text-sm text-slate-500 font-medium px-1">
            Tổng: <strong className="text-slate-800">{totalRecipients} người nhận</strong>
          </div>

          <Button
            className="w-full h-12 text-base gap-2"
            onClick={handleSchedule}
            disabled={scheduleMut.isPending || uploadImageMut.isPending || uploadVideoMut.isPending || uploadFileMut.isPending}
          >
            {scheduleMut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CalendarClock className="h-5 w-5" />}
            Đặt lịch gửi
          </Button>
        </div>
      </div>

      {/* ── Danh sách lịch đã đặt ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4" />Lịch đã đặt</CardTitle>
            <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['scheduled-messages'] })}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Tải lại
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {schedLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>}
          {!schedLoading && !schedData?.schedules?.length && (
            <p className="py-8 text-center text-slate-400">Chưa có lịch nào được đặt.</p>
          )}
          {!schedLoading && schedData?.schedules?.length > 0 && (
            <div className="space-y-2">
              {schedData.schedules.map(s => {
                const st = STATUS_LABEL[s.status] || STATUS_LABEL.pending
                const totalR = (s.userIds?.length || 0) + (s.groupIds?.length || 0)
                return (
                  <div key={s._id} className="flex items-start gap-4 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{s.title || s.message?.slice(0, 40) || '[ảnh/file/video]'}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', st.cls)}>{st.text}</span>
                      </div>
                      {s.message && s.title && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{s.message.slice(0, 60)}{s.message.length > 60 ? '...' : ''}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtTs(s.scheduledAt)}</span>
                        <span>{totalR} người nhận</span>
                        {s.attachmentIds?.length > 0 && <span>{s.attachmentIds.length} ảnh</span>}
                        {s.videoAttachmentId && <span>video</span>}
                        {s.fileAttachmentId && <span>file</span>}
                      </div>
                      {s.error && <p className="text-xs text-red-500 mt-1">Lỗi: {s.error}</p>}
                      {s.adminNote && <p className="text-xs text-slate-400 mt-0.5">📝 {s.adminNote}</p>}
                    </div>
                    {s.status === 'pending' && (
                      <button
                        onClick={() => cancelMut.mutate(s._id)}
                        disabled={cancelMut.isPending}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium shrink-0 mt-0.5"
                        title="Hủy lịch"
                      >
                        <Ban className="h-3.5 w-3.5" />Hủy
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function MessagesPage() {
  const { user } = useAuth()
  if (user?.role !== 'superadmin') return <Navigate to="/dashboard" replace />

  const [tab, setTab] = useState('send')

  const { data: followersData } = useQuery({
    queryKey: ['broadcast-followers'],
    queryFn: () => api.get('/api/broadcast/followers').then(r => r.data),
  })
  const { data: groupsData } = useQuery({
    queryKey: ['broadcast-groups'],
    queryFn: () => api.get('/api/broadcast/groups').then(r => r.data),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Gửi tin nhắn Zalo</h1>
        <p className="text-sm text-slate-500 mt-1">Soạn và gửi thông báo đến follower và nhóm Zalo OA</p>
      </div>

      <TabBar active={tab} onChange={setTab} />

      {tab === 'send' && (
        <SendTab
          followers={followersData?.followers}
          groups={groupsData?.groups}
          syncedAt={followersData?.syncedAt}
        />
      )}
      {tab === 'followers' && <FollowersTab />}
      {tab === 'logs' && <LogsTab />}
      {tab === 'schedule' && (
        <ScheduleTab
          followers={followersData?.followers}
          groups={groupsData?.groups}
        />
      )}
    </div>
  )
}
