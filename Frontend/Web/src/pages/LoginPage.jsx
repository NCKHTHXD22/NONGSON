import { Suspense, lazy, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Building2, Eye, EyeOff, Loader2, Lock, User, ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

const GlobeHero = lazy(() => import('@/components/login/GlobeHero'))

// mode: 'login' | 'forgot' | 'reset'
export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuth()
  const [showPwd, setShowPwd] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [mode, setMode] = useState('login')

  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [forgotUsername, setForgotUsername] = useState('')
  const [resetForm, setResetForm] = useState({ otp: '', newPassword: '', confirmPassword: '' })

  const loginMutation = useMutation({
    mutationFn: (data) => api.post('/api/auth/login', data).then((r) => r.data),
    onSuccess: (data) => {
      setAuth(data.user, data.token)
      navigate('/messages', { replace: true })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Đăng nhập thất bại'),
  })

  const forgotMutation = useMutation({
    mutationFn: () => api.post('/api/auth/forgot-password', { username: forgotUsername.trim() }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Mã OTP đã gửi qua Zalo của bạn')
      setMode('reset')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Gửi OTP thất bại'),
  })

  const resetMutation = useMutation({
    mutationFn: () =>
      api.post('/api/auth/reset-password', {
        username: forgotUsername.trim(),
        otp: resetForm.otp.trim(),
        newPassword: resetForm.newPassword,
      }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.')
      setMode('login')
      setLoginForm((f) => ({ ...f, username: forgotUsername }))
      setForgotUsername('')
      setResetForm({ otp: '', newPassword: '', confirmPassword: '' })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Đặt lại mật khẩu thất bại'),
  })

  const handleLogin = (e) => {
    e.preventDefault()
    if (!loginForm.username || !loginForm.password) {
      toast.error('Vui lòng nhập đầy đủ thông tin')
      return
    }
    loginMutation.mutate(loginForm)
  }

  const handleForgot = (e) => {
    e.preventDefault()
    if (!forgotUsername.trim()) { toast.error('Vui lòng nhập tên đăng nhập'); return }
    forgotMutation.mutate()
  }

  const handleReset = (e) => {
    e.preventDefault()
    if (!resetForm.otp.trim()) { toast.error('Vui lòng nhập mã OTP'); return }
    if (resetForm.newPassword.length < 6) { toast.error('Mật khẩu mới phải có ít nhất 6 ký tự'); return }
    if (resetForm.newPassword !== resetForm.confirmPassword) { toast.error('Mật khẩu xác nhận không khớp'); return }
    resetMutation.mutate()
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-end"
      style={{ background: '#050a1c' }}>

      {/* Globe background */}
      <Suspense fallback={null}>
        <GlobeHero />
      </Suspense>

      {/* Gradient overlay phía phải để form dễ đọc hơn */}
      <div
        className="pointer-events-none absolute inset-0 z-[3]"
        style={{ background: 'linear-gradient(to left, rgba(5,10,28,.80) 30%, transparent 75%)' }}
      />

      {/* Login form — floating right */}
      <div className="relative z-[4] w-full max-w-sm mr-8 lg:mr-16 xl:mr-24 my-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-2xl shadow-blue-900/50 mb-3">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-white text-xl font-extrabold tracking-tight">UBND Xã Nông Sơn</h2>
          <p className="text-blue-300/70 text-xs mt-1">Hệ thống quản lý góp ý - phản ánh</p>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 p-8">

            {/* ── BƯỚC 1: Đăng nhập ── */}
            {mode === 'login' && (
              <>
                <div className="mb-7">
                  <h2 className="text-2xl font-extrabold text-slate-800">Đăng nhập</h2>
                  <p className="text-slate-400 text-sm mt-1">Dành cho cán bộ UBND Xã Nong Son</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Tên đăng nhập</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Nhập tên đăng nhập"
                        autoComplete="username"
                        autoFocus
                        value={loginForm.username}
                        onChange={(e) => setLoginForm((f) => ({ ...f, username: e.target.value }))}
                        className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Mật khẩu</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none" />
                      <input
                        type={showPwd ? 'text' : 'password'}
                        placeholder="Nhập mật khẩu"
                        autoComplete="current-password"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                        className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-11 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition-all"
                      />
                      <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loginMutation.isPending}
                    className="w-full h-11 rounded-xl font-semibold text-sm text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                    style={{
                      background: loginMutation.isPending ? '#93c5fd' : 'linear-gradient(135deg, #2563eb, #0ea5e9)',
                      boxShadow: loginMutation.isPending ? 'none' : '0 4px 14px rgba(37,99,235,0.35)',
                    }}
                  >
                    {loginMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loginMutation.isPending ? 'Đang đăng nhập...' : 'Đăng nhập'}
                  </button>
                </form>
                <div className="mt-5 text-center">
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs text-blue-500 hover:text-blue-700 hover:underline transition-colors"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <p className="text-center text-[11px] text-slate-300 mt-4">
                  Khu vực dành riêng cho cán bộ UBND Xã Nong Son &bull; Liên hệ quản trị để được hỗ trợ
                </p>
              </>
            )}

            {/* ── BƯỚC 2: Nhập tên đăng nhập để nhận OTP ── */}
            {mode === 'forgot' && (
              <>
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-4"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Quay lại đăng nhập
                  </button>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 mb-3">
                    <KeyRound className="h-6 w-6 text-blue-500" />
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-800">Quên mật khẩu</h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Nhập tên đăng nhập. Hệ thống sẽ gửi mã OTP 6 số qua Zalo của bạn.
                  </p>
                </div>
                <form onSubmit={handleForgot} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Tên đăng nhập</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Nhập tên đăng nhập của bạn"
                        autoFocus
                        value={forgotUsername}
                        onChange={(e) => setForgotUsername(e.target.value)}
                        className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={forgotMutation.isPending}
                    className="w-full h-11 rounded-xl font-semibold text-sm text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{
                      background: forgotMutation.isPending ? '#93c5fd' : 'linear-gradient(135deg, #2563eb, #0ea5e9)',
                      boxShadow: forgotMutation.isPending ? 'none' : '0 4px 14px rgba(37,99,235,0.35)',
                    }}
                  >
                    {forgotMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {forgotMutation.isPending ? 'Đang gửi...' : 'Gửi mã OTP qua Zalo'}
                  </button>
                </form>
              </>
            )}

            {/* ── BƯỚC 3: Nhập OTP + mật khẩu mới ── */}
            {mode === 'reset' && (
              <>
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-4"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Gửi lại mã
                  </button>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 mb-3">
                    <ShieldCheck className="h-6 w-6 text-emerald-500" />
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-800">Đặt lại mật khẩu</h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Nhập mã OTP 6 số đã gửi qua Zalo và mật khẩu mới của bạn.
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                    <span>Tài khoản:</span>
                    <span className="font-semibold">{forgotUsername}</span>
                  </div>
                </div>
                <form onSubmit={handleReset} className="space-y-4">
                  {/* OTP */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Mã OTP (6 số)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="_ _ _ _ _ _"
                      autoFocus
                      value={resetForm.otp}
                      onChange={(e) => setResetForm((f) => ({ ...f, otp: e.target.value.replace(/\D/g, '') }))}
                      className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-center text-xl font-bold tracking-[0.4em] text-slate-800 placeholder-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 focus:bg-white transition-all"
                    />
                  </div>
                  {/* New password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Mật khẩu mới</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none" />
                      <input
                        type={showNewPwd ? 'text' : 'password'}
                        placeholder="Tối thiểu 6 ký tự"
                        value={resetForm.newPassword}
                        onChange={(e) => setResetForm((f) => ({ ...f, newPassword: e.target.value }))}
                        className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-11 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 focus:bg-white transition-all"
                      />
                      <button type="button" onClick={() => setShowNewPwd((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                        {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {/* Confirm password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Xác nhận mật khẩu</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none" />
                      <input
                        type={showNewPwd ? 'text' : 'password'}
                        placeholder="Nhập lại mật khẩu mới"
                        value={resetForm.confirmPassword}
                        onChange={(e) => setResetForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                        className={`w-full h-11 rounded-xl border bg-slate-50 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                          resetForm.confirmPassword && resetForm.confirmPassword !== resetForm.newPassword
                            ? 'border-red-300 focus:ring-red-400/30 focus:border-red-400'
                            : 'border-slate-200 focus:ring-emerald-500/30 focus:border-emerald-400'
                        }`}
                      />
                    </div>
                    {resetForm.confirmPassword && resetForm.confirmPassword !== resetForm.newPassword && (
                      <p className="text-[11px] text-red-500">Mật khẩu xác nhận không khớp</p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={resetMutation.isPending}
                    className="w-full h-11 rounded-xl font-semibold text-sm text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{
                      background: resetMutation.isPending ? '#6ee7b7' : 'linear-gradient(135deg, #059669, #10b981)',
                      boxShadow: resetMutation.isPending ? 'none' : '0 4px 14px rgba(5,150,105,0.35)',
                    }}
                  >
                    {resetMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {resetMutation.isPending ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
                  </button>
                </form>
              </>
            )}
        </div>
      </div>
    </div>
  )
}
