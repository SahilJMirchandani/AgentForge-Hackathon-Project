import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import StatusBadge from '../components/StatusBadge'
import EmptyState from '../components/EmptyState'

const FILTERS = ['All Status', 'Completed', 'Running', 'Draft', 'Failed']

function formatDate(ts) {
  return new Date(ts).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function History() {
  const navigate = useNavigate()
  const workflows = useAppStore((s) => s.workflows)
  const [filter, setFilter] = useState('All Status')

  const rows = workflows.flatMap((workflow) => {
    const runs = workflow.executionHistory || []
    if (runs.length === 0) {
      return [{ ...workflow, rowId: workflow.id, runDate: workflow.createdAt }]
    }

    return runs.map((run, index) => ({
      ...workflow,
      rowId: `${workflow.id}-run-${index}`,
      status: run.status,
      runDate: run.completedAt || workflow.createdAt,
      duration: run.duration || workflow.duration,
      runLabel: `Run ${runs.length - index}`,
    }))
  }).filter((row) => filter === 'All Status' || row.status === filter)

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold text-ink">Workflow History</h1>
      <p className="text-sm text-ink-soft mt-1">View past runs, status, duration and results.</p>

      <div className="flex items-center gap-2 mt-5 mb-3">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === f ? 'bg-primary text-white border-primary' : 'border-border text-ink-soft hover:bg-canvas'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No runs yet"
          subtitle="Once you run a workflow, its execution history will show up here."
          ctaLabel="Create Your First Workflow"
        />
      ) : (
        <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-ink-soft">
                <th className="px-4 py-3 font-medium">Workflow Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date &amp; Time</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium text-right">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.rowId} className="border-b border-border last:border-0 hover:bg-canvas">
                  <td className="px-4 py-3 font-medium text-ink">
                    {w.name}
                    {w.runLabel && <span className="block text-xs font-normal text-ink-faint">{w.runLabel}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={w.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(w.runDate)}</td>
                  <td className="px-4 py-3 text-ink-soft">{w.duration || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => navigate(`/workflow/${w.id}`)}
                      className="text-primary text-xs font-medium hover:underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
