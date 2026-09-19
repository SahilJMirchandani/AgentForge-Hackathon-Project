export function resolveAllowedOrigins(rawOrigins) {
  const value = String(rawOrigins || '').trim()
  if (!value) return []

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      try {
        const parsed = new URL(origin)
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash) return null
        return parsed.origin
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

export function getAppConfig() {
  const environment = process.env.NODE_ENV || 'development'
  const port = Number(process.env.PORT || 4000)
  const host = process.env.HOST || '127.0.0.1'
  const publicApiOrigin = String(process.env.API_PUBLIC_URL || '').trim().replace(/\/$/, '')
  const allowedOrigins = resolveAllowedOrigins([process.env.CLIENT_ORIGIN, process.env.ALLOWED_ORIGINS].filter(Boolean).join(','))
  if (!allowedOrigins.length) allowedOrigins.push('http://localhost:5173')
  if (environment === 'production') {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required in production')
    if (!process.env.OAUTH_ENCRYPTION_KEY) throw new Error('OAUTH_ENCRYPTION_KEY is required in production')
    if (allowedOrigins.some((origin) => !origin.startsWith('https://'))) throw new Error('Production allowed origins must use HTTPS')
  }

  return {
    environment,
    host,
    publicApiOrigin,
    port,
    allowedOrigins,
    trustProxy: process.env.TRUST_PROXY === 'true',
  }
}
