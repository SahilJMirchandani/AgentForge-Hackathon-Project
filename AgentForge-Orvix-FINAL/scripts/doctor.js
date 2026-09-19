#!/usr/bin/env node
// npm run doctor
//
// Verifies that every external service AgentForge depends on is actually
// reachable with the credentials in .env. Each check makes a real request and
// reports exactly what came back, so a misconfiguration is visible here instead
// of showing up as a silently "simulated" notification at run time.

import { existsSync, readFileSync } from 'node:fs'
import nodemailer from 'nodemailer'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim()
      if (key && !process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim()
    }
  }
}

const PASS = '\u001b[32mPASS\u001b[0m'
const FAIL = '\u001b[31mFAIL\u001b[0m'
const SKIP = '\u001b[33mSKIP\u001b[0m'
const results = []

function report(name, status, detail) {
  results.push({ name, status })
  console.log(`${status}  ${name}${detail ? `\n      ${String(detail).replace(/\n/g, '\n      ')}` : ''}`)
}

async function withTimeout(promise, ms, label) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms) }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function checkSmtp() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    return report('SMTP (email notifications)', SKIP, 'SMTP_HOST / SMTP_USER / SMTP_PASSWORD not all set - emails will be logged, not sent.')
  }
  if (!/^[\w.-]+$/.test(SMTP_HOST)) {
    return report('SMTP (email notifications)', FAIL, `SMTP_HOST="${SMTP_HOST}" is not a hostname. For Gmail use: smtp.gmail.com`)
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  })
  try {
    await withTimeout(transporter.verify(), 25000, 'SMTP verify')
    report('SMTP (email notifications)', PASS, `Authenticated with ${SMTP_HOST}:${SMTP_PORT || 587} as ${SMTP_USER}`)
    const to = process.argv[2]
    if (to) {
      await transporter.sendMail({
        from: process.env.RESET_EMAIL_FROM || SMTP_USER,
        to,
        subject: 'AgentForge doctor test',
        text: 'If you are reading this, AgentForge can send agent notifications from this account.',
      })
      report('SMTP test message', PASS, `Sent to ${to} - check the inbox (and spam).`)
    }
  } catch (error) {
    const hint = /Invalid login|Username and Password not accepted|535/i.test(error.message)
      ? '\nGmail needs a 16-character App Password (2-Step Verification must be on), not your account password.'
      : ''
    report('SMTP (email notifications)', FAIL, error.message + hint)
  } finally {
    transporter.close?.()
  }
}

async function checkGemini() {
  const key = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash'
  if (!key) return report('Gemini (AI workflow generation)', SKIP, 'GEMINI_API_KEY not set - prompts fall back to keyword templates.')

  

  try {
    const listing = await withTimeout(
      fetch('https://generativelanguage.googleapis.com/v1beta/models', { headers: { 'x-goog-api-key': key, 'x-goog-api-client': 'agentforge-orvix/1.0' } }),
      20000,
      'Gemini model list',
    )
    if (!listing.ok) {
      const body = await listing.text().catch(() => '')
      return report('Gemini (AI workflow generation)', FAIL, `Model list returned ${listing.status}. ${body.slice(0, 300)}`)
    }
    const payload = await listing.json()
    const names = (payload.models || [])
      .filter((entry) => (entry.supportedGenerationMethods || []).includes('generateContent'))
      .map((entry) => entry.name.replace(/^models\//, ''))

    report('Gemini API key', PASS, `${names.length} generateContent models available to this key.`)

    if (names.includes(model)) {
      report(`Gemini model "${model}"`, PASS, 'Configured model exists.')
    } else {
      const suggestions = names.filter((name) => name.includes('flash')).slice(0, 6)
      report(`Gemini model "${model}"`, FAIL, `Not available to this key. Set GEMINI_MODEL to one of:\n${suggestions.join('\n') || names.slice(0, 6).join('\n')}`)
    }
  } catch (error) {
    report('Gemini (AI workflow generation)', FAIL, error.message)
  }
}

async function checkTwilio() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    return report('Twilio (SMS notifications)', SKIP, 'TWILIO_* not all set - SMS nodes will be logged, not sent.')
  }
  const auth = `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`
  try {
    const account = await withTimeout(
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}.json`, { headers: { authorization: auth } }),
      20000,
      'Twilio account lookup',
    )
    if (!account.ok) {
      const body = await account.text().catch(() => '')
      return report('Twilio credentials', FAIL, `Account lookup returned ${account.status}. ${body.slice(0, 300)}`)
    }
    const details = await account.json()
    report('Twilio credentials', PASS, `Account "${details.friendly_name}" is ${details.status}.${details.type === 'Trial' ? ' Trial accounts can only text verified numbers.' : ''}`)

    const numbers = await withTimeout(
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}/IncomingPhoneNumbers.json`, { headers: { authorization: auth } }),
      20000,
      'Twilio number list',
    )
    if (numbers.ok) {
      const owned = (await numbers.json()).incoming_phone_numbers || []
      const match = owned.find((entry) => entry.phone_number === TWILIO_FROM_NUMBER)
      if (match) {
        const sms = match.capabilities?.sms
        report(`Twilio number ${TWILIO_FROM_NUMBER}`, sms ? PASS : FAIL, sms ? 'Owned by this account and SMS-capable.' : 'Owned by this account but not SMS-capable.')
      } else {
        report(`Twilio number ${TWILIO_FROM_NUMBER}`, FAIL, `Not owned by this account. Owned numbers: ${owned.map((entry) => entry.phone_number).join(', ') || '(none)'}`)
      }
    }
  } catch (error) {
    report('Twilio (SMS notifications)', FAIL, error.message)
  }
}

console.log('\nAgentForge doctor - checking external services\n')
await checkSmtp()
console.log()
await checkGemini()
console.log()
await checkTwilio()

const failed = results.filter((entry) => entry.status === FAIL).length
console.log(`\n${results.length - failed}/${results.length} checks passed.`)
if (!process.argv[2]) console.log('Tip: pass an email address to also send a real test message, e.g. npm run doctor -- you@gmail.com')
process.exit(failed ? 1 : 0)
