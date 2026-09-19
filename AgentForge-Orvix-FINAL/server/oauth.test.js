import { afterEach, describe, expect, it, vi } from 'vitest'

const PLACEHOLDER = {
  GOOGLE_CLIENT_ID: 'your-google-client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'your-google-client-secret',
}

async function loadOauth(env) {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  return import('./oauth.js')
}

afterEach(() => vi.unstubAllEnvs())

describe('Google OAuth demo mode', () => {
  it('is off by default, so placeholder credentials cannot mint a session', async () => {
    const { isDemoClient, googleConfigured } = await loadOauth({ ...PLACEHOLDER, NODE_ENV: 'development', ALLOW_DEMO_OAUTH: '' })
    expect(isDemoClient()).toBe(false)
    expect(googleConfigured()).toBe(false)
  })

  it('can be opted into explicitly for local demos', async () => {
    const { isDemoClient, googleConfigured } = await loadOauth({ ...PLACEHOLDER, NODE_ENV: 'development', ALLOW_DEMO_OAUTH: 'true' })
    expect(isDemoClient()).toBe(true)
    expect(googleConfigured()).toBe(true)
  })

  it('can never be enabled in production', async () => {
    const { isDemoClient } = await loadOauth({ ...PLACEHOLDER, NODE_ENV: 'production', ALLOW_DEMO_OAUTH: 'true' })
    expect(isDemoClient()).toBe(false)
  })

  it('treats real credentials as configured', async () => {
    const { googleConfigured, isDemoClient } = await loadOauth({
      GOOGLE_CLIENT_ID: '1234.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'GOCSPX-real-secret',
      NODE_ENV: 'development',
      ALLOW_DEMO_OAUTH: '',
    })
    expect(googleConfigured()).toBe(true)
    expect(isDemoClient()).toBe(false)
  })
})
