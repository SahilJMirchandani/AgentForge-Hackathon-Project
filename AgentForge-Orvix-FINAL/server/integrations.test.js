import { describe, expect, it, vi } from 'vitest'
import { fetchGmailMessages, sendSlackWebhook } from './integrations.js'

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

describe('Gmail integration', () => {
  it('fetches unread messages and decodes their body for summarization', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg-1' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msg-1',
          snippet: 'Short preview',
          payload: {
            mimeType: 'text/plain',
            headers: [
              { name: 'Subject', value: 'Important client update' },
              { name: 'From', value: 'client@example.com' },
              { name: 'Date', value: 'Mon, 22 Sep 2026 10:00:00 +0530' },
            ],
            body: {
              data: Buffer.from('Please review the attached proposal today.').toString('base64url'),
            },
          },
        }),
      })

    const messages = await fetchGmailMessages('test-token', 10)

    expect(messages).toHaveLength(1)
    expect(messages[0].body).toContain('Please review the attached proposal today.')
    expect(messages[0].headers).toEqual(expect.arrayContaining([
      { name: 'Subject', value: 'Important client update' },
    ]))
    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining('q=is%3Aunread'), expect.objectContaining({
      headers: { authorization: 'Bearer test-token' },
    }))
    fetchMock.mockRestore()
  })
})
