import { describe, expect, it, vi } from 'vitest'
import { startScheduler } from './scheduler.js'

describe('agent scheduler', () => {
  it('runs an overdue deployed daily agent through the executor', async () => {
    const workflow = {
      id: 'wf-scheduled',
      userId: 'user-1',
      createdAt: Date.now() - 90_000_000,
      isDeployed: true,
      isActive: true,
      nodes: [{ data: { kind: 'trigger', instructions: 'Run every day at 9 AM' } }],
    }
    const executeWorkflow = vi.fn().mockResolvedValue({ status: 'Completed' })
    const saveDb = vi.fn().mockResolvedValue(undefined)
    const notify = vi.fn()
    const db = { workflows: { [workflow.id]: workflow }, users: { 'user-1': { id: 'user-1', email: 'owner@example.com' } } }
    const scheduler = startScheduler({ db, executeWorkflow, saveDb, notify, intervalMs: 100_000 })

    await scheduler.tick()
    scheduler.stop()

    expect(executeWorkflow).toHaveBeenCalledWith(workflow, db.users['user-1'], expect.objectContaining({ trigger: 'schedule' }))
    expect(notify).toHaveBeenCalled()
    expect(saveDb).toHaveBeenCalledWith(db)
  })
})