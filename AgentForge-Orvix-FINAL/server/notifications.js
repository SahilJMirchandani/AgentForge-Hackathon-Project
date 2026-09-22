import { sendWorkflowEmail } from './mailer.js'
import { sendSlackWebhook } from './integrations.js'
import { sendSms } from './sms.js'
import { resolveChannel, resolveRecipient } from '../src/utils/notify.js'

export {
  NOTIFICATION_CHANNELS,
  extractDestinationFromPrompt,
  isValidEmail,
  isValidSlackWebhook,
  normalizePhoneNumber,
  resolveChannel,
  resolveRecipient,
  validateDestination,
} from '../src/utils/notify.js'

/**
 * Single entry point used by the executor and by the "send test" endpoint.
 * Always resolves to a structured result — it never reports success for a
 * delivery that did not actually happen.
 */
export async function deliverNotification({ node, user, workflow, output, prompt }) {
  const channel = resolveChannel(node?.data?.channel, prompt ?? workflow?.prompt)
  const recipient = resolveRecipient({ node, user, channel, prompt: prompt ?? workflow?.prompt })
  if (!recipient.ok) return { delivered: false, simulated: false, channel, to: null, error: recipient.error }

  const agentName = workflow?.name || 'Agent'
  const subject = String(node?.data?.subject || '').trim() || `${agentName} agent result`

  if (channel === 'email') {
    const result = await sendWorkflowEmail({
      to: recipient.to,
      subject,
      workflow: { ...workflow, results: [{ label: 'Agent output', value: output }] },
    })
    return { ...result, channel: 'email', to: recipient.to, usedAccountEmail: recipient.usedFallback }
  }

  if (channel === 'slack') {
    const result = await sendSlackWebhook({ webhookUrl: recipient.to, text: `*${agentName}*\n\n${output}` })
    return { ...result, channel: 'slack', to: recipient.to }
  }

  const result = await sendSms({ to: recipient.to, body: `${agentName} finished running.\n\n${output}` })
  return { ...result, channel: 'sms', to: recipient.to }
}
