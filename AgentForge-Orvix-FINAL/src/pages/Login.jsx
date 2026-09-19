import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Workflow, Bell, Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

const FEATURES = [
  { icon: Sparkles, text: 'Describe your automation in plain English' },
  { icon: Workflow, text: 'Get a visual, node-based workflow instantly' },
  { icon: Bell, text: 'Run it and watch results come in live' },
]

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  )
}

function getStoredSession() {
  try {
    const raw = localStorage.getItem('agentforge-session-v1')
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!session || typeof session !== 'object') return null
    if (session.password) {
      const { password, ...safeSession } = session
      localStorage.setItem('agentforge-session-v1', JSON.stringify(safeSession))
      return safeSession
    }
    return session
  } catch {
    return null
  }
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [sessionStatus, setSessionStatus] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const login = useAppStore((s) => s.login)
  const signup = useAppStore((s) => s.signup)
  const loginWithGoogle = useAppStore((s) => s.loginWithGoogle)
  const loginWithToken = useAppStore((s) => s.loginWithToken)
  const resetPassword = useAppStore((s) => s.resetPassword)
  const confirmPasswordReset = useAppStore((s) => s.confirmPasswordReset)
  const lastError = useAppStore((s) => s.lastError)
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const authToken = params.get('token')
    const authError = params.get('error')
    const token = params.get('resetToken')

    if (token) {
      setResetToken(token)
      setAuthMode('reset')
      return
    }

    if (authError) {
      setErrorMessage(decodeURIComponent(authError))
      window.history.replaceState({}, '', '/login')
      return
    }

    if (authToken) {
      setGoogleLoading(true)
      loginWithToken(authToken).then((success) => {
        setGoogleLoading(false)
        window.history.replaceState({}, '', '/login')
        if (success) {
          navigate('/dashboard')
        }
      })
      return
    }

    const savedSession = getStoredSession()

    if (!savedSession?.email) {
      setSessionStatus('')
      return
    }
    setEmail(savedSession.email)
    setRememberMe(savedSession.rememberMe !== false)
    setSessionStatus('Enter your password to continue.')
  }, [loginWithToken, navigate])

  async function handleGoogleSignIn() {
    setErrorMessage('')
    setGoogleLoading(true)
    const started = await loginWithGoogle()
    if (!started) {
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    setErrorMessage('')
    const loggedIn = await login(email, password, rememberMe ? email.split('@')[0] : undefined, rememberMe)
    if (!loggedIn) return
    if (rememberMe) {
      localStorage.setItem('agentforge-session-v1', JSON.stringify({ email: email.trim().toLowerCase(), rememberMe: true, name: email.split('@')[0] }))
    } else {
      localStorage.removeItem('agentforge-session-v1')
    }
    navigate('/dashboard')
  }

  async function handleSignupSubmit(e) {
    e.preventDefault()
    if (!signupName.trim() || !signupEmail.trim() || !signupPassword.trim()) return
    setErrorMessage('')
    const created = await signup(signupName, signupEmail, signupPassword, rememberMe)
    if (!created) return
    if (rememberMe) {
      localStorage.setItem('agentforge-session-v1', JSON.stringify({ email: signupEmail.trim().toLowerCase(), rememberMe: true, name: signupName }))
    } else {
      localStorage.removeItem('agentforge-session-v1')
    }
    navigate('/dashboard')
  }

  function handleResetSubmit(e) {
    e.preventDefault()
    if (!resetEmail.trim()) return
    resetPassword(resetEmail)
    setAuthMode('login')
    setEmail(resetEmail)
  }

  async function handleConfirmReset(e) {
    e.preventDefault()
    if (!resetToken || newPassword.length < 6) return
    try {
      await confirmPasswordReset(resetToken, newPassword)
      setSessionStatus('Password reset successfully. You can now log in.')
      setNewPassword('')
      setResetToken('')
      window.history.replaceState({}, '', '/login')
      setAuthMode('login')
    } catch (error) {
      setSessionStatus(error.message)
    }
  }

  function renderHeader() {
    if (authMode === 'login') {
      return (
        <>
          <h2 className="text-2xl font-semibold text-ink">Log in to your account</h2>
          <p className="text-sm text-ink-soft mt-1.5">
            Enter your details to access your workspace.
          </p>
        </>
      )
    }

    if (authMode === 'signup') {
      return (
        <>
          <h2 className="text-2xl font-semibold text-ink">Create your account</h2>
          <p className="text-sm text-ink-soft mt-1.5">
            Start building automations with AgentForge.
          </p>
        </>
      )
    }

    if (authMode === 'reset') {
      return (
        <>
          <h2 className="text-2xl font-semibold text-ink">Choose a new password</h2>
          <p className="text-sm text-ink-soft mt-1.5">Use a new password for your AgentForge account.</p>
        </>
      )
    }

    return (
      <>
        <h2 className="text-2xl font-semibold text-ink">Reset your password</h2>
        <p className="text-sm text-ink-soft mt-1.5">
          We&apos;ll send a secure reset link to your email.
        </p>
      </>
    )
  }

  function renderForm() {
    if (authMode === 'signup') {
      return (
        <div className="mt-7">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-control border border-border bg-surface text-ink text-sm font-medium hover:bg-canvas transition-colors shadow-sm disabled:opacity-60"
          >
            {googleLoading ? <Loader2 size={16} className="animate-spin text-primary" /> : <GoogleIcon />}
            <span>{googleLoading ? 'Connecting to Google…' : 'Sign up with Google'}</span>
          </button>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-surface px-2 text-ink-faint">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSignupSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-ink-soft">Full name</label>
              <input
                type="text"
                required
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                placeholder="Ada Lovelace"
                className="mt-1.5 w-full px-3.5 py-2.5 text-sm rounded-control border border-border bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink-soft">Email</label>
              <input
                type="email"
                required
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1.5 w-full px-3.5 py-2.5 text-sm rounded-control border border-border bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink-soft">Password</label>
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Create a password"
                  className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-control border border-border bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-soft"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-ink-soft">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="accent-primary w-4 h-4"
              />
              Remember me on this device
            </label>

            <button
              type="submit"
              className="w-full py-2.5 rounded-control bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              Create account
            </button>
          </form>
        </div>
      )
    }

    if (authMode === 'forgot') {
      return (
        <form onSubmit={handleResetSubmit} className="mt-7 space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-soft">Email address</label>
            <input
              type="email"
              required
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5 w-full px-3.5 py-2.5 text-sm rounded-control border border-border bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-control bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            Send reset link
          </button>
        </form>
      )
    }

    if (authMode === 'reset') {
      return (
        <form onSubmit={handleConfirmReset} className="mt-7 space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-soft">New password</label>
            <input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Create a new password" className="mt-1.5 w-full px-3.5 py-2.5 text-sm rounded-control border border-border bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
          <button type="submit" className="w-full py-2.5 rounded-control bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">Reset password</button>
        </form>
      )
    }

    return (
      <div className="mt-7">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-control border border-border bg-surface text-ink text-sm font-medium hover:bg-canvas transition-colors shadow-sm disabled:opacity-60"
        >
          {googleLoading ? <Loader2 size={16} className="animate-spin text-primary" /> : <GoogleIcon />}
          <span>{googleLoading ? 'Connecting to Google…' : 'Sign in with Google'}</span>
        </button>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-surface px-2 text-ink-faint">Or continue with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-soft">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5 w-full px-3.5 py-2.5 text-sm rounded-control border border-border bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-ink-soft">Password</label>
              <button
                type="button"
                onClick={() => setAuthMode('forgot')}
                className="text-xs font-medium text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative mt-1.5">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-control border border-border bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-soft"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-ink-soft">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="accent-primary w-4 h-4"
            />
            Remember me
          </label>

          <button
            type="submit"
            className="w-full py-2.5 rounded-control bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            Log in
          </button>
        </form>
      </div>
    )
  }

  function renderFooter() {
    if (authMode === 'login') {
      return (
        <p className="text-xs text-ink-soft text-center mt-6">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={() => setAuthMode('signup')}
            className="text-primary font-medium hover:underline"
          >
            Sign up
          </button>
        </p>
      )
    }

    return (
      <p className="text-xs text-ink-soft text-center mt-6">
        <button
          type="button"
          onClick={() => setAuthMode('login')}
          className="inline-flex items-center gap-2 text-primary font-medium hover:underline"
        >
          <ArrowLeft size={14} />
          Back to login
        </button>
      </p>
    )
  }

  const activeMessage = errorMessage || lastError || sessionStatus

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-primary to-secondary text-white p-12 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/10" />

        <div className="relative flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="font-semibold text-lg">AgentForge</span>
        </div>

        <div className="relative">
          <h1 className="text-3xl font-semibold leading-snug">
            Welcome to AgentForge
          </h1>
          <p className="text-white/85 text-sm mt-3 max-w-sm leading-relaxed">
            Build AI agents without writing a line of code. Describe what you
            want to automate, and AgentForge turns it into a working,
            visual workflow in seconds.
          </p>

          <div className="mt-8 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <Icon size={15} />
                </div>
                <p className="text-sm text-white/90">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/60">
          © {new Date().getFullYear()} AgentForge.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 bg-surface">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 md:hidden">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="font-semibold text-lg text-ink">AgentForge</span>
          </div>

          {activeMessage && (
            <div
              className={`mb-4 rounded-control border px-3 py-2 text-xs font-medium ${
                errorMessage || lastError
                  ? 'border-danger/30 bg-danger-light text-danger'
                  : 'border-success/30 bg-success-light text-success'
              }`}
            >
              {activeMessage}
            </div>
          )}
          {renderHeader()}
          {renderForm()}
          {renderFooter()}
        </div>
      </div>
    </div>
  )
}
