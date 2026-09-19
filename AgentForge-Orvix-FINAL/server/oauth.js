import { existsSync, readFileSync } from 'node:fs'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

function loadEnvFile() {
  try {
    if (existsSync('.env')) {
      const content = readFileSync('.env', 'utf8')
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim()
          const val = trimmed.slice(eqIdx + 1).trim()
          if (key && !process.env[key]) process.env[key] = val
        }
      }
    }
  } catch {}
}
loadEnvFile()

function config() {
  const defaultAppUrl = process.env.NODE_ENV === 'production'
    ? `http://127.0.0.1:${process.env.PORT || 4000}`
    : 'http://localhost:5173'
  const appUrl = (process.env.APP_URL || defaultAppUrl).replace(/\/$/, '')
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_AUTH_REDIRECT_URI || `${appUrl}/api/auth/google/callback`,
  }
}

export function hasPlaceholderCredentials() {
  const { clientId, clientSecret } = config()
  const id = String(clientId || '').toLowerCase()
  const secret = String(clientSecret || '').toLowerCase()
  return id.startsWith('your-google-client-id') || id === 'placeholder' || secret.startsWith('your-google-client-secret')
}

export function isDemoClient() {
  if (process.env.NODE_ENV === 'production') return false
  if (process.env.ALLOW_DEMO_OAUTH !== 'true') return false
  const { clientId, clientSecret } = config()
  if (!clientId || !clientSecret) return false
  const id = String(clientId).toLowerCase()
  const secret = String(clientSecret).toLowerCase()
  return (
    id.startsWith('your-google-client-id') ||
    id.startsWith('demo-client-id') ||
    id === 'placeholder' ||
    secret.startsWith('your-google-client-secret') ||
    secret.startsWith('demo-client-secret')
  )
}

export function googleConfigured() {
  const { clientId, clientSecret } = config()
  return Boolean(clientId && clientSecret) && (!hasPlaceholderCredentials() || isDemoClient())
}

export function googleAuthLoginRedirectUri() {
  const { redirectUri } = config()
  return redirectUri
}

export function googleAuthLoginUrl(state) {
  const { clientId } = config()
  if (!clientId) throw new Error('Google OAuth is not configured')
  const redirectUri = googleAuthLoginRedirectUri()
  if (isDemoClient()) return `${redirectUri}?state=${state}&code=demo_auth_code`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  return `${GOOGLE_AUTH_URL}?${params}`
}

export async function exchangeGoogleAuthCode(code) {
  if (isDemoClient() || code === 'demo_auth_code') {
    return { access_token: 'demo_access_token', token_type: 'Bearer', expires_in: 3600 }
  }
  const { clientId, clientSecret } = config()
  const redirectUri = googleAuthLoginRedirectUri()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  let response
  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      signal: controller.signal,
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok) throw new Error(`Google token exchange failed (${response.status})`)
  const token = await response.json()
  if (!token.access_token) throw new Error('Google did not return an access token')
  return token
}

export async function fetchGoogleUserInfo(accessToken) {
  if (isDemoClient() || accessToken === 'demo_access_token') {
    return {
      id: 'google-demo-user-123',
      email: 'demo.user@gmail.com',
      name: 'Demo Google User',
      picture: null,
      verified_email: true,
    }
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  let response
  try {
    response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok) throw new Error(`Failed to fetch Google user profile (${response.status})`)
  const profile = await response.json()
  if (!profile.email) throw new Error('Google user profile did not contain an email address')
  return {
    id: profile.id || profile.sub,
    email: profile.email,
    name: profile.name || profile.given_name || profile.email.split('@')[0],
    picture: profile.picture || null,
    verified_email: profile.verified_email === true,
  }
}
