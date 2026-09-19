const buckets = new Map()
const MAX_BUCKETS = 10000

export function clientAddress(req) {
  if (process.env.TRUST_PROXY === 'true') return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown'
  return req.socket.remoteAddress || 'unknown'
}

export function rateLimit({ windowMs = 60000, max = 60, key = clientAddress } = {}) {
  return (req, res) => {
    const now = Date.now()
    const path = req.url?.split('?')[0] || ''
    const bucketPath = path.startsWith('/api/hooks/') ? '/api/hooks/:token' : path
    const bucketKey = `${key(req)}:${bucketPath}`
    const current = buckets.get(bucketKey)
    if (!current || current.resetAt <= now) {
      if (buckets.size >= MAX_BUCKETS) {
        for (const [existingKey, bucket] of buckets) {
          if (bucket.resetAt <= now) buckets.delete(existingKey)
          if (buckets.size < MAX_BUCKETS) break
        }
      }
      buckets.set(bucketKey, { count: 1, resetAt: now + windowMs })
      return true
    }
    current.count += 1
    if (current.count <= max) return true
    const retryAfter = Math.ceil((current.resetAt - now) / 1000)
    res.writeHead(429, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'retry-after': String(retryAfter) })
    res.end(JSON.stringify({ error: 'Too many requests. Please try again later.' }))
    return false
  }
}

export function clearRateLimitBuckets() {
  buckets.clear()
}
