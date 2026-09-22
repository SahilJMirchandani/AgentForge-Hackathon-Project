import nodemailer from 'nodemailer'

let transporter

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))
}

function hasBrevo() {
  return Boolean(
    String(process.env.BREVO_API_KEY || '').trim() &&
    String(process.env.BREVO_FROM || '').trim(),
  )
}

function brevoFrom() {
  return String(process.env.BREVO_FROM || '').trim()
}

function hasResend() {
  return Boolean(String(process.env.RESEND_API_KEY || '').trim())
}

function resendFrom() {
  return process.env.RESEND_FROM || process.env.RESET_EMAIL_FROM || 'onboarding@resend.dev'
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
  const brevoConfigured = hasBrevo()
  const resendConfigured = hasResend()
  const smtpConfigured = Boolean(getTransporter())
  return {
    configured: brevoConfigured || resendConfigured || smtpConfigured,
    provider: brevoConfigured ? 'brevo' : resendConfigured ? 'resend' : smtpConfigured ? 'smtp' : null,
    from: brevoConfigured
      ? brevoFrom()
      : resendConfigured
        ? resendFrom()
        : process.env.RESET_EMAIL_FROM || process.env.SMTP_USER || null,
  }
}

async function sendViaBrevo({ to, subject, text, html }) {
  if (!hasBrevo()) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          email: brevoFrom(),
          name: process.env.BREVO_FROM_NAME || 'AgentForge',
        },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = payload?.message || payload?.code || `Brevo API request failed (${response.status})`
      return { delivered: false, simulated: false, error: message }
    }

    return { delivered: true, simulated: false, error: null, messageId: payload?.messageId || null }
  } catch (error) {
    const message = error.name === 'AbortError'
      ? 'Brevo API request timed out'
      : error.message || 'Brevo API delivery failed'
    return { delivered: false, simulated: false, error: message }
  } finally {
    clearTimeout(timeout)
  }
}

async function sendViaResend({ to, subject, text, html }) {
  if (!hasResend()) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: resendFrom(),
        to: [to],
        subject,
        text,
        html,
      }),
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = payload?.message || payload?.error || `Resend API request failed (${response.status})`
      return { delivered: false, simulated: false, error: message }
    }

    return { delivered: true, simulated: false, error: null, messageId: payload?.id || null }
  } catch (error) {
    const message = error.name === 'AbortError'
      ? 'Resend API request timed out'
      : error.message || 'Resend API delivery failed'
    return { delivered: false, simulated: false, error: message }
  } finally {
    clearTimeout(timeout)
  }
}

export async function sendPasswordResetEmail({ to, token }) {
  const appUrl = process.env.APP_URL || 'http://localhost:5173'
  const resetUrl = `${appUrl.replace(/\/$/, '')}/login?resetToken=${encodeURIComponent(token)}`
  const subject = 'Reset your AgentForge password'
  const text = `Reset your AgentForge password: ${resetUrl}\n\nThis link expires in 30 minutes. If you did not request it, you can ignore this email.`
  const html = `<p>Reset your AgentForge password by clicking the link below.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 30 minutes. If you did not request it, you can ignore this email.</p>`

  if (hasBrevo()) {
    const result = await sendViaBrevo({ to, subject, text, html })
    if (result) return result
  }

  if (hasResend()) {
    const result = await sendViaResend({ to, subject, text, html })
    if (result) return result
  }

  const mailer = getTransporter()
  if (!mailer) {
    console.log(`[Dev Mailer] Password reset link for ${to}: ${resetUrl}`)
    return true
  }

  try {
    await mailer.sendMail({
      from: process.env.RESET_EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    })
    return { delivered: true, simulated: false, error: null }
  } catch (error) {
    const message = error.message || 'SMTP delivery failed'
    console.warn(`[Mailer Warning] Failed to send reset email to ${to}: ${message}`)
    return { delivered: false, simulated: false, error: message }
  }
}

function renderResultHtml(results) {
  return String(results || 'The workflow completed successfully.')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const bullet = line.replace(/^•\s*/, '')
      if (bullet !== line) return `<li style="margin:0 0 6px">${escapeHtml(bullet)}</li>`
      const separator = line.indexOf(': ')
      if (separator > 0 && separator < 48) {
        const label = line.slice(0, separator)
        const value = line.slice(separator + 2)
        return `<p style="margin:0 0 10px"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`
      }
      return `<p style="margin:0 0 10px">${escapeHtml(line)}</p>`
    })
    .join('')
}

function renderHtml({ agentName, results, subject }) {
  const resultHtml = renderResultHtml(results)
  const generatedAt = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date())

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#F5F7FA;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1F2937">
  <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E9F0;border-radius:12px;overflow:hidden">
    <div style="padding:20px 24px;background:#4F46E5;color:#FFFFFF">
      <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">AgentForge</p>
      <h1 style="margin:6px 0 0;font-size:19px;font-weight:600">${escapeHtml(subject)}</h1>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 10px;font-size:14px;color:#374151">Hello,</p>
      <p style="margin:0 0 18px;font-size:14px;color:#4B5563">Your workflow <strong>${escapeHtml(agentName)}</strong> has completed successfully. The result is provided below.</p>
      <div style="padding:16px 18px;background:#F8FAFC;border:1px solid #E5E9F0;border-radius:8px;font-size:14px;line-height:1.6;color:#1F2937">
        ${resultHtml}
      </div>
      <p style="margin:18px 0 0;font-size:12px;color:#6B7280">Generated on ${escapeHtml(generatedAt)} IST.</p>
      <p style="margin:20px 0 0;font-size:14px;color:#374151">Regards,<br><strong>AgentForge</strong></p>
    </div>
    <div style="padding:14px 24px;border-top:1px solid #E5E9F0;font-size:12px;color:#9CA3AF">
      This message was generated automatically by your AgentForge workflow.
    </div>
  </div>
</body></html>`
}

/**
 * Sends an agent result email.
 *
 * Brevo's HTTPS API is preferred when BREVO_API_KEY and BREVO_FROM are
 * configured. This supports normal transactional recipients once the sender
 * address is verified in Brevo. Resend remains available as a fallback, while
 * SMTP remains available for local development and paid hosts.
 */
export async function sendWorkflowEmail({ to, workflow, subject }) {
  const results = (workflow?.results || []).map((result) => `${result.label}: ${result.value}`).join('\n') || 'The workflow completed successfully.'
  const agentName = workflow?.name || 'Agent'
  const resolvedSubject = subject || `Workflow completed: ${agentName}`
  const generatedAt = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date())
  const text = `Hello,

Your workflow "${agentName}" has completed successfully.

Result:
${results}

Generated on ${generatedAt} IST.

Regards,
AgentForge`
  const html = renderHtml({ agentName, results, subject: resolvedSubject })

  if (hasBrevo()) {
    const result = await sendViaBrevo({ to, subject: resolvedSubject, text, html })
    if (result) return result
  }

  if (hasResend()) {
    const result = await sendViaResend({ to, subject: resolvedSubject, text, html })
    if (result) return result
  }

  const mailer = getTransporter()
  if (!mailer) {
    console.log(`[Dev Mailer] Simulated email delivery to ${to}: ${resolvedSubject}\n${results}`)
    return { delivered: false, simulated: true, error: null }
  }

  try {
    await mailer.sendMail({
      from: process.env.RESET_EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject: resolvedSubject,
      text,
      html,
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
