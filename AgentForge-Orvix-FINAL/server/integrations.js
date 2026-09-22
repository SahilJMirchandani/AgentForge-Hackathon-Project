export async function sendSlackWebhook({ webhookUrl, text }) {
  const url = String(webhookUrl || '').trim()

  if (!url || !url.startsWith('http')) {
    console.log(`[Dev Slack] Simulated Slack notification to channel "${url || '#general'}": ${text}`)
    return { delivered: false, simulated: true, error: null }
  }

  let parsed
  try { parsed = new URL(url) } catch { throw new Error('Slack webhook URL is invalid') }
  if (parsed.protocol !== 'https:' || (!parsed.hostname.endsWith('slack.com') && parsed.hostname !== 'hooks.slack.com')) {
    throw new Error('Only Slack HTTPS webhook URLs are allowed')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(parsed, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ text: String(text).slice(0, 4000) }),
    })
    if (!response.ok) {
      console.warn(`[Dev Slack Warning] Slack delivery returned status ${response.status}`)
      return { delivered: false, simulated: false, error: `Slack returned ${response.status}` }
    }
    return { delivered: true, simulated: false, error: null }
  } catch (error) {
    if (error.message?.includes('Slack HTTPS') || error.message?.includes('invalid')) throw error
    console.warn(`[Dev Slack Warning] Slack delivery error: ${error.message}`)
    return { delivered: false, simulated: false, error: error.message || 'Slack delivery failed' }
  } finally {
    clearTimeout(timeout)
  }
}

function decodeGmailBody(data = '') {
  if (!data) return ''
  try { return Buffer.from(String(data).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8') } catch { return '' }
}

function htmlToText(html = '') {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>(?=.)/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractGmailBody(payload) {
  if (!payload) return ''
  const mime = String(payload.mimeType || '').toLowerCase()
  const direct = decodeGmailBody(payload.body?.data)
  if (direct) return mime === 'text/html' ? htmlToText(direct) : direct.trim()
  const parts = Array.isArray(payload.parts) ? payload.parts : []
  const plain = parts.find((part) => String(part.mimeType || '').toLowerCase() === 'text/plain')
  if (plain) {
    const text = extractGmailBody(plain)
    if (text) return text
  }
  const html = parts.find((part) => String(part.mimeType || '').toLowerCase() === 'text/html')
  if (html) return extractGmailBody(html)
  for (const part of parts) {
    const text = extractGmailBody(part)
    if (text) return text
  }
  return ''
}

export async function fetchGmailMessages(accessToken, limit = 10) {
  if (!accessToken) throw new Error('Connect Google Gmail before running an email agent')
  const fetchGmail = async (url) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try { return await fetch(url, { headers: { authorization: `Bearer ${accessToken}` }, signal: controller.signal }) } finally { clearTimeout(timeout) }
  }
  const response = await fetchGmail(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${Math.min(20, Math.max(1, limit))}&q=is%3Aunread`)
  if (!response.ok) throw new Error(`Gmail request failed (${response.status})`)
  const listing = await response.json()
  const messages = await Promise.all((listing.messages || []).slice(0, limit).map(async ({ id }) => {
    const messageResponse = await fetchGmail(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`)
    if (!messageResponse.ok) throw new Error(`Gmail message request failed (${messageResponse.status})`)
    const message = await messageResponse.json()
    return { id: message.id, snippet: message.snippet || '', body: extractGmailBody(message.payload) || message.snippet || '', headers: message.payload?.headers || [] }
  }))
  return messages
}