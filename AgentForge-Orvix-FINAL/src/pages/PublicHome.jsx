import { Link } from 'react-router-dom'
import { Sparkles, Workflow, ShieldCheck, ArrowRight } from 'lucide-react'

export default function PublicHome() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-border bg-surface">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="font-semibold text-lg">AgentForge</span>
          </div>
          <Link to="/login" className="inline-flex items-center gap-2 px-4 py-2 rounded-control bg-primary text-white text-sm font-medium hover:bg-primary-hover">
            Open AgentForge <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        <section className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-light px-3 py-1.5 text-xs font-medium text-primary">
            <Sparkles size={13} /> No-code AI agent builder
          </div>
          <h1 className="mt-5 text-4xl md:text-5xl font-semibold tracking-tight">
            Build intelligent workflows without coding.
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-base text-ink-soft leading-7">
            Describe an automation in plain English and AgentForge turns it into a visual workflow you can edit, test, run, score, and deploy.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/login" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-control bg-primary text-white text-sm font-medium hover:bg-primary-hover">
              Try AgentForge <ArrowRight size={15} />
            </Link>
            <a href="#privacy" className="inline-flex items-center px-5 py-2.5 rounded-control border border-border bg-surface text-sm font-medium text-ink-soft hover:text-ink">
              Privacy & data use
            </a>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-4 mt-14">
          {[
            [Sparkles, 'Describe', 'Explain what you want your automation to do in plain English.'],
            [Workflow, 'Build & test', 'Edit the generated node workflow and validate it in the sandbox.'],
            [ShieldCheck, 'Run & deploy', 'Run agents with your configured tools and deploy webhook-ready workflows.'],
          ].map(([Icon, title, text]) => (
            <div key={title} className="bg-surface border border-border rounded-card p-5">
              <Icon size={20} className="text-primary" />
              <h2 className="mt-3 text-sm font-semibold">{title}</h2>
              <p className="mt-1.5 text-xs text-ink-soft leading-5">{text}</p>
            </div>
          ))}
        </section>

        <section id="privacy" className="mt-14 bg-surface border border-border rounded-card p-6">
          <h2 className="text-base font-semibold">Google data use</h2>
          <p className="mt-2 text-sm text-ink-soft leading-6">
            AgentForge can optionally connect to Google Gmail so a user-requested workflow can read Gmail messages. Gmail access is requested only when the user chooses to connect Google. See our
            {' '}<Link to="/privacy" className="text-primary font-medium hover:underline">Privacy Policy</Link>
            {' '}for details, including how Google data is accessed, protected, used, and deleted.
          </p>
          <p className="mt-2 text-sm text-ink-soft leading-6">
            AgentForge does not sell Google user data or use it for advertising, and Google data is not used to train a general-purpose AI model. Google Workspace data is handled in accordance with applicable Google API user-data and Limited Use requirements.
          </p>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap items-center justify-center gap-4 text-xs text-ink-soft">
          <Link to="/privacy" className="hover:text-primary">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-primary">Terms of Service</Link>
          <span>© {new Date().getFullYear()} AgentForge</span>
        </div>
      </footer>
    </div>
  )
}
