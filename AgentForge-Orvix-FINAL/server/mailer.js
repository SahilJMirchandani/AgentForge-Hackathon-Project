import nodemailer from 'nodemailer'

let transporter

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))
}

function getTransporter() {
  if (transporter) return transporter
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return null
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  })
  return transporter
}

/** Test seam: lets the suite drop a memoised transporter between cases. */
export function resetTransporter() {
  transporter = undefined
}

export function mailStatus() {
  return { configured: Boolean(getTransporter()), from: process.env.RESET_EMAIL_FROM || process.env.SMTP_USER || null }
}

export async function sendPasswordResetEmail({ to, token }) {
  const mailer = getTransporter()
  const appUrl = process.env.APP_URL || 'http://localhost:5173'
  const resetUrl = `${appUrl.replace(/\/$/, '')}/login?resetToken=${encodeURIComponent(token)}`

  if (!mailer) {
    console.log(`[Dev Mailer] Password reset link for ${to}: ${resetUrl}`)
    return true
  }

  try {
    await mailer.sendMail({
      from: process.env.RESET_EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject: 'Reset your AgentForge password',
      text: `Reset your AgentForge password: ${resetUrl}\n\nThis link expires in 30 minutes. If you did not request it, you can ignore this email.`,
      html: `<p>Reset your AgentForge password by clicking the link below.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 30 minutes. If you did not request it, you can ignore this email.</p>`,
    })
    return { delivered: true, simulated: false, error: null }
  } catch (error) {
    const message = error.message || 'SMTP delivery failed'
    console.warn(`[Mailer Warning] Failed to send reset email to ${to}: ${message}`)
    return { delivered: false, simulated: false, error: message }
  }
}

function renderHtml({ agentName, results, subject }) {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#F5F7FA;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1F2937">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E9F0;border-radius:12px;overflow:hidden">
    <div style="padding:20px 24px;background:#4F46E5;color:#FFFFFF">
      <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">AgentForge</p>
      <h1 style="margin:6px 0 0;font-size:18px;font-weight:600">${escapeHtml(subject)}</h1>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 12px;font-size:14px;color:#4B5563">Your agent <strong>${escapeHtml(agentName)}</strong> finished running. Here is what it produced:</p>
      <pre style="margin:0;padding:14px;background:#F5F7FA;border:1px solid #E5E9F0;border-radius:8px;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word;color:#1F2937">${escapeHtml(results)}</pre>
    </div>
    <div style="padding:14px 24px;border-top:1px solid #E5E9F0;font-size:12px;color:#9CA3AF">
      You are receiving this because this address is set as the notification recipient on this agent.
    </div>
  </div>
</body></html>`
}

/**
 * Sends an agent result email.
 *
 * Returns `{ delivered, simulated, error }` rather than a bare boolean, so the
 * executor can distinguish "sent", "logged to console because SMTP is not
 * configured", and "SMTP rejected it". Previously this always returned true,
 * which made every run claim a successful delivery.
 */
export async function sendWorkflowEmail({ to, workflow, subject }) {
  const mailer = getTransporter()
  const results = (workflow?.results || []).map((result) => `${result.label}: ${result.value}`).join('\n') || 'The workflow completed successfully.'
  const agentName = workflow?.name || 'Agent'
  const resolvedSubject = subject || `Workflow completed: ${agentName}`

  if (!mailer) {
    console.log(`[Dev Mailer] Simulated email delivery to ${to}: ${resolvedSubject}\n${results}`)
    return { delivered: false, simulated: true, error: null }
  }

  try {
    await mailer.sendMail({
      from: process.env.RESET_EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject: resolvedSubject,
      text: `${agentName} completed successfully.\n\n${results}`,
      html: renderHtml({ agentName, results, subject: resolvedSubject }),
    })
    return { delivered: true, simulated: false, error: null }
  } catch (error) {
    const message = error.message || 'SMTP delivery failed'
    console.warn(`[Mailer Warning] SMTP delivery failed for ${to}: ${message}`)
    return { delivered: false, simulated: false, error: message }
  }
}

/** Used by the "Send test" button so a recipient can be verified before deploying. */
export async function sendTestEmail({ to }) {
  return sendWorkflowEmail({
    to,
    subject: 'AgentForge test notification',
    workflow: { name: 'Test notification', results: [{ label: 'Status', value: 'If you can read this, agent notifications to this address will work.' }] },
  })
}
