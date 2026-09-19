import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
const GOOGLE_OAUTH_TIMEOUT_MS = 10000

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
          if (key && !process.env[key]) {
            process.env[key] = val
          }
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

  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${(process.env.APP_URL || defaultAppUrl).replace(/\/$/, '')}/api/integrations/google/callback`,
  }
}

function encryptionKey() {
  if (process.env.NODE_ENV === 'production' && !process.env.OAUTH_ENCRYPTION_KEY) throw new Error('OAUTH_ENCRYPTION_KEY is required in production')
  return createHash('sha256').update(process.env.OAUTH_ENCRYPTION_KEY || 'agentforge-development-key').digest()
}

export function protect(value) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`
}

export function unprotect(value) {
  if (!value) return null
  try {
    const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64url'))
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

export function googleConfigured() {
  const { clientId, clientSecret } = config()
  if (!clientId || !clientSecret) return false
  // Placeholder values are only "configured" while demo mode is explicitly on.
  return !hasPlaceholderCredentials() || isDemoClient()
}

/**
 * Detects the placeholder credentials shipped in .env.example.
 *
 * Demo mode short-circuits the whole OAuth handshake and hands back a session
 * for demo.user@gmail.com without contacting Google, so anyone who can reach
 * "Sign in with Google" gets an authenticated account. That is fine as a local
 * demo and catastrophic anywhere else, so it is now off unless the operator
 * explicitly opts in with ALLOW_DEMO_OAUTH=true, and it can never be enabled
 * in production.
 */
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

/** True when GOOGLE_CLIENT_ID/SECRET are still the .env.example placeholders. */
export function hasPlaceholderCredentials() {
  const { clientId, clientSecret } = config()
  const id = String(clientId || '').toLowerCase()
  const secret = String(clientSecret || '').toLowerCase()
  return id.startsWith('your-google-client-id') || id === 'placeholder' || secret.startsWith('your-google-client-secret')
}

export function googleAuthorizationUrl(state) {
  const { clientId, redirectUri } = config()
  if (!clientId) throw new Error('Google OAuth is not configured')
  if (isDemoClient()) {
    return `${redirectUri}?state=${state}&code=demo_integration_code`
  }
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', access_type: 'offline', prompt: 'consent', scope: GOOGLE_SCOPE, state })
  return `${GOOGLE_AUTH_URL}?${params}`
}

export async function exchangeGoogleCode(code) {
  if (isDemoClient() || code === 'demo_integration_code') {
    return {
      accessToken: protect('demo_gmail_access_token'),
      refreshToken: protect('demo_gmail_refresh_token'),
      expiresAt: Date.now() + 3600 * 1000,
    }
  }
  const { clientId, clientSecret, redirectUri } = config()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GOOGLE_OAUTH_TIMEOUT_MS)
  let response
  try { response = await fetch(GOOGLE_TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: controller.signal, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }) }) } finally { clearTimeout(timeout) }
  if (!response.ok) throw new Error(`Google token exchange failed (${response.status})`)
  const token = await response.json()
  if (!token.access_token) throw new Error('Google did not return an access token')
  return { accessToken: protect(token.access_token), refreshToken: token.refresh_token ? protect(token.refresh_token) : null, expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000 }
}

export async function refreshGoogleAccessToken(user) {
  const refreshToken = unprotect(user?.googleOAuth?.refreshToken)
  if (isDemoClient() || refreshToken === 'demo_gmail_refresh_token') {
    const newToken = 'demo_gmail_access_token'
    user.googleOAuth.accessToken = protect(newToken)
    user.googleOAuth.expiresAt = Date.now() + 3600 * 1000
    return newToken
  }
  if (!refreshToken) throw new Error('Google authorization has expired. Reconnect Google Gmail.')
  const { clientId, clientSecret } = config()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  let response
  try { response = await fetch(GOOGLE_TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: controller.signal, body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }) }) } finally { clearTimeout(timeout) }
  if (!response.ok) throw new Error('Google authorization has expired. Reconnect Google Gmail.')
  const token = await response.json()
  if (!token.access_token) throw new Error('Google did not return a refreshed access token')
  user.googleOAuth.accessToken = protect(token.access_token)
  user.googleOAuth.expiresAt = Date.now() + Number(token.expires_in || 3600) * 1000
  return token.access_token
}

export function googleAuthLoginRedirectUri() {
  const defaultAppUrl = process.env.NODE_ENV === 'production'
    ? `http://127.0.0.1:${process.env.PORT || 4000}`
    : 'http://localhost:5173'
  const appUrl = (process.env.APP_URL || defaultAppUrl).replace(/\/$/, '')
  return process.env.GOOGLE_AUTH_REDIRECT_URI || `${appUrl}/api/auth/google/callback`
}

export function googleAuthLoginUrl(state) {
  const { clientId } = config()
  if (!clientId) throw new Error('Google OAuth is not configured')
  const redirectUri = googleAuthLoginRedirectUri()
  if (isDemoClient()) {
    return `${redirectUri}?state=${state}&code=demo_auth_code`
  }
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

export async function accessTokenFor(user) {
  if (!user?.googleOAuth) return null
  if (user.googleOAuth.expiresAt && user.googleOAuth.expiresAt <= Date.now() + 60_000) return refreshGoogleAccessToken(user)
  return unprotect(user.googleOAuth.accessToken)
}