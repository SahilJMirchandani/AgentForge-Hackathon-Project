const TWILIO_API = 'https://api.twilio.com/2010-04-01/Accounts'

function getConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.TWILIO_FROM_NUMBER || '',
  }
}

export function smsStatus() {
  const { accountSid, authToken, from } = getConfig()
  return { configured: Boolean(accountSid && authToken && from), from: from || null }
}

/**
 * Sends an SMS through Twilio. Without credentials it logs the message and
 * reports `simulated: true` so the caller can tell the user the truth rather
 * than claiming a delivery that never left the machine.
 */
export async function sendSms({ to, body }) {
  const { accountSid, authToken, from } = getConfig()
  const text = String(body ?? '').slice(0, 1200)

  if (!accountSid || !authToken || !from) {
    console.log(`[Dev SMS] Simulated SMS to ${to}: ${text}`)
    return { delivered: false, simulated: true, error: null }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`${TWILIO_API}/${encodeURIComponent(accountSid)}/Messages.json`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: text }).toString(),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      let message = `SMS provider returned ${response.status}`
      try { message = JSON.parse(detail).message || message } catch {}
      return { delivered: false, simulated: false, error: message }
    }
    return { delivered: true, simulated: false, error: null }
  } catch (error) {
    const message = error.name === 'AbortError' ? 'SMS provider timed out' : error.message || 'SMS delivery failed'
    return { delivered: false, simulated: false, error: message }
  } finally {
    clearTimeout(timeout)
  }
}
