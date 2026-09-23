import { existsSync, readFileSync } from 'node:fs'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'

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
    ? (process.env.API_PUBLIC_URL || process.env.APP_URL || '')
    : (process.env.APP_URL || 'http://localhost:5173')
  const appUrl = String(defaultAppUrl || '').replace(/\/$/, '')
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

export function googleAuthLoginUrl(state, { gmail = false, email = '', redirectUri = '' } = {}) {
  const { clientId } = config()
  if (!clientId) throw new Error('Google OAuth is not configured')
  const callbackUri = redirectUri || googleAuthLoginRedirectUri()
  if (isDemoClient()) return `${callbackUri}?state=${state}&code=demo_auth_code`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUri,
    response_type: 'code',
    scope: gmail ? GMAIL_READONLY_SCOPE : 'openid email profile',
    state,
    access_type: 'offline',
    include_granted_scopes: 'false',
    ...(gmail ? {} : (String(email || '').trim() ? { login_hint: String(email).trim() } : {})),
    prompt: gmail ? 'consent select_account' : 'select_account',
  })
  return `${GOOGLE_AUTH_URL}?${params}`
}

export async function exchangeGoogleAuthCode(code, redirectUriOverride = '') {
  if (isDemoClient() || code === 'demo_auth_code') {
    return { access_token: 'demo_access_token', token_type: 'Bearer', expires_in: 3600 }
  }
  const { clientId, clientSecret } = config()
  const redirectUri = redirectUriOverride || googleAuthLoginRedirectUri()
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

export async function refreshGoogleAccessToken(refreshToken) {
  if (!refreshToken) throw new Error('Google Gmail authorization is missing. Sign in with Google again to connect Gmail.')
  if (isDemoClient()) return { access_token: 'demo_access_token', token_type: 'Bearer', expires_in: 3600 }
  const { clientId, clientSecret } = config()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  let response
  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      signal: controller.signal,
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    let providerError = ''
    let providerDescription = ''
    try {
      const payload = JSON.parse(detail)
      providerError = payload?.error || ''
      providerDescription = payload?.error_description || ''
    } catch {}
    const error = new Error(
      response.status === 400 && providerError === 'invalid_grant'
        ? 'Google Gmail authorization has expired or been revoked. Please use Reconnect Gmail in Settings.'
        : `Google token refresh failed (${response.status})${providerDescription ? `: ${providerDescription}` : ''}`,
    )
    error.status = response.status
    error.providerError = providerError
    throw error
  }
  const token = await response.json()
  if (!token.access_token) throw new Error('Google did not return a refreshed access token')
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


export async function validateGmailAccessToken(accessToken) {
  if (!accessToken) throw new Error('Gmail authorization is missing. Connect Gmail again.')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  let response
  try {
    response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    let providerMessage = ''
    try {
      const payload = JSON.parse(detail)
      providerMessage = payload?.error?.message || payload?.error?.status || ''
    } catch {}
    const error = new Error(
      response.status === 401
        ? 'Google returned an invalid Gmail access token. Please connect Gmail again.'
        : response.status === 403
          ? `Google did not grant Gmail read access to this token${providerMessage ? ` (${providerMessage})` : ''}. Please reconnect Gmail and allow the requested permission.`
          : `Gmail authorization check failed (${response.status})`,
    )
    error.status = response.status
    throw error
  }
  return true
}
