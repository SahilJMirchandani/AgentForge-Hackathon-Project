import { Handle, Position } from '@xyflow/react'
import {
  Mail, Inbox, Sparkles, AlertTriangle, CheckSquare, Bell,
  MessageSquare, Database, TrendingUp, Clock, Calendar, Plus, CheckCircle2, Loader2,
} from 'lucide-react'

const ICONS = {
  Mail, Inbox, Sparkles, AlertTriangle, CheckSquare, Bell,
  MessageSquare, Database, TrendingUp, Clock, Calendar, Plus,
}

const KIND_STYLES = {
  trigger: { bg: 'bg-running-light', fg: 'text-running', ring: 'ring-running/30' },
  action: { bg: 'bg-success-light', fg: 'text-success', ring: 'ring-success/30' },
  ai: { bg: 'bg-secondary-light', fg: 'text-secondary', ring: 'ring-secondary/30' },
  condition: { bg: 'bg-warning-light', fg: 'text-warning', ring: 'ring-warning/30' },
  output: { bg: 'bg-danger-light', fg: 'text-danger', ring: 'ring-danger/30' },
}

export default function WorkflowNode({ data }) {
  const kind = KIND_STYLES[data.kind] || KIND_STYLES.action
  const Icon = ICONS[data.icon] || Sparkles
  const isRunning = data.status === 'running'
  const isDone = data.status === 'completed'

  return (
    <div
      className={`w-56 rounded-card border bg-surface shadow-card px-4 py-3 transition-shadow ${
        isRunning ? `ring-2 ${kind.ring} border-transparent` : 'border-border'
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${kind.bg} ${kind.fg}`}>
          {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{data.title}</p>
          <p className="text-xs text-ink-soft truncate">{data.subtitle}</p>
        </div>
        {isDone && (
          <CheckCircle2 size={16} className="text-success shrink-0 ml-auto" />
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
