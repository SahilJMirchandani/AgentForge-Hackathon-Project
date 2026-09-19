import { Bot, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function EmptyState({
  title = 'No workflows yet',
  subtitle = 'Describe what you want to automate, AgentForge will build the workflow for you.',
  ctaLabel = 'Create Your First Workflow',
}) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6 bg-surface border border-border rounded-card">
      <div className="w-20 h-20 rounded-full bg-primary-light flex items-center justify-center mb-5">
        <Bot size={32} className="text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="text-sm text-ink-soft mt-1.5 max-w-sm">{subtitle}</p>
      <button
        onClick={() => navigate('/create')}
        className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-control bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
      >
        <Plus size={16} />
        {ctaLabel}
      </button>
    </div>
  )
}
