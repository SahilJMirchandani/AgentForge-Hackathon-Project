import { describe, it, expect } from 'vitest'
import { googleConfigured, googleAuthLoginUrl, googleAuthLoginRedirectUri } from './oauth.js'

describe('Google OAuth Auth Helpers', () => {
  it('returns false for googleConfigured when env vars are missing', () => {
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    expect(googleConfigured()).toBe(false)
  })

  it('constructs correct redirect URI for Google Auth', () => {
    const redirectUri = googleAuthLoginRedirectUri()
    expect(redirectUri).toContain('/api/auth/google/callback')
  })

  it('generates valid googleAuthLoginUrl when configured', () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
    expect(googleConfigured()).toBe(true)

    const url = googleAuthLoginUrl('test-state-123')
    expect(url).toContain('accounts.google.com')
    expect(url).toContain('client_id=test-client-id.apps.googleusercontent.com')
    expect(url).toContain('state=test-state-123')
    expect(url).toContain('scope=openid+email+profile')
  })
})
