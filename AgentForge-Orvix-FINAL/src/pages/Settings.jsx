import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'

export default function Settings() {
  const userName = useAppStore((s) => s.userName)
  const userEmail = useAppStore((s) => s.userEmail)
  const logout = useAppStore((s) => s.logout)
  const updateProfile = useAppStore((s) => s.updateProfile)
  const clearSavedSession = useAppStore((s) => s.clearSavedSession)
  const emailNotifications = useAppStore((s) => s.emailNotifications)
  const setEmailNotifications = useAppStore((s) => s.setEmailNotifications)
  const navigate = useNavigate()
  const [savedLoginStatus, setSavedLoginStatus] = useState('')
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [nameDraft, setNameDraft] = useState(userName)
  const [emailDraft, setEmailDraft] = useState(userEmail)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingNotifications, setSavingNotifications] = useState(false)
  async function handleSaveProfile() {
    setSavingProfile(true)
    const saved = await updateProfile(nameDraft, emailDraft)
    setSavingProfile(false)
    if (saved) setIsEditingProfile(false)
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function handleForgetSavedLogin() {
    clearSavedSession()
    setSavedLoginStatus('Saved login cleared. You have been signed out.')
    navigate('/login', { replace: true })
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-ink">Settings</h1>
      <p className="text-sm text-ink-soft mt-1">Manage your account and preferences.</p>

      <div className="bg-surface border border-border rounded-card shadow-card p-6 mt-6 space-y-5">
        {savedLoginStatus && <div className="rounded-control border border-success/30 bg-success-light px-3 py-2 text-xs text-success font-medium">
          {savedLoginStatus}
        </div>}
        {!isEditingProfile ? (
          <>
            <div>
              <p className="text-xs font-medium text-ink-soft">Profile</p>
              <p className="mt-2 text-lg font-semibold text-ink">{userName}</p>
              <p className="text-sm text-ink-soft">{userEmail || 'No email saved'}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setNameDraft(userName)
                setEmailDraft(userEmail)
                setIsEditingProfile(true)
              }}
              className="px-4 py-2.5 rounded-control bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              Edit profile
            </button>
          </>
        ) : (
          <>
            <div>
              <label className="text-xs font-medium text-ink-soft">Display name</label>
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="mt-1.5 w-full px-3.5 py-2.5 text-sm rounded-control border border-border bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-soft">Email</label>
              <input
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                className="mt-1.5 w-full px-3.5 py-2.5 text-sm rounded-control border border-border bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="px-4 py-2.5 rounded-control bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
              >
                {savingProfile ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="px-4 py-2.5 rounded-control border border-border text-sm font-medium text-ink hover:bg-canvas transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        <div>
          <label className="text-xs font-medium text-ink-soft">In-app notifications</label>
          <div className="flex items-center gap-2 mt-1.5">
            <input
              type="checkbox"
              checked={emailNotifications}
              disabled={savingNotifications}
              onChange={async (e) => {
                setSavingNotifications(true)
                await setEmailNotifications(e.target.checked)
                setSavingNotifications(false)
              }}
              className="accent-primary w-4 h-4 disabled:opacity-50"
            />
            <span className="text-sm text-ink">Notify me when an agent finishes running</span>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-card shadow-card p-6 mt-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">Log out</p>
          <p className="text-xs text-ink-soft mt-0.5">Keep this account ready to sign back in automatically.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleForgetSavedLogin}
            className="px-4 py-2.5 rounded-control border border-border text-sm font-medium text-ink hover:bg-canvas transition-colors"
          >
            Forget saved login & sign out
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2.5 rounded-control border border-border text-sm font-medium text-danger hover:bg-danger-light transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}
