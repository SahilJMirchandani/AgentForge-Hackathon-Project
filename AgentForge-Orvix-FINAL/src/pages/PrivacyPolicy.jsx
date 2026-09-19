import { Link } from 'react-router-dom'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-border bg-surface">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-semibold text-lg">AgentForge</Link>
          <Link to="/login" className="text-sm text-primary font-medium hover:underline">Open AgentForge</Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-semibold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-ink-soft">Last updated: September 19, 2026</p>

        <div className="mt-8 space-y-7 text-sm leading-7 text-ink-soft">
          <section><h2 className="text-lg font-semibold text-ink">1. Overview</h2><p className="mt-2">AgentForge is a no-code automation platform that lets users describe workflows, build visual AI agents, test them, and run or deploy those workflows. This policy explains what information AgentForge handles and how it is used.</p></section>

          <section><h2 className="text-lg font-semibold text-ink">2. Information we collect</h2><p className="mt-2">Depending on the features you use, AgentForge may collect your name, email address, account credentials, workflow definitions, workflow inputs and outputs, notification preferences, and service configuration. When you choose to connect Google, AgentForge receives the Google account information required for authentication and the OAuth authorization needed for the Gmail feature.</p></section>

          <section><h2 className="text-lg font-semibold text-ink">3. Google Gmail data</h2><p className="mt-2">If you connect Google Gmail, AgentForge requests the Gmail read-only permission so a workflow you configure can retrieve Gmail messages. AgentForge does not access Gmail unless you authorize the connection. Gmail message content may be processed by the workflow's AI step when you explicitly configure a workflow that uses Gmail data.</p><p className="mt-2">Google OAuth access and refresh tokens are protected using authenticated encryption before they are stored by AgentForge. Users can disconnect Google Gmail from AgentForge settings, which removes the stored Google OAuth credentials associated with the account.</p></section>

          <section><h2 className="text-lg font-semibold text-ink">4. How information is used</h2><p className="mt-2">Information is used to provide authentication, create and execute workflows, connect configured services, deliver requested notifications, maintain workflow history, provide the sandbox and scoring features, and keep the service secure. Google user data is used only to provide user-facing functionality requested by the user. AgentForge does not sell Google user data, use it for advertising, or use Google user data to train or improve a general-purpose AI model.</p></section>

          <section><h2 className="text-lg font-semibold text-ink">5. AI processing</h2><p className="mt-2">AgentForge may use the Gemini API to generate workflow definitions, evaluate workflows, or execute AI workflow steps. If a workflow sends Gmail content to an AI step, the relevant workflow input can be processed by the configured AI service to produce the requested result. AgentForge does not use that data for advertising or general-purpose model training.</p></section>

          <section><h2 className="text-lg font-semibold text-ink">6. Sharing and service providers</h2><p className="mt-2">AgentForge may use infrastructure and service providers needed to operate the application, such as hosting, database, email, SMS, Google APIs, and AI services. Data is shared only as necessary to provide the feature you request, maintain security, comply with law, or operate the service. AgentForge does not sell personal information or Google user data.</p></section>

          <section><h2 className="text-lg font-semibold text-ink">7. Data retention and deletion</h2><p className="mt-2">AgentForge retains account and workflow information for as long as needed to provide the service or as required for legitimate operational, security, or legal purposes. You can disconnect Google Gmail to remove stored Google OAuth credentials. You may also request deletion of your AgentForge account and associated data by contacting the service operator.</p></section>

          <section><h2 className="text-lg font-semibold text-ink">8. Security</h2><p className="mt-2">AgentForge uses HTTPS for production traffic and protects stored Google OAuth credentials with authenticated encryption. No internet service can guarantee absolute security, so users should avoid placing unnecessary sensitive information into workflow prompts or test inputs.</p></section>

          <section><h2 className="text-lg font-semibold text-ink">9. Google Limited Use</h2><p className="mt-2">AgentForge's use of information received from Google Workspace APIs, including Gmail scopes, adheres to the Google API Services User Data Policy and applicable Limited Use requirements. Google user data is not transferred or used for purposes prohibited by those requirements.</p></section>

          <section><h2 className="text-lg font-semibold text-ink">10. Changes</h2><p className="mt-2">This policy may be updated when AgentForge's data practices or legal requirements change. The updated version will be published on this page with a revised effective date.</p></section>

          <section><h2 className="text-lg font-semibold text-ink">11. Contact</h2><p className="mt-2">For privacy or data-deletion requests, contact the AgentForge service operator through the contact information provided with the application.</p></section>
        </div>

        <div className="mt-10 pt-5 border-t border-border flex gap-4 text-sm">
          <Link to="/" className="text-primary hover:underline">AgentForge home</Link>
          <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
        </div>
      </main>
    </div>
  )
}
