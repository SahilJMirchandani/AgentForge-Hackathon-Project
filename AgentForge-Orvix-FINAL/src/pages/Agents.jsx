import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Bot, Loader2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import StatusBadge from '../components/StatusBadge'
import EmptyState from '../components/EmptyState'
import { getSandboxAverage, getScoreTone } from '../utils/score'

function getPerformance(workflow) {
  const history = Array.isArray(workflow.executionHistory) && workflow.executionHistory.length
    ? workflow.executionHistory
    : workflow.status === 'Completed' || workflow.status === 'Failed'
      ? [{ status: workflow.status }]
      : []
  const completedRuns = history.filter((run) => run.status === 'Completed').length
  const successRate = history.length ? Math.round((completedRuns / history.length) * 100) : 0
  const runLabel = `${history.length} ${history.length === 1 ? 'run' : 'runs'}`
  return { runLabel, successRate }
}

function PerformanceLine({ workflow }) {
  const performance = getPerformance(workflow)
  const score = getSandboxAverage(workflow.sandboxScore)
  const tone = score === null ? null : getScoreTone(score)

  return (
    <p className="mt-3 text-xs text-ink-faint">
      {performance.runLabel} · {performance.successRate}% success
      {score !== null && (
        <>
          <span> · </span>
          <span className={`font-medium ${tone.text}`}>Score: {score}</span>
        </>
      )}
    </p>
  )
}

function ActiveToggle({ active, onToggle }) {
  return (
    <button
      type="button"
      aria-label={active ? 'Disable agent' : 'Enable agent'}
      aria-pressed={active}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className={`relative h-5 w-9 rounded-full transition-colors ${active ? 'bg-success' : 'bg-ink-faint'}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${active ? 'right-0.5' : 'left-0.5'}`} />
    </button>
  )
}

export default function Agents() {
  const navigate = useNavigate()
  const workflows = useAppStore((s) => s.workflows)
  const toggleActive = useAppStore((s) => s.toggleActive)
  const deployWorkflow = useAppStore((s) => s.deployWorkflow)
  const [deployingId, setDeployingId] = useState(null)
  const [deployError, setDeployError] = useState('')
  const [deployMessage, setDeployMessage] = useState('')

  async function handleDeploy(workflowId) {
    setDeployError('')
    setDeployMessage('')
    setDeployingId(workflowId)
    try {
      const response = await deployWorkflow(workflowId)
      setDeployMessage(response?.webhookUrl
        ? 'Agent deployed. Its live webhook endpoint is ready in the editor.'
        : 'Agent deployed successfully.')
    } catch (error) {
      setDeployError(error.message || 'Unable to deploy this agent')
    } finally {
      setDeployingId(null)
    }
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">My Agents</h1>
          <p className="text-sm text-ink-soft mt-1">All the automations you've built.</p>
        </div>
        <button
          onClick={() => navigate('/create')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-control bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          <Plus size={15} />
          New Agent
        </button>
      </div>

      <div className="mt-6">
        {deployError && (
          <p role="alert" className="mb-4 rounded-control border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger">
            {deployError}
          </p>
        )}
        {deployMessage && (
          <p role="status" className="mb-4 rounded-control border border-success/30 bg-success-light px-3 py-2 text-sm text-success">
            {deployMessage}
          </p>
        )}
        {workflows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((w) => (
              <div
                key={w.id}
                onClick={() => navigate(`/workflow/${w.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(`/workflow/${w.id}`)
                  }
                }}
                role="button"
                tabIndex={0}
                className="text-left bg-surface border border-border rounded-card shadow-card p-5 hover:border-primary/40 transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg bg-primary-light text-primary flex items-center justify-center ${w.isActive === false ? 'opacity-60' : ''}`}>
                    <Bot size={18} />
                  </div>
                  <ActiveToggle active={w.isActive !== false} onToggle={() => toggleActive(w.id)} />
                </div>
                <div className={w.isActive === false ? 'opacity-60' : ''}>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{w.name}</p>
                    {w.isDeployed && (
                      <span className="rounded-full bg-success-light px-2 py-0.5 text-[11px] font-medium text-success">Live</span>
                    )}
                  </div>
                  <p className="text-xs text-ink-soft mt-1 line-clamp-2">{w.prompt}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <StatusBadge status={w.status} />
                    {!w.isDeployed && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleDeploy(w.id)
                        }}
                        disabled={deployingId === w.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {deployingId === w.id && <Loader2 size={12} className="animate-spin" />}
                        {deployingId === w.id ? 'Deploying…' : 'Deploy'}
                      </button>
                    )}
                  </div>
                  <PerformanceLine workflow={w} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
