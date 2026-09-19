const STYLES = {
  Completed: 'bg-success-light text-success',
  Running: 'bg-running-light text-running',
  Waiting: 'bg-canvas text-ink-soft',
  Failed: 'bg-danger-light text-danger',
  Draft: 'bg-canvas text-ink-soft',
  Saved: 'bg-primary-light text-primary',
}

const DOT = {
  Completed: 'bg-success',
  Running: 'bg-running',
  Waiting: 'bg-ink-faint',
  Failed: 'bg-danger',
  Draft: 'bg-ink-faint',
  Saved: 'bg-primary',
}

export default function StatusBadge({ status }) {
  const style = STYLES[status] || STYLES.Waiting
  const dot = DOT[status] || DOT.Waiting
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot} ${status === 'Running' ? 'animate-pulse' : ''}`} />
      {status}
    </span>
  )
}
