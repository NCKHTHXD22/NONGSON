import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Send, UserCheck, Trash2, Loader2, CheckCircle2,
  FileText, ThumbsUp, ThumbsDown, Clock, MapPin,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import StatusBadge from '@/components/feedback/StatusBadge'
import ImageGallery from '@/components/feedback/ImageGallery'
import AttachmentComposer from '@/components/feedback/AttachmentComposer'
import AttachmentViewer from '@/components/feedback/AttachmentViewer'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

const EMPTY_ATTACH = { note: '', images: [], video: { url: '', name: '' }, file: { url: '', name: '' } }

export default function FeedbackDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [draftText, setDraftText] = useState('')
  const [note, setNote] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [assignAttach, setAssignAttach] = useState(EMPTY_ATTACH)
  const [draftAttach, setDraftAttach] = useState(EMPTY_ATTACH)
  const [selfResponse, setSelfResponse] = useState('')
  const [selfAttach, setSelfAttach] = useState(EMPTY_ATTACH)

  const isLeader = user?.role === 'superadmin' || user?.role === 'dept_leader'
  const isOfficer = user?.role === 'officer' || user?.role === 'staff'
  const isSuperadmin = user?.role === 'superadmin'

  const { data, isLoading } = useQuery({
    queryKey: ['feedback', id],
    queryFn: () => api.get(`/api/feedbacks/${id}`).then((r) => r.data),
  })

  useEffect(() => {
    if (data?.feedback) {
      const fb = data.feedback
      setNote(fb.note || '')
      setAssignedTo(fb.assignedTo?._id || '')
      setDraftText(fb.draftResponse || '')
    }
  }, [data])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['feedback', id] })
    queryClient.invalidateQueries({ queryKey: ['feedbacks'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
  }

  const noteMutation = useMutation({
    mutationFn: () => api.put(`/api/feedbacks/${id}`, { note }).then((r) => r.data),
    onSuccess: () => { toast.success('Đã lưu ghi chú'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi lưu'),
  })

  const assignMutation = useMutation({
    mutationFn: () => api.post(`/api/feedbacks/${id}/assign`, {
      assignedTo,
      note: assignAttach.note,
      images: assignAttach.images,
      video: assignAttach.video,
      file: assignAttach.file,
    }).then((r) => r.data),
    onSuccess: () => { toast.success('Đã cập nhật phân công'); setAssignAttach(EMPTY_ATTACH); invalidate() },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi phân công'),
  })

  const draftMutation = useMutation({
    mutationFn: () => api.post(`/api/feedbacks/${id}/draft`, {
      draftResponse: draftText,
      note: draftAttach.note,
      images: draftAttach.images,
      video: draftAttach.video,
      file: draftAttach.file,
    }).then((r) => r.data),
    onSuccess: () => { toast.success('Đã gửi dự thảo, chờ lãnh đạo duyệt'); setDraftAttach(EMPTY_ATTACH); invalidate() },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi gửi dự thảo'),
  })

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/api/feedbacks/${id}/approve`, { finalResponse: draftText }).then((r) => r.data),
    onSuccess: () => { toast.success('Đã duyệt và gửi phản hồi cho dân qua Zalo'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi duyệt'),
  })

  const resolveMutation = useMutation({
    mutationFn: () => api.post(`/api/feedbacks/${id}/resolve`, {
      finalResponse: selfResponse,
      note: selfAttach.note,
      images: selfAttach.images,
      video: selfAttach.video,
      file: selfAttach.file,
    }).then((r) => r.data),
    onSuccess: () => { toast.success('Đã gửi phản hồi cho dân qua Zalo'); setSelfResponse(''); setSelfAttach(EMPTY_ATTACH); invalidate() },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi gửi phản hồi'),
  })

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/api/feedbacks/${id}/reject`, { rejectedReason: rejectReason }).then((r) => r.data),
    onSuccess: () => { toast.success('Đã từ chối, cán bộ cần soạn lại dự thảo'); setRejectReason(''); invalidate() },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi từ chối'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/feedbacks/${id}`),
    onSuccess: () => { toast.success('Đã xóa góp ý'); navigate('/feedbacks') },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi xóa'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const fb = data?.feedback
  const admins = data?.admins ?? []

  if (!fb) return <p className="text-destructive">Không tìm thấy góp ý</p>

  const shortCode = fb._id.slice(-5).toUpperCase()
  const isDraft = fb.status === 'draft'
  const isResolved = fb.status === 'resolved'
  const imgs = fb.imageUrls?.length > 0 ? fb.imageUrls : fb.imageUrl ? [fb.imageUrl] : []

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/feedbacks">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">Chi tiết phản ánh <span className="text-blue-600 font-mono">#{shortCode}</span></h1>
          <p className="text-xs text-muted-foreground">{fb._id}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {fb.categoryId && (
            <span className="text-sm text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              {fb.categoryId.icon} {fb.categoryId.name}
            </span>
          )}
          <StatusBadge status={fb.status} />
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Left — info */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Thông tin người gửi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Họ tên</p>
                  <p className="font-medium">{fb.displayName || '(Ẩn danh)'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Liên hệ</p>
                  <p className="font-medium">{fb.contact}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Ngày gửi</p>
                  <p>{formatDate(fb.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Hạn xử lý</p>
                  <p className={fb.deadline && new Date(fb.deadline) < new Date() && !isResolved ? 'text-red-600 font-semibold' : ''}>
                    {fb.deadline ? formatDate(fb.deadline) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Phân công</p>
                  <p>{fb.assignedTo?.fullName ?? '—'}</p>
                </div>
                {fb.assignedBy && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Người phân công</p>
                    <p>{fb.assignedBy?.fullName ?? '—'}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Nội dung phản ánh</p>
                <div className="bg-gray-50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">{fb.content}</div>
              </div>

              {fb.location?.address && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Vị trí</p>
                  <div className="flex items-center gap-1.5 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <span>{fb.location.address}</span>
                  </div>
                </div>
              )}

              {imgs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Hình ảnh đính kèm ({imgs.length})
                  </p>
                  <ImageGallery images={imgs} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tài liệu phân công từ lãnh đạo */}
          {(fb.assignAttachments?.note || fb.assignAttachments?.images?.length || fb.assignAttachments?.video?.url || fb.assignAttachments?.file?.url) && (
            <Card className="border-blue-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-blue-700">📋 Tài liệu từ lãnh đạo khi phân công</CardTitle>
              </CardHeader>
              <CardContent>
                <AttachmentViewer data={fb.assignAttachments} />
              </CardContent>
            </Card>
          )}

          {/* Dự thảo đang chờ duyệt */}
          {fb.draftResponse && (
            <Card className={isDraft ? 'border-sky-300' : 'border-slate-200'}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-sky-700">
                  <FileText className="h-4 w-4" />
                  Dự thảo phản hồi
                  {isDraft && <span className="text-xs bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full ml-auto">Chờ duyệt</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-sky-50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">{fb.draftResponse}</div>
                {fb.draftBy && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Soạn bởi {fb.draftBy?.fullName} · {fb.draftAt ? formatDate(fb.draftAt) : ''}
                  </p>
                )}
                {(fb.draftAttachments?.note || fb.draftAttachments?.images?.length || fb.draftAttachments?.video?.url || fb.draftAttachments?.file?.url) && (
                  <div className="mt-3 border-t pt-3">
                    <p className="text-xs font-semibold text-slate-500 mb-2">Tài liệu kèm dự thảo:</p>
                    <AttachmentViewer data={fb.draftAttachments} />
                  </div>
                )}
                {fb.rejectedReason && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    <span className="font-semibold">Lý do từ chối: </span>{fb.rejectedReason}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Phản hồi đã gửi dân */}
          {isResolved && fb.finalResponse && (
            <Card className="border-green-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-4 w-4" /> Phản hồi đã gửi qua Zalo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-green-50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">{fb.finalResponse}</div>
                {fb.sentAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Gửi lúc {formatDate(fb.sentAt)}
                    {fb.approvedBy && ` · Duyệt bởi ${fb.approvedBy?.fullName}`}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Ghi chú nội bộ */}
          {fb.note && (
            <Card className="border-yellow-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-yellow-700">📝 Ghi chú nội bộ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-yellow-50 rounded-lg p-3 text-sm whitespace-pre-wrap">{fb.note}</div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right — actions */}
        <div className="lg:col-span-2 space-y-4">

          {/* OFFICER: Soạn dự thảo */}
          {isOfficer && !isResolved && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-sky-500" /> Soạn dự thảo trả lời
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  rows={5}
                  placeholder="Nhập nội dung dự thảo phản hồi cho người dân..."
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                />
                <div className="border-t pt-3">
                  <p className="text-xs text-slate-500 mb-2">Đính kèm tài liệu (tuỳ chọn):</p>
                  <AttachmentComposer value={draftAttach} onChange={setDraftAttach} disabled={draftMutation.isPending} />
                </div>
                <Button
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white"
                  onClick={() => {
                    if (!draftText.trim()) { toast.error('Vui lòng nhập nội dung dự thảo'); return }
                    if (window.confirm('Gửi dự thảo để lãnh đạo duyệt?')) draftMutation.mutate()
                  }}
                  disabled={draftMutation.isPending}
                >
                  {draftMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Gửi dự thảo chờ duyệt
                </Button>
                {isDraft && (
                  <p className="text-xs text-center text-sky-600 bg-sky-50 rounded-lg p-2">
                    Dự thảo đã gửi, đang chờ lãnh đạo duyệt
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* LEADER: Duyệt / Từ chối */}
          {isLeader && isDraft && (
            <Card className="border-sky-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-sky-700">
                  <Clock className="h-4 w-4" /> Duyệt dự thảo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1.5">Nội dung phản hồi gửi dân — có thể chỉnh sửa trước khi duyệt:</p>
                  <Textarea
                    rows={5}
                    className="border-sky-200 focus:ring-sky-300"
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                  />
                  {draftText !== fb.draftResponse && (
                    <p className="text-[11px] text-amber-600 mt-1">✏️ Đã chỉnh sửa so với bản gốc của cán bộ</p>
                  )}
                </div>
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => {
                    if (!draftText.trim()) { toast.error('Nội dung phản hồi không được để trống'); return }
                    if (window.confirm('Duyệt và gửi phản hồi này cho người dân qua Zalo?')) approveMutation.mutate()
                  }}
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ThumbsUp className="h-4 w-4 mr-2" />}
                  Duyệt & Gửi dân
                </Button>
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs text-slate-500">Hoặc từ chối và yêu cầu cán bộ soạn lại:</p>
                  <Textarea
                    rows={2}
                    placeholder="Lý do từ chối (tuỳ chọn)..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    className="w-full border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => {
                      if (window.confirm('Từ chối dự thảo và trả lại cán bộ?')) rejectMutation.mutate()
                    }}
                    disabled={rejectMutation.isPending}
                  >
                    {rejectMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ThumbsDown className="h-4 w-4 mr-2" />}
                    Từ chối — Trả về cán bộ
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SUPERADMIN: Tự xử lý — gửi thẳng cho dân, không cần phân công */}
          {isSuperadmin && !isResolved && (
            <Card className="border-emerald-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
                  <Send className="h-4 w-4" /> Tự xử lý — Phản hồi trực tiếp
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-slate-500">
                  Soạn phản hồi và gửi thẳng cho người dân qua Zalo, không cần phân công cán bộ.
                </p>
                <Textarea
                  rows={5}
                  placeholder="Nhập nội dung phản hồi gửi người dân..."
                  value={selfResponse}
                  onChange={(e) => setSelfResponse(e.target.value)}
                />
                <div className="border-t pt-3">
                  <p className="text-xs text-slate-500 mb-2">Đính kèm gửi kèm người dân (tuỳ chọn):</p>
                  <AttachmentComposer value={selfAttach} onChange={setSelfAttach} disabled={resolveMutation.isPending} />
                </div>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    if (!selfResponse.trim()) { toast.error('Vui lòng nhập nội dung phản hồi'); return }
                    if (window.confirm('Gửi phản hồi này trực tiếp cho người dân qua Zalo?')) resolveMutation.mutate()
                  }}
                  disabled={resolveMutation.isPending}
                >
                  {resolveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Gửi phản hồi cho dân
                </Button>
              </CardContent>
            </Card>
          )}

          {/* LEADER: Phân công */}
          {isLeader && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-blue-500" /> Phân công xử lý
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                >
                  <option value="">— Chưa phân công —</option>
                  {admins.map((a) => (
                    <option key={a._id} value={a._id}>{a.fullName} (@{a.username})</option>
                  ))}
                </select>
                <div className="border-t pt-3">
                  <p className="text-xs text-slate-500 mb-2">Tài liệu giao việc (tuỳ chọn):</p>
                  <AttachmentComposer value={assignAttach} onChange={setAssignAttach} disabled={assignMutation.isPending} />
                </div>
                <Button variant="secondary" className="w-full" onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending}>
                  {assignMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Cập nhật phân công
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Ghi chú nội bộ */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">📝 Ghi chú nội bộ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={3}
                placeholder="Ghi chú cho nội bộ (người gửi không thấy)..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button variant="outline" className="w-full" onClick={() => noteMutation.mutate()} disabled={noteMutation.isPending}>
                {noteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Lưu ghi chú
              </Button>
            </CardContent>
          </Card>

          {/* Xóa — chỉ superadmin */}
          {user?.role === 'superadmin' && (
            <Card className="border-red-100">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Xóa vĩnh viễn phản ánh này</p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { if (window.confirm('Xác nhận xóa vĩnh viễn phản ánh này?')) deleteMutation.mutate() }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Xóa
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
