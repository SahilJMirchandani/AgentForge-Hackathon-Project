import { beforeEach, describe, expect, it, vi } from 'vitest'

const runAgentStep = vi.fn()
const deliverNotification = vi.fn()

vi.mock('./gemini.js', () => ({ runAgentStep }))
vi.mock('./notifications.js', async () => {
  const actual = await vi.importActual('../src/utils/notify.js')
  return { ...actual, deliverNotification }
})

const { executeWorkflow } = await import('./executor.js')

const workflow = () => ({
  id: 'wf-test',
  name: 'Test Agent',
  status: 'Draft',
  prompt: 'summarise and notify',
  nodes: [
    { id: 'trigger', data: { kind: 'trigger', title: 'Webhook' } },
    { id: 'ai', data: { kind: 'ai', title: 'Summarize', instructions: 'Summarize the input.' } },
    { id: 'output', data: { kind: 'output', title: 'Notify', channel: 'email', destination: 'owner@example.com' } },
  ],
  executionHistory: [],
})

describe('agent executor', () => {
  beforeEach(() => {
    runAgentStep.mockReset().mockResolvedValue('A concise summary')
    deliverNotification.mockReset().mockResolvedValue({ delivered: true, simulated: false, channel: 'email', to: 'owner@example.com', error: null })
  })

  it('passes webhook input through an AI step and delivers the result', async () => {
    const agent = workflow()
    const run = await executeWorkflow(agent, { email: 'owner@example.com' }, { subject: 'Important update' })

    expect(run.status).toBe('Completed')
    expect(run.output).toBe('A concise summary')
    expect(run.steps).toHaveLength(3)
    expect(runAgentStep).toHaveBeenCalledWith(expect.objectContaining({ input: { subject: 'Important update' } }))
    expect(deliverNotification).toHaveBeenCalledWith(expect.objectContaining({
      node: expect.objectContaining({ id: 'output' }),
      output: 'A concise summary',
    }))
    expect(run.steps.at(-1).output).toMatchObject({ delivered: true, channel: 'email', to: 'owner@example.com' })
    expect(agent.executionHistory[0].id).toBe(run.id)
  })

  it('reports a clear error when a Gmail trigger has no connected account', async () => {
    const agent = workflow()
    agent.nodes[0].data.instructions = 'When a new email arrives in Gmail.'
    const run = await executeWorkflow(agent, { email: 'owner@example.com' }, 'email body')

    expect(run.status).toBe('Failed')
    expect(run.error).toMatch(/Gmail integration is unavailable/)
    expect(agent.results[0].label).toBe('Run error')
  })

  it('fails the run when an output side effect cannot be delivered', async () => {
    deliverNotification.mockResolvedValue({ delivered: false, simulated: false, channel: 'email', to: null, error: '"nope" is not a valid email address' })
    const agent = workflow()
    const run = await executeWorkflow(agent, { email: 'owner@example.com' }, 'test event')

    expect(run.status).toBe('Failed')
    expect(run.error).toMatch(/not a valid email address/)
    expect(agent.status).toBe('Failed')
    expect(agent.executionHistory[0].status).toBe('Failed')
  })

  it('reports an unsent notification as simulated rather than delivered', async () => {
    deliverNotification.mockResolvedValue({ delivered: false, simulated: true, channel: 'email', to: 'owner@example.com', error: null })
    const agent = workflow()
    const run = await executeWorkflow(agent, { email: 'owner@example.com' }, 'test event')

    expect(run.status).toBe('Completed')
    expect(run.steps.at(-1).output).toMatchObject({ delivered: false, simulated: true })
    expect(run.steps.at(-1).output.note).toMatch(/not configured/)
  })

  it('delivers SMS through the notification layer instead of failing outright', async () => {
    deliverNotification.mockResolvedValue({ delivered: true, simulated: false, channel: 'sms', to: '+919876543210', error: null })
    const agent = workflow()
    agent.nodes[2].data.channel = 'sms'
    agent.nodes[2].data.destination = '+91 98765 43210'
    const run = await executeWorkflow(agent, { email: 'owner@example.com' }, 'test event')

    expect(run.status).toBe('Completed')
    expect(run.steps.at(-1).output).toMatchObject({ channel: 'sms', delivered: true })
  })

  it('skips an account-address notification when the user turned them off', async () => {
    const agent = workflow()
    agent.nodes[2].data.destination = ''
    const run = await executeWorkflow(agent, { email: 'owner@example.com', emailNotifications: false }, 'test event')

    expect(run.status).toBe('Completed')
    expect(deliverNotification).not.toHaveBeenCalled()
    expect(run.steps.at(-1).output).toMatchObject({ skipped: true })
  })

  it('still sends to an explicit recipient when account notifications are off', async () => {
    const agent = workflow()
    await executeWorkflow(agent, { email: 'owner@example.com', emailNotifications: false }, 'test event')
    expect(deliverNotification).toHaveBeenCalled()
  })

  it('returns a structured failure for an empty workflow', async () => {
    const agent = { id: 'wf-empty', name: 'Empty Agent', nodes: [], executionHistory: [] }
    const run = await executeWorkflow(agent, { email: 'owner@example.com' }, {})

    expect(run.status).toBe('Failed')
    expect(run.error).toMatch(/no executable steps/)
    expect(run.steps).toEqual([])
  })

  it('stops downstream work when a condition does not match', async () => {
    const agent = workflow()
    agent.nodes[1].data.instructions = 'Find urgent messages.'
    agent.nodes[2].data.kind = 'condition'
    agent.nodes[2].data.instructions = 'Continue when urgent.'
    const run = await executeWorkflow(agent, { email: 'owner@example.com' }, 'Routine update')

    expect(run.status).toBe('Completed')
    expect(deliverNotification).not.toHaveBeenCalled()
    expect(run.steps.at(-1).output.evaluated).toBe(false)
  })
})
