import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Mail, MessageSquare, TrendingUp, Calendar } from 'lucide-react'
import { TEMPLATE_LIST } from '../data/templates'
import { useAppStore } from '../store/useAppStore'

const ICONS = { email: Mail, feedback: MessageSquare, sales: TrendingUp, meeting: Calendar }
const TONES = {
  primary: 'bg-primary-light text-primary',
  secondary: 'bg-secondary-light text-secondary',
  success: 'bg-success-light text-success',
  accent: 'bg-accent-light text-accent',
}

export default function Templates() {
  const navigate = useNavigate()
  const createWorkflow = useAppStore((s) => s.createWorkflow)
  const generateWorkflow = useAppStore((s) => s.generateWorkflow)
  const [creatingKey, setCreatingKey] = useState(null)

  async function useTemplate(tpl) {
    if (creatingKey) return
    setCreatingKey(tpl.key)
    try {
      const id = (await createWorkflow(tpl.description)) || generateWorkflow(tpl.description)
      if (id) navigate(`/workflow/${id}`)
    } finally {
      setCreatingKey(null)
    }
  }

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold text-ink">Templates</h1>
      <p className="text-sm text-ink-soft mt-1">Choose a template to get started quickly.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        {TEMPLATE_LIST.map((tpl) => {
          const Icon = ICONS[tpl.key]
          return (
            <div key={tpl.key} className="bg-surface border border-border rounded-card shadow-card p-5">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${TONES[tpl.color]}`}>
                <Icon size={18} />
              </div>
              <p className="text-sm font-semibold text-ink">{tpl.name}</p>
              <p className="text-xs text-ink-soft mt-1 leading-relaxed">{tpl.description}</p>
              <button
                type="button"
                onClick={() => useTemplate(tpl)}
                disabled={Boolean(creatingKey)}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingKey === tpl.key && <Loader2 size={14} className="animate-spin" />}
                {creatingKey === tpl.key ? 'Opening…' : 'Use Template →'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
