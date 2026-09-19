import { Link } from 'react-router-dom'

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-border bg-surface">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-semibold text-lg">AgentForge</Link>
          <Link to="/login" className="text-sm text-primary font-medium hover:underline">Open AgentForge</Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-semibold">Terms of Service</h1>
        <p className="mt-2 text-sm text-ink-soft">Last updated: September 19, 2026</p>
        <div className="mt-8 space-y-7 text-sm leading-7 text-ink-soft">
          <section><h2 className="text-lg font-semibold text-ink">1. Acceptance</h2><p className="mt-2">By using AgentForge, you agree to these Terms of Service. If you do not agree, do not use the service.</p></section>
          <section><h2 className="text-lg font-semibold text-ink">2. Service</h2><p className="mt-2">AgentForge provides tools for creating, testing, running, and deploying automation workflows. Features may change as the service develops.</p></section>
          <section><h2 className="text-lg font-semibold text-ink">3. Accounts and security</h2><p className="mt-2">You are responsible for information you provide to create and maintain your account and for keeping your credentials secure. Do not share your credentials or OAuth authorization with another person.</p></section>
          <section><h2 className="text-lg font-semibold text-ink">4. Connected services</h2><p className="mt-2">External services, when available, are subject to their own permissions, terms, and policies. You are responsible for reviewing the permissions you grant before using an external service with a workflow.</p></section>
          <section><h2 className="text-lg font-semibold text-ink">5. Acceptable use</h2><p className="mt-2">You may not use AgentForge to violate laws, abuse external services, send unauthorized or harmful communications, attempt to access another person's data, bypass security controls, or interfere with the service.</p></section>
          <section><h2 className="text-lg font-semibold text-ink">6. User content</h2><p className="mt-2">You retain responsibility for prompts, workflow definitions, inputs, outputs, and other content you submit. You must have the rights and permissions necessary to process information through the workflows you create.</p></section>
          <section><h2 className="text-lg font-semibold text-ink">7. AI-generated results</h2><p className="mt-2">AI-generated workflow definitions and outputs can contain errors. You are responsible for reviewing workflows, permissions, destinations, and results before relying on or deploying them.</p></section>
          <section><h2 className="text-lg font-semibold text-ink">8. Availability</h2><p className="mt-2">AgentForge is provided on an availability basis and may occasionally be unavailable because of maintenance, provider outages, network issues, or other circumstances.</p></section>
          <section><h2 className="text-lg font-semibold text-ink">9. Third-party services</h2><p className="mt-2">Google, email, SMS, AI, hosting, and other integrations are subject to their own terms and policies. AgentForge is not responsible for independent outages or policy changes made by third-party providers.</p></section>
          <section><h2 className="text-lg font-semibold text-ink">10. Changes and termination</h2><p className="mt-2">AgentForge may update these terms or suspend access when necessary for security, legal compliance, abuse prevention, or operation of the service.</p></section>
          <section><h2 className="text-lg font-semibold text-ink">11. Contact</h2><p className="mt-2">For questions about these terms, contact the AgentForge service operator through the contact information provided with the application.</p></section>
        </div>
        <div className="mt-10 pt-5 border-t border-border flex gap-4 text-sm">
          <Link to="/" className="text-primary hover:underline">AgentForge home</Link>
          <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
        </div>
      </main>
    </div>
  )
}
