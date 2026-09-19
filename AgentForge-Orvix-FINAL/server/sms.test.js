import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TWILIO = { TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'secret', TWILIO_FROM_NUMBER: '+17372508034' }

async function loadSms(env = {}) {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  return import('./sms.js')
}

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('SMS delivery', () => {
  it('reports simulated rather than delivered when Twilio is not configured', async () => {
    const { sendSms, smsStatus } = await loadSms({ TWILIO_ACCOUNT_SID: '', TWILIO_AUTH_TOKEN: '', TWILIO_FROM_NUMBER: '' })
    expect(smsStatus().configured).toBe(false)
    await expect(sendSms({ to: '+919876543210', body: 'hi' })).resolves.toMatchObject({ delivered: false, simulated: true })
  })

  it('posts a form-encoded message to Twilio with basic auth', async () => {
    const { sendSms } = await loadSms(TWILIO)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, text: async () => '' })
    const result = await sendSms({ to: '+919876543210', body: 'Revenue fell 12%' })

    expect(result).toMatchObject({ delivered: true, simulated: false })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/Accounts/AC123/Messages.json')
    expect(options.headers.authorization).toBe(`Basic ${Buffer.from('AC123:secret').toString('base64')}`)
    const body = new URLSearchParams(options.body)
    expect(body.get('To')).toBe('+919876543210')
    expect(body.get('From')).toBe('+17372508034')
    expect(body.get('Body')).toBe('Revenue fell 12%')
  })

  it('surfaces the provider error instead of claiming delivery', async () => {
    const { sendSms } = await loadSms(TWILIO)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 400, text: async () => JSON.stringify({ message: 'The From number is not a valid phone number' }) })
    await expect(sendSms({ to: '+919876543210', body: 'hi' })).resolves.toMatchObject({
      delivered: false,
      simulated: false,
      error: 'The From number is not a valid phone number',
    })
  })
})
