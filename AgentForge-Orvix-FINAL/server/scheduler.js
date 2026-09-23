function isGmailWorkflow(workflow) {
  const trigger = (workflow.nodes || []).find((node) => node.data?.kind === 'trigger')
  const text = `${trigger?.data?.title || ''} ${trigger?.data?.instructions || ''} ${workflow.prompt || ''}`.toLowerCase()
  return /\bgmail\b|\binbox\b|new email.*arriv|monitor.*email|check.*email|read.*email/.test(text)
}

function scheduleFor(workflow) {
  if (isGmailWorkflow(workflow)) return { interval: 60_000, gmail: true }
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
        const owner = Object.values(db.users || {}).find((user) => user && (user.id === workflow.userId || user.email === workflow.userId))
        if (!owner) continue
        if (schedule.gmail && !workflow.gmailLastSeenAt) {
          workflow.gmailLastSeenAt = now
          workflow.lastScheduledRunAt = now
          continue
        }
        workflow.lastScheduledRunAt = now
        const input = schedule.gmail
          ? { trigger: 'gmail-poll', gmailQuery: `after:${Math.max(0, Math.floor((Number(workflow.gmailLastSeenAt) - 2000) / 1000))}`, gmailSince: Number(workflow.gmailLastSeenAt) }
          : { trigger: 'schedule', scheduledAt: now }
        const run = await executeWorkflow(workflow, owner, input)
        if (schedule.gmail && run.status === 'Completed' && run.gmailNewestMessageAt) workflow.gmailLastSeenAt = run.gmailNewestMessageAt
        if (!run.skipNotifications) {
          notify(owner, run.status === 'Completed' ? (schedule.gmail ? 'New email processed' : 'Scheduled agent completed') : (schedule.gmail ? 'Email agent failed' : 'Scheduled agent failed'), run.status === 'Completed' ? (schedule.gmail ? `${workflow.name} detected and processed a new email.` : `${workflow.name} completed its scheduled run.`) : run.error)
        }
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
