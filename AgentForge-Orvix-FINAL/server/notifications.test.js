import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  extractDestinationFromPrompt,
  isValidEmail,
  normalizePhoneNumber,
  resolveChannel,
  resolveRecipient,
  validateDestination,
} from '../src/utils/notify.js'

describe('notification recipients', () => {
  it('accepts real addresses and rejects malformed ones', () => {
    expect(isValidEmail('sahil@vesit.ac.in')).toBe(true)
    expect(isValidEmail('sahil+agent@example.co.uk')).toBe(true)
    expect(isValidEmail('sahil@example')).toBe(false)
    expect(isValidEmail('not an email')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })

  it('normalises phone numbers to E.164 and rejects junk', () => {
    expect(normalizePhoneNumber('+91 98765 43210')).toBe('+919876543210')
    expect(normalizePhoneNumber('+1 (415) 555-0132')).toBe('+14155550132')
    expect(normalizePhoneNumber('009198765 43210')).toBe('+919876543210')
    // No country code: we refuse rather than guess which country to text.
    expect(normalizePhoneNumber('9876543210')).toBeNull()
    expect(normalizePhoneNumber('12345')).toBeNull()
    expect(normalizePhoneNumber('call me')).toBeNull()
  })

  it('falls back to the account email only for the email channel', () => {
    const user = { email: 'owner@example.com' }
    expect(resolveRecipient({ node: { data: {} }, user, channel: 'email' })).toMatchObject({ ok: true, to: 'owner@example.com', usedFallback: true })
    expect(resolveRecipient({ node: { data: {} }, user, channel: 'slack' }).ok).toBe(false)
    expect(resolveRecipient({ node: { data: {} }, user, channel: 'sms' }).ok).toBe(false)
  })

  it('prefers the address typed on the node over the account address', () => {
    const result = resolveRecipient({ node: { data: { destination: 'alerts@team.io' } }, user: { email: 'owner@example.com' }, channel: 'email' })
    expect(result).toMatchObject({ ok: true, to: 'alerts@team.io', usedFallback: false })
  })

  it('rejects an email address used as a Slack webhook', () => {
    const result = resolveRecipient({ node: { data: { destination: 'owner@example.com' } }, user: null, channel: 'slack' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/hooks\.slack\.com/)
  })

  it('only picks SMS when the prompt actually carries a number', () => {
    expect(resolveChannel(undefined, 'text me on my phone when revenue drops')).toBe('email')
    expect(resolveChannel(undefined, 'text me at +91 98765 43210 when revenue drops')).toBe('sms')
    expect(resolveChannel(undefined, 'post it to slack')).toBe('slack')
    expect(resolveChannel('slack', 'text me at +91 98765 43210')).toBe('slack')
  })

  it('pulls the recipient out of the prompt', () => {
    expect(extractDestinationFromPrompt('summarise my inbox and email me at sahil@vesit.ac.in', 'email')).toBe('sahil@vesit.ac.in')
    expect(extractDestinationFromPrompt('text me at +91 98765 43210', 'sms')).toBe('+919876543210')
    expect(extractDestinationFromPrompt('just summarise my inbox', 'email')).toBe('')
  })

  it('treats a blank email destination as valid but a blank phone as an error', () => {
    expect(validateDestination('email', '').ok).toBe(true)
    expect(validateDestination('sms', '').ok).toBe(false)
    expect(validateDestination('email', 'broken@').ok).toBe(false)
  })
})

describe('notification delivery', () => {
  const sendWorkflowEmail = vi.fn()
  const sendSlackWebhook = vi.fn()
  const sendSms = vi.fn()

  vi.doMock('./mailer.js', () => ({ sendWorkflowEmail }))
  vi.doMock('./integrations.js', () => ({ sendSlackWebhook }))
  vi.doMock('./sms.js', () => ({ sendSms }))

  let deliverNotification

  beforeEach(async () => {
    vi.resetModules()
    sendWorkflowEmail.mockReset().mockResolvedValue({ delivered: true, simulated: false, error: null })
    sendSlackWebhook.mockReset().mockResolvedValue({ delivered: true, simulated: false, error: null })
    sendSms.mockReset().mockResolvedValue({ delivered: true, simulated: false, error: null })
    ;({ deliverNotification } = await import('./notifications.js'))
  })

  it('derives an email subject from the workflow topic instead of using a random generic subject', async () => {
    await deliverNotification({
      node: { data: { kind: 'output', channel: 'email', destination: 'alerts@team.io' } },
      user: { email: 'owner@example.com' },
      workflow: { name: 'Customer Agent', prompt: 'Analyze delayed shipment complaints and email me the findings.' },
      input: { message: 'Customer reports a shipment is delayed by three days.' },
      output: 'Delayed shipment complaint detected.',
    })
    expect(sendWorkflowEmail).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'Analysis — delayed shipment complaints',
    }))
  })

  it('derives inbox subjects from processed message counts', async () => {
    await deliverNotification({
      node: { data: { kind: 'output', channel: 'email', destination: 'alerts@team.io' } },
      user: { email: 'owner@example.com' },
      workflow: { name: 'Email Automation Agent', prompt: 'Summarize my inbox and email me.' },
      input: 'summarize my inbox',
      output: 'INBOX SUMMARY\nMessages processed: 3\n\nEMAIL DETAILS\n1. Subject: Action required — reporting API latency',
    })
    expect(sendWorkflowEmail).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'Inbox Summary — 3 messages',
    }))
  })

  it('sends to the address configured on the node', async () => {
    const result = await deliverNotification({
      node: { data: { kind: 'output', channel: 'email', destination: 'alerts@team.io' } },
      user: { email: 'owner@example.com' },
      workflow: { name: 'Sales Monitor' },
      output: 'Revenue fell 12%',
    })
    expect(sendWorkflowEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'alerts@team.io' }))
    expect(result).toMatchObject({ delivered: true, channel: 'email', to: 'alerts@team.io' })
  })

  it('returns an error instead of delivering to an invalid recipient', async () => {
    const result = await deliverNotification({
      node: { data: { kind: 'output', channel: 'email', destination: 'nope' } },
      user: { email: 'owner@example.com' },
      workflow: { name: 'Sales Monitor' },
      output: 'x',
    })
    expect(sendWorkflowEmail).not.toHaveBeenCalled()
    expect(result.delivered).toBe(false)
    expect(result.error).toMatch(/not a valid email address/)
  })

  it('routes an SMS node to the SMS provider', async () => {
    const result = await deliverNotification({
      node: { data: { kind: 'output', channel: 'sms', destination: '+91 98765 43210' } },
      user: { email: 'owner@example.com' },
      workflow: { name: 'Sales Monitor' },
      output: 'Revenue fell 12%',
    })
    expect(sendSms).toHaveBeenCalledWith(expect.objectContaining({ to: '+919876543210' }))
    expect(result).toMatchObject({ channel: 'sms', delivered: true })
  })
})
