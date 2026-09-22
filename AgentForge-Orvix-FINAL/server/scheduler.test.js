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

describe('live Gmail agent scheduler', () => {
  it('polls a deployed Gmail agent for new messages after its live baseline', async () => {
    const workflow = {
      id: 'wf-gmail-live',
      userId: 'user-1',
      createdAt: Date.now() - 120_000,
      gmailLastSeenAt: Date.now() - 90_000,
      isDeployed: true,
      isActive: true,
      nodes: [{ data: { kind: 'trigger', title: 'Gmail Inbox Trigger', instructions: 'Read new email from Gmail.' } }],
      prompt: 'Monitor my Gmail inbox and summarize new emails.',
    }
    const executeWorkflow = vi.fn().mockResolvedValue({ status: 'Completed', gmailNewestMessageAt: workflow.gmailLastSeenAt + 30_000 })
    const saveDb = vi.fn().mockResolvedValue(undefined)
    const notify = vi.fn()
    const db = { workflows: { [workflow.id]: workflow }, users: { 'user-1': { id: 'user-1', email: 'owner@example.com' } } }
    const scheduler = startScheduler({ db, executeWorkflow, saveDb, notify, intervalMs: 100_000 })

    await scheduler.tick()
    scheduler.stop()

    expect(executeWorkflow).toHaveBeenCalledWith(
      workflow,
      db.users['user-1'],
      expect.objectContaining({
        trigger: 'gmail-poll',
        gmailQuery: expect.stringContaining('after:'),
      }),
    )
    expect(workflow.gmailLastSeenAt).toBeGreaterThan(Date.now() - 70_000)
    expect(notify).toHaveBeenCalledWith(
      db.users['user-1'],
      'New email processed',
      expect.stringContaining('detected and processed'),
    )
  })

  it('does not notify when a live Gmail poll finds no new messages', async () => {
    const workflow = {
      id: 'wf-gmail-empty',
      userId: 'user-1',
      createdAt: Date.now() - 120_000,
      gmailLastSeenAt: Date.now() - 90_000,
      isDeployed: true,
      isActive: true,
      nodes: [{ data: { kind: 'trigger', title: 'Gmail Inbox Trigger', instructions: 'Read new email from Gmail.' } }],
      prompt: 'Monitor my Gmail inbox.',
    }
    const executeWorkflow = vi.fn().mockResolvedValue({ status: 'Completed', skipNotifications: true })
    const saveDb = vi.fn().mockResolvedValue(undefined)
    const notify = vi.fn()
    const db = { workflows: { [workflow.id]: workflow }, users: { 'user-1': { id: 'user-1', email: 'owner@example.com' } } }
    const scheduler = startScheduler({ db, executeWorkflow, saveDb, notify, intervalMs: 100_000 })

    await scheduler.tick()
    scheduler.stop()

    expect(executeWorkflow).toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })
})
