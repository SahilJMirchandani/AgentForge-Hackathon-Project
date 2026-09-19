function scheduleFor(workflow) {
  const trigger = (workflow.nodes || []).find((node) => node.data?.kind === 'trigger')
  const text = `${trigger?.data?.instructions || ''} ${trigger?.data?.subtitle || ''}`.toLowerCase()
  if (/every\s+minute|each\s+minute/.test(text)) return { interval: 60_000 }
  if (/every\s+hour|each\s+hour|hourly/.test(text)) return { interval: 3_600_000 }
  if (/9\s*am/.test(text)) return { hour: 9, minute: 0 }
  if (/every\s+day|each\s+day|daily/.test(text)) return { interval: 86_400_000 }
  return null
}

function isDue(workflow, schedule, now) {
  const lastRun = workflow.lastScheduledRunAt || workflow.createdAt || 0
  if (schedule.interval) return now - lastRun >= schedule.interval
  const target = new Date(now)
  target.setHours(schedule.hour, schedule.minute, 0, 0)
  if (now < target.getTime()) target.setDate(target.getDate() - 1)
  return lastRun < target.getTime()
}

export function startScheduler({ db, executeWorkflow, saveDb, notify, intervalMs = 60_000 }) {
  let busy = false

  async function tick() {
    if (busy) return
    busy = true
    try {
      const now = Date.now()
      for (const workflow of Object.values(db.workflows || {})) {
        if (!workflow.isDeployed || workflow.isActive === false) continue
        const schedule = scheduleFor(workflow)
        if (!schedule || !isDue(workflow, schedule, now)) continue
        // db.users is keyed by email, workflow.userId is a UUID - match on both.
        const owner = Object.values(db.users || {}).find((user) => user && (user.id === workflow.userId || user.email === workflow.userId))
        if (!owner) continue
        workflow.lastScheduledRunAt = now
        const run = await executeWorkflow(workflow, owner, { trigger: 'schedule', scheduledAt: now })
        notify(owner, run.status === 'Completed' ? 'Scheduled agent completed' : 'Scheduled agent failed', run.status === 'Completed' ? `${workflow.name} completed its scheduled run.` : run.error)
      }
      await saveDb(db)
    } finally {
      busy = false
    }
  }

  const timer = setInterval(() => { void tick().catch((error) => console.error(`Scheduler tick failed: ${error.message}`)) }, intervalMs)
  timer.unref?.()
  return { tick, stop: () => clearInterval(timer) }
}