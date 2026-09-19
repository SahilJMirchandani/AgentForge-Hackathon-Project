export default function StatCard({ icon: Icon, label, value, tone = 'primary' }) {
  const tones = {
    primary: 'bg-primary-light text-primary',
    success: 'bg-success-light text-success',
    running: 'bg-running-light text-running',
    danger: 'bg-danger-light text-danger',
  }
  return (
    <div className="flex-1 min-w-[140px] bg-surface border border-border rounded-card p-4 flex items-center gap-3 shadow-card">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-lg font-semibold text-ink leading-none">{value}</p>
        <p className="text-xs text-ink-soft mt-1">{label}</p>
      </div>
    </div>
  )
}
