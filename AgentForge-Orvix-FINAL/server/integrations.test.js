import { describe, expect, it, vi } from 'vitest'
import { sendSlackWebhook } from './integrations.js'

describe('Slack integration', () => {
  it('accepts only Slack HTTPS webhooks', async () => {
    await expect(sendSlackWebhook({ webhookUrl: 'http://example.com/hook', text: 'hello' })).rejects.toThrow(/Slack HTTPS/)
  })

  it('posts a bounded message to Slack', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true })
    await sendSlackWebhook({ webhookUrl: 'https://hooks.slack.com/services/T/B/X', text: 'hello' })
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ method: 'POST' }))
    fetchMock.mockRestore()
  })
})