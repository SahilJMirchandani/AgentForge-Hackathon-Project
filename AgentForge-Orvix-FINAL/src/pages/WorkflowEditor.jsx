import { useCallback, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ReactFlow, Background, Controls, applyNodeChanges, applyEdgeChanges, addEdge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ChevronLeft, Save, Play, Plus, CheckCircle2, XCircle, Mail, AlertTriangle, CheckSquare, Bell, Sparkles, MessageSquare, TrendingUp, Pencil, Trash2, ChevronDown, Settings2, Copy, Webhook, Send, AlertCircle } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { getApiUrl, getApiToken } from '../api'
import StatusBadge from '../components/StatusBadge'
import WorkflowNode from '../components/WorkflowNode'
import { getSandboxAverage, getScoreTone } from '../utils/score'
import { validateDestination } from '../utils/notify'
import { apiRequest } from '../api'

const nodeTypes = { workflow: WorkflowNode }
const RESULT_ICONS = { Mail, AlertTriangle, CheckSquare, Bell, Sparkles, MessageSquare, TrendingUp }
const SANDBOX_CATEGORIES = [
  { key: 'normal', label: 'Normal' },
  { key: 'missing_info', label: 'Missing Info' },
  { key: 'edge', label: 'Edge Cases' },
  { key: 'adversarial', label: 'Adversarial' },
]

