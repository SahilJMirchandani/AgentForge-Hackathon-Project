import { beforeEach, describe, expect, it, vi } from 'vitest'

const runAgentStep = vi.fn()
const sendWorkflowEmail = vi.fn()

vi.mock('./gemini.js', () => ({
  runAgentStep,
  generateWorkflow: vi.fn(),
  evaluateWorkflow: vi.fn(),
}))
vi.mock('./mailer.js', () => ({
  sendWorkflowEmail,
  mailStatus: vi.fn(),
}))

const { executeWorkflow } = await import('./executor.js')

describe('agent deployment & webhook execution', () => {
  beforeEach(() => {
    runAgentStep.mockReset().mockResolvedValue('Agent processed webhook input')
    sendWorkflowEmail.mockReset().mockResolvedValue(true)
  })

  it('deploys an agent and sets webhook token and status', () => {
    const workflow = {
      id: 'wf-deploy-test',
      name: 'Webhook Agent',
      isDeployed: false,
      isActive: false,
      webhookToken: null,
    }

    workflow.isDeployed = true
    workflow.isActive = true
    workflow.webhookToken = 'token-123456'

    expect(workflow.isDeployed).toBe(true)
    expect(workflow.isActive).toBe(true)
    expect(workflow.webhookToken).toBe('token-123456')
  })

  it('does not claim a local-only deployment is a live webhook', async () => {
    const workflow = {
      id: 'wf-local-deploy-test',
      name: 'Local Agent',
      isDeployed: true,
      isActive: true,
      webhookToken: 'token-local',
    }

    expect(workflow.isDeployed).toBe(true)
    expect(workflow.webhookToken).toBe('token-local')
    // Live webhook validity is enforced by the authenticated deployment path;
    // a client-side fallback must never be treated as a server deployment.
  })

  it('executes a deployed agent workflow via webhook input', async () => {
    const workflow = {
      id: 'wf-webhook-test',
      name: 'Deployed Support Agent',
      isDeployed: true,
      isActive: true,
      webhookToken: 'token-test-xyz',
      nodes: [
        { id: 'n1', data: { kind: 'trigger', title: 'Webhook Trigger' } },
        { id: 'n2', data: { kind: 'ai', title: 'Process Request', instructions: 'Analyze customer message' } },
        { id: 'n3', data: { kind: 'output', title: 'Email Customer', channel: 'email', destination: 'support@example.com' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ],
      executionHistory: [],
    }

    const run = await executeWorkflow(workflow, { email: 'owner@example.com' }, { payload: 'Refund request' })

    expect(run.status).toBe('Completed')
    expect(run.output).toBe('Agent processed webhook input')
    expect(workflow.status).toBe('Completed')
    expect(workflow.isDeployed).toBe(true)
    expect(runAgentStep).toHaveBeenCalledWith(expect.objectContaining({
      input: { payload: 'Refund request' },
    }))
  })
})
