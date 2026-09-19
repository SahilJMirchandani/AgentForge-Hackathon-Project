import { AlertCircle, RotateCcw } from 'lucide-react'

export default function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6 bg-surface border border-border rounded-card">
      <div className="w-20 h-20 rounded-full bg-danger-light flex items-center justify-center mb-5">
        <AlertCircle size={32} className="text-danger" />
      </div>
      <h3 className="text-lg font-semibold text-ink">Unable to create a valid workflow</h3>
      <p className="text-sm text-ink-soft mt-1.5 max-w-sm">
        We couldn't understand your request. Try describing the trigger and desired actions.
      </p>
      <button
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-control bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
      >
        <RotateCcw size={15} />
        Try Again
      </button>
      <p className="text-xs text-ink-soft mt-3">
        e.g. "Read my emails, summarize important messages, and notify me"
      </p>
    </div>
  )
}
