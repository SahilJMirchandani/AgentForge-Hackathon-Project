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
function compactSubject(value, maxLength = 90) {
  const text = String(value ?? '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\b(?:email|e-mail)\s+(?:me|to)\s+[^,;]+/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-:;,]+|[\s\-:;,]+$/g, '')
    .trim()
  if (!text) return ''
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

function topicFromPrompt(prompt) {
  const raw = compactSubject(prompt, 120)
  if (!raw) return ''
  const topic = raw
    .replace(/^(please\s+)?(?:summar(?:ize|ise)|analy[sz]e|review|check|monitor|track|read|process|find|identify|detect|classify|extract|prepare|create|notify|send|report|automate|build|make)\b\s*/i, '')
    .replace(/^(?:my|the|a|an)\s+/i, '')
    .replace(/\b(?:and|then)\s+(?:email|notify|send)\s+.*$/i, '')
    .trim()
  return compactSubject(topic || raw, 72)
}

function deriveNotificationSubject({ explicitSubject, workflow, input, output }) {
  const explicit = compactSubject(explicitSubject, 120)
  if (explicit) return explicit

  const prompt = String(workflow?.prompt || '')
  const promptLower = prompt.toLowerCase()
  const inputObject = input && typeof input === 'object' && !Array.isArray(input) ? input : null

  const isInboxWorkflow = /\b(?:inbox|gmail)\b|\b(?:new|unread|incoming)\s+emails?\b|\b(?:read|summar(?:ize|ise))\s+(?:my\s+)?emails?\b/i.test(prompt)
  if (isInboxWorkflow) {
    const processed = output?.match?.(/Messages processed:\s*(\d+)/i)?.[1]
    if (processed) return `Inbox Summary — ${processed} message${processed === "1" ? "" : "s"}`
    const messageSubject = compactSubject(inputObject?.subject || inputObject?.emailSubject, 72)
    if (messageSubject) return `Email Summary — ${messageSubject}`
    return 'Inbox Summary — Email Updates'
  }

  const sourceSubject = compactSubject(inputObject?.subject || inputObject?.title || inputObject?.topic, 72)
  if (sourceSubject) {
    if (/summar/.test(promptLower)) return `Summary — ${sourceSubject}`
    if (/analy[sz]e|review|classif|sentiment/.test(promptLower)) return `Analysis — ${sourceSubject}`
    return `Agent Result — ${sourceSubject}`
  }

  const topic = topicFromPrompt(prompt)
  if (topic) {
    if (/summar/.test(promptLower)) return `Summary — ${topic}`
    if (/analy[sz]e|review|classif|sentiment/.test(promptLower)) return `Analysis — ${topic}`
    if (/monitor|alert|notify|track|below target|drop|decline/.test(promptLower)) return `Alert — ${topic}`
    if (/meeting|transcript|call/.test(promptLower)) return `Meeting Follow-up — ${topic}`
    return `Agent Result — ${topic}`
  }

  const firstLine = compactSubject(String(output || '').split(/\n+/)[0], 72)
  return firstLine ? `Agent Result — ${firstLine}` : 'AgentForge workflow result'
}

export async function deliverNotification({ node, user, workflow, output, prompt, input }) {
  const channel = resolveChannel(node?.data?.channel, prompt ?? workflow?.prompt)
  const recipient = resolveRecipient({ node, user, channel, prompt: prompt ?? workflow?.prompt })
  if (!recipient.ok) return { delivered: false, simulated: false, channel, to: null, error: recipient.error }

  const agentName = workflow?.name || 'Agent'
  const subject = deriveNotificationSubject({
    explicitSubject: node?.data?.subject,
    workflow,
    input,
    output,
  })

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
