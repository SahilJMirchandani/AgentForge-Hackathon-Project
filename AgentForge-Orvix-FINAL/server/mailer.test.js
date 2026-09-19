import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sendMail = vi.fn()
const createTransport = vi.fn(() => ({ sendMail }))

vi.mock('nodemailer', () => ({
  default: { createTransport },
}))

describe('workflow email delivery', () => {
  beforeEach(() => {
    vi.resetModules()
    sendMail.mockReset().mockResolvedValue({ messageId: '<test@agentforge>' })
    createTransport.mockClear()
    vi.stubEnv('SMTP_HOST', 'smtp.example.com')
    vi.stubEnv('SMTP_PORT', '587')
    vi.stubEnv('SMTP_SECURE', 'false')
    vi.stubEnv('SMTP_USER', 'agentforge@example.com')
    vi.stubEnv('SMTP_PASSWORD', 'test-password')
    vi.stubEnv('RESET_EMAIL_FROM', 'agentforge@example.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('sends the final workflow output as the email body', async () => {
    const { sendWorkflowEmail } = await import('./mailer.js')

    const result = await sendWorkflowEmail({
      to: 'user@example.com',
      subject: 'AgentForge — Sales Monitor Result',
      workflow: {
        name: 'Sales Monitor',
        results: [{ label: 'Agent output', value: 'Revenue fell 12% in the APAC region.' }],
      },
    })

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
    }))
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: 'agentforge@example.com',
      to: 'user@example.com',
      subject: 'AgentForge — Sales Monitor Result',
      text: expect.stringContaining('Revenue fell 12% in the APAC region.'),
      html: expect.stringContaining('Revenue fell 12% in the APAC region.'),
    }))
    expect(result).toEqual({ delivered: true, simulated: false, error: null })
  })

  it('reports simulation instead of claiming delivery when SMTP is not configured', async () => {
    vi.stubEnv('SMTP_HOST', '')
    vi.stubEnv('SMTP_USER', '')
    vi.stubEnv('SMTP_PASSWORD', '')
    const { sendWorkflowEmail } = await import('./mailer.js')

    const result = await sendWorkflowEmail({
      to: 'user@example.com',
      workflow: {
        name: 'Test Agent',
        results: [{ label: 'Agent output', value: 'hello' }],
      },
    })

    expect(createTransport).not.toHaveBeenCalled()
    expect(sendMail).not.toHaveBeenCalled()
    expect(result).toEqual({ delivered: false, simulated: true, error: null })
  })
})
