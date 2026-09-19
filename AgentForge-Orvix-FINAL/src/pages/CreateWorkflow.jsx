import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Bot, Loader2, Star, Send } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import ErrorState from '../components/ErrorState'

const EXAMPLES = [
  'Summarize my important emails',
  'Analyze customer feedback',
  'Monitor sales and notify me',
]

function ModelBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-xs text-ink-soft">
      <Sparkles size={12} className="text-primary" />
      <span>Gemini 3.5 Flash</span>
    </div>
  )
}

export default function CreateWorkflow() {
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [showError, setShowError] = useState(false)
  const createWorkflow = useAppStore((s) => s.createWorkflow)
  const navigate = useNavigate()

  function handleGenerate(text = prompt) {
    if (!text.trim()) return
    setShowError(false)
    setGenerating(true)
    createWorkflow(text).then((id) => {
      setGenerating(false)
      if (id) navigate(`/workflow/${id}`)
      else setShowError(true)
    })
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="relative text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
          <Sparkles size={22} className="text-white" />
        </div>
        <h1 className="text-2xl font-semibold text-ink">Agent<span className="text-primary">Forge</span></h1>
        <p className="text-sm text-ink-soft mt-1">Build AI Agents Without Coding</p>
        <div className="absolute right-0 top-0 hidden sm:flex flex-col items-end text-xs text-ink-faint rotate-[-4deg]">
          <span>Your idea + AI = Automation</span>
          <svg
            viewBox="0 0 28 26"
            aria-hidden="true"
            className="mr-2 mt-1 h-5 w-6 text-ink-soft"
            fill="none"
          >
            <defs>
              <marker id="annotation-arrowhead" markerWidth="5" markerHeight="5" refX="4.2" refY="2.5" orient="auto">
                <path d="M0 0 5 2.5 0 5Z" fill="currentColor" />
              </marker>
            </defs>
            <path
              d="M3 3c10 0 18 3 18 12 0 3-1 5-3 7"
              markerEnd="url(#annotation-arrowhead)"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.8"
            />
          </svg>
        </div>
      </div>

      <div className="bg-surface border border-primary/10 rounded-card shadow-card p-6">
        <h2 className="text-lg font-semibold text-ink mb-3">What do you want your agent to do?</h2>
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Read my emails, summarize important messages, create tasks for urgent ones, and notify me."
            rows={4}
            className="w-full px-4 py-3 pr-14 text-sm rounded-control border border-primary/20 bg-primary-light/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
          />
          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={!prompt.trim() || generating}
            aria-label="Send prompt"
            className="absolute right-3 bottom-3 w-8 h-8 inline-flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => handleGenerate()}
            disabled={!prompt.trim() || generating}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-control bg-[#A7A3F2] text-white text-sm font-medium hover:bg-[#948FEA] disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? 'Generating…' : 'Generate Workflow'}
          </button>
          <ModelBadge />
        </div>

        <p className="text-xs text-ink-soft mt-5 mb-2">Try these examples</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((label) => (
            <button
              key={label}
              onClick={() => {
                setPrompt(label)
                handleGenerate(label)
              }}
              className="px-3 py-1.5 rounded-full border border-border text-xs text-ink-soft hover:border-primary hover:text-primary transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {showError ? (
          <ErrorState onRetry={() => setShowError(false)} />
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-14 px-6 bg-surface border border-dashed border-border rounded-card">
            <div className="relative w-16 h-16 flex items-center justify-center mb-3">
              <div className="w-14 h-14 rounded-full bg-primary-light flex items-center justify-center">
                <Bot size={28} className="text-primary" />
              </div>
              <Sparkles size={13} className="absolute left-0 top-1 text-primary opacity-70" />
              <Star size={11} className="absolute right-0 top-0 text-primary opacity-50" />
              <Sparkles size={10} className="absolute right-1 bottom-1 text-primary opacity-60" />
            </div>
            <p className="text-sm font-medium text-ink">Generate a workflow to see it here</p>
            <p className="text-xs text-ink-soft mt-1 max-w-xs">
              Describe your task in the input above and let AgentForge build the perfect workflow for you.
            </p>
            <p className="text-xs text-ink-faint mt-3">AI can make mistakes. Please double-check responses.</p>
          </div>
        )}
      </div>
    </div>
  )
}
