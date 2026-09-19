import { randomUUID } from 'node:crypto'
import { runAgentStep } from './gemini.js'
import { accessTokenFor } from './oauth.js'
import { fetchGmailMessages } from './integrations.js'
import { deliverNotification, resolveChannel } from './notifications.js'

const outputKinds = new Set(['output', 'notify'])

function valueText(value) {
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

function conditionMatches(instructions, context) {
  const instructionText = instructions.toLowerCase()
  const text = valueText(context).toLowerCase()
  if (/urgent|important/.test(instructionText)) return /urgent|important|critical/.test(text)
  if (/negative|below target|decline|drop/.test(instructionText)) return /negative|below target|decline|drop|decrease/.test(text)
  if (/positive|above target|success/.test(instructionText)) return /positive|above target|success|increase/.test(text)
  return true
}

function executionOrder(workflow) {
  const nodes = workflow.nodes || []
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const incoming = new Set((workflow.edges || []).map((edge) => edge.target))
  const roots = nodes.filter((node) => !incoming.has(node.id))
  const ordered = []
  const visited = new Set()
  const visit = (node) => {
    if (!node || visited.has(node.id)) return
    visited.add(node.id)
    ordered.push(node)
    for (const edge of workflow.edges || []) {
      if (edge.source === node.id) visit(byId.get(edge.target))
    }
  }
  roots.forEach(visit)
  nodes.forEach(visit)
  return ordered
}

export async function executeWorkflow(workflow, user, input = {}) {
  const runId = `run-${randomUUID()}`
  const startedAt = Date.now()
  const run = {
    id: runId,
    input,
    status: 'Running',
    startedAt,
    steps: [],
    output: null,
    error: null,
    notifications: [],
  }
  let context = input

  try {
    if (!workflow.nodes?.length) throw new Error('This agent has no executable steps')
    for (const node of executionOrder(workflow)) {
      const step = { nodeId: node.id, title: node.data?.title || 'Step', kind: node.data?.kind || 'action', status: 'Running', startedAt: Date.now() }
      run.steps.push(step)
      const instructions = node.data?.instructions || node.data?.subtitle || 'Complete this step.'

      if (node.data?.kind === 'trigger') {
        if (/gmail|inbox|email/.test(instructions.toLowerCase()) && user?.googleOAuth) {
          try {
            context = { input, messages: await fetchGmailMessages(await accessTokenFor(user)) }
          } catch {
            context = input
          }
        } else {
          context = input
        }
      } else if (node.data?.kind === 'ai') {
        context = await runAgentStep({ instructions, input: context, workflow })
      } else if (node.data?.kind === 'condition') {
        const matched = conditionMatches(instructions, context)
        context = { input: context, condition: instructions, evaluated: matched }
        if (!matched) {
          step.output = context
          step.status = 'Completed'
          step.completedAt = Date.now()
          break
        }
      } else if (outputKinds.has(node.data?.kind)) {
        const channel = resolveChannel(node.data?.channel, workflow.prompt)

        // The account-level preference only gates notifications sent to the
        // account's own address. An explicit recipient typed on the node is a
        // deliberate instruction and is always honoured.
        const explicitRecipient = Boolean(String(node.data?.destination || '').trim())
        if (channel === 'email' && !explicitRecipient && user?.emailNotifications === false) {
          step.output = { delivered: false, skipped: true, channel, reason: 'Email notifications are turned off in Settings' }
          run.notifications.push(step.output)
        } else {
          const result = await deliverNotification({ node, user, workflow, output: valueText(context), prompt: workflow.prompt })
          if (result.error) throw new Error(result.error)
          step.output = {
            delivered: result.delivered,
            simulated: Boolean(result.simulated),
            channel: result.channel,
            to: result.to,
            ...(result.simulated ? { note: `${result.channel === 'email' ? 'SMTP' : result.channel === 'sms' ? 'SMS provider' : 'Slack'} is not configured on the server, so the message was logged instead of sent` } : {}),
            ...(result.usedAccountEmail ? { usedAccountEmail: true } : {}),
          }
          run.notifications.push(step.output)
        }
      } else {
        context = { input: context, action: instructions, completed: true }
      }

      step.status = 'Completed'
      step.output = step.output || context
      step.completedAt = Date.now()
    }

    run.status = 'Completed'
    run.output = context
    run.completedAt = Date.now()
    run.duration = `${Math.max(1, Math.round((run.completedAt - startedAt) / 1000))}s`
    workflow.status = 'Completed'
    workflow.nodes = (workflow.nodes || []).map((node) => ({ ...node, data: { ...node.data, status: 'completed' } }))
    workflow.startedAt = startedAt
    workflow.duration = run.duration
    workflow.results = [{ label: 'Agent output', value: valueText(context) }]
    workflow.executionLog = run.steps.map((step) => ({ time: new Date(step.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: notificationLogLine(step) }))
    workflow.executionLog.push({ time: new Date(run.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: 'Agent completed successfully' })
    workflow.executionHistory = [{ id: run.id, status: run.status, startedAt, completedAt: run.completedAt, duration: run.duration }, ...(workflow.executionHistory || [])].slice(0, 50)
  } catch (error) {
    run.status = 'Failed'
    run.error = error.message || 'Agent execution failed'
    run.completedAt = Date.now()
    const failedNodeId = run.steps[run.steps.length - 1]?.nodeId
    if (run.steps.length) run.steps[run.steps.length - 1].status = 'Failed'
    workflow.nodes = (workflow.nodes || []).map((node) => ({ ...node, data: { ...node.data, status: node.id === failedNodeId ? 'failed' : node.data?.status } }))
    workflow.status = 'Failed'
    workflow.executionHistory = [{ id: run.id, status: run.status, startedAt, completedAt: run.completedAt, error: run.error }, ...(workflow.executionHistory || [])].slice(0, 50)
  }

  return run
}

/** Makes the execution log say where a notification actually went. */
function notificationLogLine(step) {
  const output = step.output
  if (output && typeof output === 'object' && output.channel) {
    if (output.skipped) return `${step.title} skipped — ${output.reason}`
    if (output.simulated) return `${step.title} simulated (${output.channel} → ${output.to}, provider not configured)`
    if (output.delivered) return `${step.title} sent via ${output.channel} to ${output.to}`
  }
  return `${step.title} completed`
}