function ScorePill({ score, onClick }) {
  const tone = getScoreTone(score)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone.background} ${tone.text} hover:opacity-80 transition-opacity`}
    >
      Score: {score}
    </button>
  )
}

function ScoreBar({ label, value }) {
  const tone = getScoreTone(value)
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-medium text-ink-soft">{label}</span>
        <span className={`font-semibold ${tone.text}`}>{value}/100</span>
      </div>
      <div className="h-2 rounded-full bg-canvas overflow-hidden">
        <div className={`h-full rounded-full ${tone.bar} transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export default function WorkflowEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const workflow = useAppStore((s) => s.workflows.find((w) => w.id === id))
  const lastError = useAppStore((s) => s.lastError)
  const lastNotice = useAppStore((s) => s.lastNotice)
  const userEmail = useAppStore((s) => s.userEmail)
  const clearError = useAppStore((s) => s.clearError)
  const updateNodes = useAppStore((s) => s.updateNodes)
  const updateNodeData = useAppStore((s) => s.updateNodeData)
  const updateEdges = useAppStore((s) => s.updateEdges)
  const addStep = useAppStore((s) => s.addStep)
  const deleteWorkflowNode = useAppStore((s) => s.deleteWorkflowNode)
  const saveWorkflow = useAppStore((s) => s.saveWorkflow)
  const runWorkflow = useAppStore((s) => s.runWorkflow)
  const updateWorkflowMeta = useAppStore((s) => s.updateWorkflowMeta)
  const deleteWorkflow = useAppStore((s) => s.deleteWorkflow)
  const deployWorkflow = useAppStore((s) => s.deployWorkflow)
  const runSandboxEval = useAppStore((s) => s.runSandboxEval)
  const [running, setRunning] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployNotice, setDeployNotice] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('workflow')
  const [openCategories, setOpenCategories] = useState({ normal: true, missing_info: true, edge: true, adversarial: true })
  const [draftName, setDraftName] = useState(workflow?.name || '')
  const [draftPrompt, setDraftPrompt] = useState(workflow?.prompt || '')
  const [runInput, setRunInput] = useState(workflow?.prompt || '')
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [nodeSaveStatus, setNodeSaveStatus] = useState('')

  const onNodesChange = useCallback(
    (changes) => workflow && updateNodes(id, applyNodeChanges(changes, workflow.nodes)),
    [id, workflow, updateNodes]
  )
  const onEdgesChange = useCallback(
    (changes) => workflow && updateEdges(id, applyEdgeChanges(changes, workflow.edges)),
    [id, workflow, updateEdges]
  )
  const onConnect = useCallback(
    (params) => workflow && updateEdges(id, addEdge(params, workflow.edges)),
    [id, workflow, updateEdges]
  )

  const defaultEdgeOptions = useMemo(() => ({ type: 'smoothstep' }), [])

  if (!workflow) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-ink-soft">Workflow not found.</p>
        <Link to="/agents" className="text-primary text-sm font-medium hover:underline mt-2 inline-block">
          Back to dashboard
        </Link>
      </div>
    )
  }

  async function handleDeploy() {
    clearError()
    setDeploying(true)
    setDeployNotice('')
    try {
      const response = await deployWorkflow(id)
      setDeployNotice(response?.webhookUrl ? 'Agent deployed! Webhook endpoint is live below.' : 'Agent deployed successfully.')
    } catch {
      // Handled via store state
    } finally {
      setDeploying(false)
    }
  }

  async function handleRun() {
    clearError()
    setRunning(true)
    try {
      await runWorkflow(id, { input: runInput.trim() || workflow.prompt })
    } finally {
      setRunning(false)
    }
  }

  function handleSaveMeta() {
    if (!workflow) return
    updateWorkflowMeta(id, { name: draftName.trim() || workflow.name, prompt: draftPrompt.trim() || workflow.prompt })
    setIsEditing(false)
  }

  function handleSave() {
    saveWorkflow(id)
    runSandboxEval(id)
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${workflow.name}"? This cannot be undone.`)) return
    deleteWorkflow(id)
    navigate('/agents')
  }

  function handleBack() {
    if (window.history.state?.idx > 0) {
      navigate(-1)
      return
    }
    navigate('/agents')
  }

  function handleNodeConfigChange(updates) {
    if (!selectedNodeId) return
    updateNodeData(id, selectedNodeId, updates)
    setNodeSaveStatus('Saved')
    window.setTimeout(() => setNodeSaveStatus(''), 1600)
  }

  function handleAddStep() {
    const nodeId = addStep(id)
    if (nodeId) setSelectedNodeId(nodeId)
  }

  function handleDeleteStep() {
    const node = workflow.nodes.find((item) => item.id === selectedNodeId)
    if (!node?.data?.userAdded) return
    deleteWorkflowNode(id, selectedNodeId)
    setSelectedNodeId(null)
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-full">
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button type="button" onClick={handleBack} className="text-ink-soft hover:text-ink">
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-ink max-w-sm break-words">{workflow.name}</h1>
              <StatusBadge status={workflow.status} />
              {workflow.isDeployed && (
                <span className="rounded-full bg-success-light px-2 py-0.5 text-[11px] font-medium text-success">Live</span>
              )}
              {workflow.sandboxScore && (
                <ScorePill
                  score={getSandboxAverage(workflow.sandboxScore)}
                  onClick={() => setActiveTab('sandbox')}
                />
              )}
            </div>
            {workflow.prompt && <p className="text-xs text-ink-soft truncate max-w-md">"{workflow.prompt}"</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 sm:justify-end">
          <button
            type="button"
            onClick={handleDeploy}
            disabled={deploying}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-control text-sm font-medium transition-colors ${
              workflow.isDeployed
                ? 'bg-success-light text-success border border-success/30 hover:bg-success-light/80'
                : 'border border-primary/30 bg-primary-light text-primary hover:bg-primary/10'
            }`}
          >
            <Webhook size={15} />
            {deploying ? 'Deploying…' : workflow.isDeployed ? 'Deployed (Re-deploy)' : 'Deploy Agent'}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing((value) => !value)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-control border border-border text-sm font-medium text-ink hover:bg-canvas transition-colors"
          >
            <Pencil size={15} />
            Edit
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-control border border-border text-sm font-medium text-ink hover:bg-canvas transition-colors"
          >
            <Save size={15} />
            Save
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-control bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-60 transition-colors"
          >
            <Play size={15} />
            {running ? 'Running…' : 'Run Workflow'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-control border border-danger/40 text-sm font-medium text-danger hover:bg-danger-light transition-colors"
          >
            <Trash2 size={15} />
            Delete
          </button>
        </div>
      </div>
      {deployNotice && (
        <div role="status" className="mb-4 rounded-control border border-success/30 bg-success-light px-3 py-2 text-sm text-success">
          {deployNotice}
        </div>
      )}
      {lastError && (
        <div role="alert" className="mb-4 rounded-control border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger">
          {lastError}
        </div>
      )}
      {lastNotice && !lastError && (
        <div role="status" className="mb-4 rounded-control border border-warning/30 bg-warning-light px-3 py-2 text-sm text-ink-soft">
          {lastNotice}
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-border mb-4">
        {[
          { id: 'workflow', label: 'Workflow' },
          { id: 'sandbox', label: 'Sandbox & Score' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-ink-soft hover:text-ink'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isEditing && (
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border border-border rounded-card bg-surface">
          <div>
            <label className="text-xs font-medium text-ink-soft">Workflow title</label>
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="mt-1.5 w-full px-3 py-2 text-sm rounded-control border border-border bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-soft">Prompt</label>
            <input
              value={draftPrompt}
              onChange={(e) => setDraftPrompt(e.target.value)}
              className="mt-1.5 w-full px-3 py-2 text-sm rounded-control border border-border bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="button"
              onClick={handleSaveMeta}
              className="px-3.5 py-2 rounded-control bg-primary text-white text-sm font-medium hover:bg-primary-hover"
            >
              Save changes
            </button>
          </div>
        </div>
      )}

      {activeTab === 'workflow' ? (
        <>
          <div className="mb-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end bg-surface border border-border rounded-card p-4">
            <label className="block">
              <span className="text-xs font-medium text-ink-soft">Test input for this agent</span>
              <textarea
                value={runInput}
                onChange={(event) => setRunInput(event.target.value)}
                rows={2}
                placeholder="Paste the event, email, or customer request the agent should process."
                className="mt-1.5 w-full px-3 py-2 text-sm rounded-control border border-border bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y"
              />
            </label>
            <p className="text-xs text-ink-faint max-w-xs">Runs are processed on the server and return the actual agent output.</p>
          </div>
          {workflow.isDeployed && workflow.webhookToken && <WebhookPanel token={workflow.webhookToken} />}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-4 items-stretch">
            <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden" style={{ height: 460 }}>
            <ReactFlow
              nodes={workflow.nodes}
              edges={workflow.edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              nodeTypes={nodeTypes}
              defaultEdgeOptions={defaultEdgeOptions}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={20} color="#E5E9F0" />
              <Controls showInteractive={false} />
            </ReactFlow>
            </div>
            <NodeConfigPanel
              node={workflow.nodes.find((node) => node.id === selectedNodeId)}
              onChange={handleNodeConfigChange}
              onClose={() => setSelectedNodeId(null)}
              saveStatus={nodeSaveStatus}
              accountEmail={userEmail}
              workflowName={workflow.name}
              onDelete={workflow.nodes.find((node) => node.id === selectedNodeId)?.data?.userAdded ? handleDeleteStep : null}
            />
          </div>

          <button
            type="button"
            onClick={handleAddStep}
            className="mt-3 self-start inline-flex items-center gap-1.5 px-3 py-2 rounded-control border border-dashed border-border text-sm text-ink-soft hover:border-primary hover:text-primary transition-colors"
          >
            <Plus size={15} />
            Add Step
          </button>

          {(workflow.executionLog.length > 0 || workflow.results || workflow.status === 'Running' || workflow.status === 'Failed') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="bg-surface border border-border rounded-card shadow-card p-4">
                <h3 className="text-sm font-semibold text-ink mb-3">Execution Log</h3>
                {workflow.executionLog.length > 0 ? (
                  <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {workflow.executionLog.map((line, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <CheckCircle2 size={14} className="text-success mt-0.5 shrink-0" />
                        <span className="text-ink-soft">{line.text}</span>
                        <span className="ml-auto text-ink-faint shrink-0">{line.time}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-ink-soft">{workflow.status === 'Running' ? 'Workflow is running…' : 'No execution steps were recorded.'}</p>
                )}
                {workflow.status === 'Completed' && <div className="mt-3 px-3 py-2 rounded-control bg-success-light text-success text-xs font-medium">Workflow completed successfully</div>}
                {workflow.status === 'Failed' && lastError && <div className="mt-3 px-3 py-2 rounded-control bg-danger-light text-danger text-xs font-medium break-words">{lastError}</div>}
              </div>
              <div className="bg-surface border border-border rounded-card shadow-card p-4 min-w-0">
                <h3 className="text-sm font-semibold text-ink mb-3">Results</h3>
                {workflow.results?.length ? (
                  <div className="space-y-2">
                    {workflow.results.map((r, index) => {
                      const Icon = RESULT_ICONS[r.icon] || (index === 0 ? Sparkles : CheckCircle2)
                      const renderedValue = typeof r.value === 'string' ? r.value : String(r.value ?? '')
                      return (
                        <div key={r.label || index} className="rounded-control bg-canvas p-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-7 h-7 rounded-lg bg-primary-light text-primary flex items-center justify-center shrink-0"><Icon size={13} /></div>
                            <span className="text-xs font-semibold text-ink">{r.label}</span>
                          </div>
                          <div className="whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft max-h-64 overflow-auto">{renderedValue}</div>
                        </div>
                      )
                    })}
                  </div>
                ) : workflow.status === 'Running' ? (
                  <p className="text-xs text-ink-soft">Waiting for the agent to return its output…</p>
                ) : (
                  <p className="text-xs text-ink-soft">No output was returned for this run.</p>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <SandboxPanel workflow={workflow} openCategories={openCategories} setOpenCategories={setOpenCategories} />
      )}
    </div>
  )
}

function Field({ label, value, onChange, multiline = false, placeholder }) {
  const className = "mt-1.5 w-full px-3 py-2 text-xs rounded-control border border-border bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-soft">{label}</span>
      {multiline ? (
        <textarea
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
          className={`${className} resize-y`}
        />
      ) : (
        <input
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={className}
        />
      )}
    </label>
  )
}

function WebhookPanel({ token }) {
  const [copied, setCopied] = useState(false)
  const configuredApiUrl = getApiUrl(`/hooks/${token}`)
  const webhookUrl = /^https?:\/\//.test(configuredApiUrl) ? configuredApiUrl : `${window.location.origin}${configuredApiUrl}`

  async function copyUrl() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(webhookUrl)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = webhookUrl
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        textarea.remove()
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mb-4 rounded-card border border-success/25 bg-success-light/50 p-4">
      <div className="flex items-start gap-3">
        <Webhook size={18} className="mt-0.5 text-success shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Live webhook endpoint</p>
          <p className="mt-1 text-xs text-ink-soft">Send a POST request with JSON to run this deployed agent.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-control bg-surface px-2.5 py-2 text-xs text-ink">{webhookUrl}</code>
            <button type="button" onClick={copyUrl} aria-label="Copy webhook URL" className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-border bg-surface text-ink-soft hover:text-primary">
              {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NodeConfigPanel({ node, onChange, onClose, saveStatus, accountEmail, workflowName, onDelete }) {
  if (!node) {
    return (
      <div className="min-h-[220px] bg-surface border border-dashed border-border rounded-card p-5 flex flex-col items-center justify-center text-center">
        <Settings2 size={22} className="text-ink-faint mb-2" />
        <p className="text-sm font-medium text-ink">Select a node to configure it</p>
        <p className="text-xs text-ink-soft mt-1">Edit labels, prompts, conditions, and destinations.</p>
      </div>
    )
  }

  const data = node.data || {}
  const tools = Array.isArray(data.tools) ? data.tools.join(', ') : data.tools || ''

  return (
    <aside className="bg-surface border border-border rounded-card shadow-card p-4 overflow-y-auto" style={{ height: 460 }}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-primary">{data.kind || 'step'}</p>
          <div className="flex items-center gap-2 mt-1">
            <h2 className="text-sm font-semibold text-ink">Configure node</h2>
            {saveStatus && <span className="text-[11px] font-medium text-success">{saveStatus}</span>}
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-ink-soft hover:text-ink">Close</button>
      </div>

      {onDelete && (
        <button type="button" onClick={onDelete} className="mb-3 inline-flex w-full items-center justify-center gap-1.5 rounded-control border border-danger/30 bg-danger-light px-3 py-2 text-xs font-medium text-danger hover:opacity-80">
          <Trash2 size={13} />
          Delete this step
        </button>
      )}

      <div className="space-y-3">
        <Field label="Title" value={data.title} onChange={(value) => onChange({ title: value })} />
        <Field label="Description" value={data.subtitle} onChange={(value) => onChange({ subtitle: value })} />

        {data.kind === 'ai' && (
          <>
            <Field label="Prompt" value={data.instructions} onChange={(value) => onChange({ instructions: value })} multiline placeholder="What should the AI agent analyze or produce?" />
            <Field label="Tools" value={tools} onChange={(value) => onChange({ tools: value.split(',').map((tool) => tool.trim()).filter(Boolean) })} placeholder="Gmail, Slack, CRM" />
          </>
        )}

        {data.kind === 'condition' && (
          <Field label="Condition" value={data.instructions} onChange={(value) => onChange({ instructions: value })} multiline placeholder="Continue when..." />
        )}

        {data.kind === 'action' && (
          <Field label="Action instructions" value={data.instructions} onChange={(value) => onChange({ instructions: value })} multiline placeholder="Describe what this step should do." />
        )}

        {['notify', 'output'].includes(data.kind) && (
          <NotificationFields data={data} onChange={onChange} accountEmail={accountEmail} workflowName={workflowName} />
        )}

        {data.kind === 'trigger' && (
          <Field label="Trigger event" value={data.instructions} onChange={(value) => onChange({ instructions: value })} placeholder="When a new event occurs" />
        )}
      </div>
    </aside>
  )
}

function SandboxPanel({ workflow, openCategories, setOpenCategories }) {
  if (!workflow.sandboxScore) {
    return (
      <div className="min-h-[460px] flex items-center justify-center bg-surface border border-dashed border-border rounded-card px-6 text-center">
        <p className="text-sm text-ink-soft">Save your workflow to run the automatic safety and reliability check.</p>
      </div>
    )
  }

  const score = workflow.sandboxScore
  const failedSecurityTest = (workflow.sandboxTests || []).find((test) => test.category === 'adversarial' && !test.passed)
  const risks = [
    score.reliability < 75 && 'Some workflow paths may need stronger handling for inconsistent email inputs.',
    score.security < 75 && failedSecurityTest && `Test case '${failedSecurityTest.input}' was not fully mitigated.`,
    score.toolCoverage < 75 && 'Some tool-selection cases were not fully covered by the current workflow steps.',
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-card shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Sandbox &amp; Score</h2>
            <p className="text-xs text-ink-soft mt-1">Automated checks across safety, reliability, and tool coverage.</p>
          </div>
          <span className={`text-2xl font-semibold ${getScoreTone(getSandboxAverage(score)).text}`}>{getSandboxAverage(score)}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ScoreBar label="Reliability" value={score.reliability} />
          <ScoreBar label="Security" value={score.security} />
          <ScoreBar label="Tool coverage" value={score.toolCoverage} />
        </div>
      </div>

      {risks.length > 0 && (
        <div className="bg-warning-light border border-warning/20 rounded-card p-5">
          <h3 className="text-sm font-semibold text-ink mb-2">Flagged Risks</h3>
          <ul className="space-y-1.5">
            {risks.map((risk) => <li key={risk} className="text-xs text-ink-soft">{risk}</li>)}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        {SANDBOX_CATEGORIES.map((category) => {
          const tests = (workflow.sandboxTests || []).filter((test) => test.category === category.key)
          const isOpen = openCategories[category.key]
          return (
            <div key={category.key} className="bg-surface border border-border rounded-card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenCategories((current) => ({ ...current, [category.key]: !current[category.key] }))}
                className={`w-full flex items-center justify-between px-4 py-3 text-left ${category.key === 'adversarial' ? 'bg-danger-light/70' : 'bg-surface'}`}
              >
                <span className="text-sm font-semibold text-ink">{category.label}</span>
                <ChevronDown size={16} className={`text-ink-soft transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="divide-y divide-border">
                  {tests.map((test) => (
                    <div key={test.id} className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {test.passed ? <CheckCircle2 size={15} className="text-success mt-0.5 shrink-0" /> : <XCircle size={15} className="text-danger mt-0.5 shrink-0" />}
                        <div className="min-w-0 space-y-1">
                          <p className="text-xs text-ink"><span className="font-medium">Input:</span> {test.input}</p>
                          <p className="text-xs text-ink-soft"><span className="font-medium text-ink-soft">Expected:</span> {test.expectedBehavior}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


const CHANNEL_LABELS = { email: 'Email', slack: 'Slack', sms: 'SMS' }

/**
 * Recipient configuration for an output node. Validation runs with the same
 * helper the server uses, and "Send test" proves the address actually receives
 * mail before the agent is deployed.
 */
function NotificationFields({ data, onChange, accountEmail, workflowName }) {
  const channel = ['email', 'slack', 'sms'].includes(data.channel) ? data.channel : 'email'
  const destination = data.destination || ''
  const check = validateDestination(channel, destination)
  const [testState, setTestState] = useState({ status: 'idle', message: '' })

  const label = channel === 'sms' ? 'Phone number' : channel === 'slack' ? 'Slack webhook URL' : 'Email address'
  const placeholder = channel === 'sms'
    ? '+91 98765 43210'
    : channel === 'slack'
      ? 'https://hooks.slack.com/services/...'
      : accountEmail || 'you@example.com'

  async function sendTest() {
    if (!check.ok) return
    if (!getApiToken()) {
      setTestState({ status: 'error', message: 'Sign in so the server can send the test message.' })
      return
    }
    setTestState({ status: 'sending', message: '' })
    try {
      const response = await apiRequest('/notifications/test', {
        method: 'POST',
        body: { channel, destination, workflowName },
        // SMTP handshakes can take longer than normal API calls; keep the UI
        // alive long enough to receive the server's real delivery result.
        timeoutMs: 45000,
      })
      setTestState({ status: response.delivered ? 'sent' : 'simulated', message: response.message })
    } catch (error) {
      setTestState({ status: 'error', message: error.message || 'Test notification failed' })
    }
  }

  return (
    <>
      <div>
        <span className="text-xs font-medium text-ink-soft">Channel</span>
        <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-control bg-canvas p-1">
          {['email', 'slack', 'sms'].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => { onChange({ channel: option }); setTestState({ status: 'idle', message: '' }) }}
              className={`rounded-[7px] px-2 py-1.5 text-xs font-medium transition-colors ${channel === option ? 'bg-surface text-primary shadow-sm' : 'text-ink-soft hover:text-ink'}`}
            >
              {CHANNEL_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <Field
        label={label}
        value={destination}
        onChange={(value) => { onChange({ destination: value }); setTestState({ status: 'idle', message: '' }) }}
        placeholder={placeholder}
      />

      {!check.ok && destination && (
        <p className="flex items-start gap-1.5 text-[11px] text-danger">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          {check.error}
        </p>
      )}
      {check.ok && !destination && channel === 'email' && (
        <p className="text-[11px] text-ink-faint">
          Leave blank to use your registered address{accountEmail ? ` (${accountEmail})` : ''}.
        </p>
      )}
      {!check.ok && !destination && (
        <p className="flex items-start gap-1.5 text-[11px] text-warning">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          {check.error}
        </p>
      )}

      <Field
        label="Subject line (optional)"
        value={data.subject}
        onChange={(value) => onChange({ subject: value })}
        placeholder={`${workflowName || 'Agent'} agent result`}
      />

      <button
        type="button"
        onClick={sendTest}
        disabled={!check.ok || testState.status === 'sending'}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-control border border-border px-3 py-2 text-xs font-medium text-ink hover:bg-canvas disabled:opacity-50 transition-colors"
      >
        <Send size={13} />
        {testState.status === 'sending' ? 'Sending…' : 'Send test notification'}
      </button>

      {testState.message && (
        <p className={`text-[11px] ${testState.status === 'sent' ? 'text-success' : testState.status === 'error' ? 'text-danger' : 'text-warning'}`}>
          {testState.message}
        </p>
      )}
    </>
  )
}
