// Pure notification-target helpers. No Node-only imports live here, so the
// browser editor and the server executor validate recipients identically and
// the user never sees a destination accepted in the UI but rejected at run time.

export const NOTIFICATION_CHANNELS = ['email', 'slack', 'sms']

const EMAIL_PATTERN = /^[^\s@,;:<>()[\]\\]+@[^\s@,;:<>()[\]\\]+\.[A-Za-z]{2,}$/
// First address in free text, e.g. "notify me at sahil@vesit.ac.in".
const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
// E.164-ish: 8-15 digits, tolerating the spaces, dashes and parens people type.
const PHONE_IN_TEXT = /(?:\+|\b00)\d[\d\s().-]{6,17}\d/
const SLACK_IN_TEXT = /https:\/\/hooks\.slack\.com\/\S+/

export function isValidEmail(value) {
  const email = String(value ?? '').trim()
  return email.length > 0 && email.length <= 254 && EMAIL_PATTERN.test(email)
}

/**
 * Returns an E.164 string, or null when the value cannot be one.
 * A country code is required: without one we cannot tell "+1 415 555 0132"
 * from "+91 4155 550132", and guessing would quietly text the wrong country.
 */
export function normalizePhoneNumber(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const international = raw.startsWith('+') || raw.startsWith('00')
  if (!international) return null
  const digits = raw.replace(/^00/, '').replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) return null
  return `+${digits}`
}

export function isValidSlackWebhook(value) {
  const url = String(value ?? '').trim()
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && (parsed.hostname === 'hooks.slack.com' || parsed.hostname.endsWith('.slack.com'))
  } catch {
    return false
  }
}

/** Pulls an explicit recipient out of a natural-language prompt. */
export function extractDestinationFromPrompt(prompt, channel) {
  const text = String(prompt ?? '')
  if (channel === 'email') {
    const match = text.match(EMAIL_IN_TEXT)
    return match && isValidEmail(match[0]) ? match[0] : ''
  }
  if (channel === 'sms') {
    const match = text.match(PHONE_IN_TEXT)
    return (match && normalizePhoneNumber(match[0])) || ''
  }
  if (channel === 'slack') {
    const match = text.match(SLACK_IN_TEXT)
    return match && isValidSlackWebhook(match[0]) ? match[0] : ''
  }
  return ''
}

/**
 * Decides which channel a notification node uses. It prefers what the node
 * already declares, then infers from the prompt. SMS is only chosen when the
 * prompt actually carries a phone number, so an agent never lands on a channel
 * it has no recipient for — that used to make every "text me" prompt produce a
 * workflow that failed on its first run.
 */
export function resolveChannel(nodeChannel, prompt = '') {
  if (NOTIFICATION_CHANNELS.includes(nodeChannel)) return nodeChannel
  const text = String(prompt || '').toLowerCase()
  if (SLACK_IN_TEXT.test(text) || /\bslack\b/.test(text)) return 'slack'
  if (/\b(sms|text me|text message|whatsapp|phone|mobile)\b/.test(text) && PHONE_IN_TEXT.test(text)) return 'sms'
  return 'email'
}

/**
 * Works out who a notification node should reach.
 * Email falls back to the signed-in account address; Slack and SMS never do,
 * because an account email is neither a webhook URL nor a phone number.
 */
export function resolveRecipient({ node, user, channel, prompt = '' }) {
  const configured = String(node?.data?.destination ?? node?.destination ?? '').trim()

  if (channel === 'email') {
    const promptRecipient = extractDestinationFromPrompt(prompt, 'email')
    const candidate = configured || promptRecipient || String(user?.email || '').trim()
    if (!candidate) return { ok: false, error: 'No email address is configured for this notification step' }
    if (!isValidEmail(candidate)) return { ok: false, error: `"${candidate}" is not a valid email address` }
    return { ok: true, to: candidate, usedFallback: !configured }
  }

  if (channel === 'sms') {
    if (!configured) return { ok: false, error: 'Add a phone number to this notification step before running the agent' }
    const phone = normalizePhoneNumber(configured)
    if (!phone) return { ok: false, error: `"${configured}" is not a valid phone number. Use international format, e.g. +919876543210` }
    return { ok: true, to: phone, usedFallback: false }
  }

  if (channel === 'slack') {
    if (!configured) return { ok: false, error: 'Add a Slack webhook URL to this notification step before running the agent' }
    if (!isValidSlackWebhook(configured)) return { ok: false, error: 'Slack destinations must be an https://hooks.slack.com/... webhook URL' }
    return { ok: true, to: configured, usedFallback: false }
  }

  return { ok: false, error: `Unsupported notification channel "${channel}"` }
}

/** Validates a destination as typed in the editor. Empty email is allowed (falls back to the account). */
export function validateDestination(channel, value) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) {
    if (channel === 'email') return { ok: true, hint: 'Leave blank to use your registered account email.' }
    return { ok: false, error: channel === 'sms' ? 'A phone number is required for SMS notifications.' : 'A Slack webhook URL is required.' }
  }
  const result = resolveRecipient({ node: { data: { destination: trimmed } }, user: null, channel })
  return result.ok ? { ok: true, normalized: result.to } : { ok: false, error: result.error }
}
