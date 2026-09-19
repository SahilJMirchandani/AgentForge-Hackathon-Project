import { createServer } from 'node:http'
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { closeDb, databaseStatus, loadDb, saveDb } from './db.js'
import { TEMPLATES, classifyPrompt } from '../src/data/templates.js'
import { evaluateWorkflow, generateWorkflow, geminiStatus } from './gemini.js'
import { mailStatus, sendPasswordResetEmail, sendTestEmail } from './mailer.js'
import { deliverNotification, extractDestinationFromPrompt, resolveChannel, validateDestination } from './notifications.js'
import { smsStatus } from './sms.js'
import { executeWorkflow } from './executor.js'
import { startScheduler } from './scheduler.js'
import { exchangeGoogleCode, googleAuthorizationUrl, googleConfigured, googleAuthLoginUrl, exchangeGoogleAuthCode, fetchGoogleUserInfo } from './oauth.js'
import { rateLimit } from './rate-limit.js'
import { getAppConfig, resolveAllowedOrigins } from './config.js'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const distRoot = join(projectRoot, 'dist')

function loadEnvFile() {
  try {
    if (existsSync('.env')) {
      const content = readFileSync('.env', 'utf8')
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim()
          const val = trimmed.slice(eqIdx + 1).trim()
          if (key && !process.env[key]) {
            process.env[key] = val
          }
        }
      }
    }
  } catch {}
}
loadEnvFile()

const appConfig = getAppConfig()
const PORT = Number(process.env.PORT || appConfig.port || 4000)
const HOST = process.env.HOST || appConfig.host || '127.0.0.1'
const CLIENT_ORIGIN = appConfig.allowedOrigins[0] || 'http://localhost:5173'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000
const db = await loadDb()
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 12 })
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 })

const sanitizeText = (value, maxLength = 200) => String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLength)
const normalizeEmail = (value) => sanitizeText(value, 254).toLowerCase()
const allowedOrigins = appConfig.allowedOrigins
const getAllowedOrigin = (requestOrigin) => (requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : null)

const json = (res, status, body, origin, extraHeaders = {}) => {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'vary': 'Origin',
    'x-frame-options': 'DENY',
    'content-security-policy': "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  }
  const responseOrigin = origin || (allowedOrigins.length === 1 ? allowedOrigins[0] : null)
  if (responseOrigin) {
    headers['access-control-allow-origin'] = responseOrigin
    headers['access-control-allow-headers'] = 'content-type, authorization'
    headers['access-control-allow-methods'] = 'GET,POST,PATCH,DELETE,OPTIONS'
  }
  res.writeHead(status, { ...headers, ...extraHeaders })
  res.end(JSON.stringify(body))
}
const publicUser = (user) => (user ? { id: user.id, name: user.name, email: user.email, emailNotifications: user.emailNotifications !== false } : null)
const publicWorkflow = (workflow) => { if (!workflow || typeof workflow !== 'object') return null; const { userId, ...safeWorkflow } = workflow; return safeWorkflow }
const hashPassword = (password, salt = randomBytes(16).toString('hex')) => ({ passwordSalt: salt, passwordHash: scryptSync(password, salt, 64).toString('hex') })
const validPassword = (password, user) => { if (!user?.passwordSalt || !user?.passwordHash) return false; const actual = scryptSync(password, user.passwordSalt, 64); const expected = Buffer.from(user.passwordHash, 'hex'); return actual.length === expected.length && timingSafeEqual(actual, expected) }
const readBody = async (req) => { let data = ''; for await (const chunk of req) { data += chunk; if (data.length > 1024 * 1024) { const error = new Error('Request body is too large'); error.status = 413; throw error } } return data ? JSON.parse(data) : {} }
const sessionKey = (token) => createHash('sha256').update(token).digest('hex')
const userFor = (req) => { const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); const key = sessionKey(token); const session = db.sessions[key] || db.sessions[token]; const email = typeof session === 'string' ? session : session?.expiresAt > Date.now() ? session.email : null; if (!email && session) delete db.sessions[key]; return email ? db.users[email] || null : null }
const requireUser = (req, res) => { const user = userFor(req); if (!user) json(res, 401, { error: 'Authentication required' }); return user }
const tokenFor = (email) => { const token = randomBytes(32).toString('hex'); db.sessions[sessionKey(token)] = { email, expiresAt: Date.now() + SESSION_TTL_MS }; return token }
const hashResetToken = (token) => createHash('sha256').update(token).digest('hex')
const notify = (user, title, message) => { if (!user?.email) return; const email = normalizeEmail(user.email); const list = db.notifications[email] || []; db.notifications[email] = [{ id: randomUUID(), title, message, read: false, createdAt: Date.now() }, ...list].slice(0, 50) }
const cookieValue = (req, name) => String(req.headers.cookie || '').split(';').map((part) => part.trim().split('=')) .find(([key]) => key === name)?.[1] || null
const cloneTemplate = (prompt, requestedId) => {
  const key = classifyPrompt(prompt) || (prompt.trim().length >= 8 ? 'email' : null); if (!key) return null
  const template = TEMPLATES[key]; const id = requestedId || `wf-${randomUUID()}`
  return { id, name: template.name, prompt, status: 'Draft', createdAt: Date.now(), duration: null, nodes: template.nodes.map((node) => ({ ...node, id: `${id}-${node.id}`, data: { ...node.data, ...(node.data.kind === 'notify' || node.data.kind === 'output' ? notificationDefaults(prompt, node.data) : {}), status: 'idle' } })), edges: template.edges.map((edge) => ({ ...edge, id: `${id}-${edge.id}`, source: `${id}-${edge.source}`, target: `${id}-${edge.target}` })), logSteps: template.logSteps, resultsTemplate: template.results, executionLog: [], executionHistory: [], isActive: true, isDeployed: false, webhookToken: null, results: null }
}

/**
 * Works out the channel and recipient for a notification node at creation time.
 * A destination the model (or template author) supplied wins; otherwise we look
 * for an address or number the user wrote into the prompt itself, so
 * "email me the summary at sahil@example.com" arrives pre-filled in the editor.
 */
function notificationDefaults(prompt, nodeData = {}) {
  const channel = resolveChannel(nodeData.channel, prompt)
  const supplied = String(nodeData.destination || '').trim()
  const destination = supplied && validateDestination(channel, supplied).ok
    ? supplied
    : extractDestinationFromPrompt(prompt, channel)
  return { channel, destination: destination || '' }
}

/** Rejects junk recipients before they are persisted on a workflow node. */
function sanitizeWorkflowNodes(nodes) {
  if (!Array.isArray(nodes)) return nodes
  for (const node of nodes) {
    const data = node?.data
    if (!data || (data.kind !== 'output' && data.kind !== 'notify')) continue
    const channel = resolveChannel(data.channel, '')
    const destination = String(data.destination || '').trim()
    const check = validateDestination(channel, destination)
    if (destination && !check.ok) {
      const error = new Error(check.error)
      error.status = 400
      throw error
    }
    data.channel = channel
    data.destination = destination.slice(0, 254)
  }
  return nodes
}

/**
 * Fallback sandbox score when the evaluator is unavailable. It is a structural
 * check of the graph, not a stand-in for a real evaluation, so it is reported
 * as `sandboxSource: 'heuristic'` and is capable of returning a low number.
 */
/**
 * Resolves a workflow's owner. `db.users` is keyed by email while `userId` is a
 * UUID, so a direct index lookup never matched. Falling back to "the first user
 * in the database" also used to let a webhook deliver another account's results.
 */
function ownerOf(workflow, database) {
  if (!workflow?.userId) return null
  return Object.values(database.users || {}).find((candidate) => candidate && (candidate.id === workflow.userId || candidate.email === workflow.userId)) || null
}

function staticScore(workflow) {
  const nodes = (workflow.nodes || []).map((node) => node.data || {})
  const kinds = new Set(nodes.map((data) => data.kind))
  const outputs = nodes.filter((data) => data.kind === 'output' || data.kind === 'notify')
  const unroutedOutputs = outputs.filter((data) => data.channel !== 'email' && !String(data.destination || '').trim())

  let reliability = 60
  if (kinds.has('trigger')) reliability += 15
  if (outputs.length) reliability += 15
  if ((workflow.edges || []).length >= nodes.length - 1) reliability += 10

  let security = 70
  if (!unroutedOutputs.length) security += 15
  if (nodes.every((data) => String(data.instructions || '').length <= 1000)) security += 15

  let toolCoverage = 55
  if (kinds.has('ai')) toolCoverage += 20
  if (kinds.has('condition')) toolCoverage += 10
  if (outputs.length) toolCoverage += 15

  const clamp = (value) => Math.max(0, Math.min(100, value))
  return { reliability: clamp(reliability), security: clamp(security), toolCoverage: clamp(toolCoverage) }
}

function buildWorkflow(prompt, generated, requestedId) {
  const id = requestedId || `wf-${randomUUID()}`
  const nodes = generated.nodes.map((node, index) => ({ id: `${id}-n${index + 1}`, type: 'workflow', position: { x: 40 + (index % 4) * 280, y: 140 + Math.floor(index / 4) * 180 }, data: { ...node, ...(node.kind === 'notify' || node.kind === 'output' ? notificationDefaults(prompt, node) : {}) } }))
  return { id, name: generated.name, prompt, status: 'Draft', createdAt: Date.now(), duration: null, nodes, edges: nodes.slice(1).map((node, index) => ({ id: `${id}-e${index + 1}`, source: nodes[index].id, target: node.id })), logSteps: [], resultsTemplate: [], executionLog: [], executionHistory: [], isActive: true, isDeployed: false, webhookToken: null, results: null, generation: 'gemini' }
}

function serveStaticFile(req, res, pathname) {
  const normalizedPath = pathname === '/' ? '/index.html' : pathname
  const requestedPath = normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath
  const filePath = join(distRoot, requestedPath)

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return false
  }

  const extension = extname(filePath).toLowerCase()
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  }

  res.writeHead(200, {
    'content-type': mimeTypes[extension] || 'application/octet-stream',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'content-security-policy': "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  })
  res.end(readFileSync(filePath))
  return true
}

async function handle(req, res) {
  const origin = req.headers.origin || ''
  const allowedOrigin = getAllowedOrigin(origin)

  if (req.method === 'OPTIONS') return json(res, 204, {}, allowedOrigin)

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const parts = url.pathname.split('/').filter(Boolean)

  if (process.env.NODE_ENV === 'production' && !url.pathname.startsWith('/api')) {
    const served = serveStaticFile(req, res, url.pathname)
    if (served) return
    if (url.pathname !== '/' && !url.pathname.startsWith('/assets/')) {
      const fallback = serveStaticFile(req, res, '/index.html')
      if (fallback) return
    }
  }

  try {
    if (!(url.pathname.startsWith('/api/auth/') ? authLimiter(req, res) : apiLimiter(req, res))) return
    if (req.method === 'POST' && url.pathname === '/api/auth/signup') {
      const { name, email, password } = await readBody(req); const normalized = normalizeEmail(email)
      const safeName = sanitizeText(name, 120)
      const safePassword = String(password || '')
      if (!safeName || !normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || safePassword.length < 6) return json(res, 400, { error: 'Name, email, and a password of at least 6 characters are required' })
      if (db.users[normalized]) return json(res, 409, { error: 'An account already exists for this email' })
      const user = { id: randomUUID(), name: safeName, email: normalized, ...hashPassword(safePassword), emailNotifications: true }; db.users[normalized] = user; db.notifications[normalized] = [{ id: randomUUID(), title: 'Welcome back', message: 'Your workspace is ready.', read: false, createdAt: Date.now() }]
      const token = tokenFor(normalized); await saveDb(db); return json(res, 201, { token, user: publicUser(user), workflows: [] })
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const { email, password } = await readBody(req); const normalized = normalizeEmail(email)
      const user = db.users[normalized]
      if (!user || !validPassword(String(password || ''), user)) return json(res, 401, { error: 'Invalid email or password' })
      const token = tokenFor(user.email); await saveDb(db); return json(res, 200, { token, user: publicUser(user), workflows: Object.values(db.workflows).filter((workflow) => workflow.userId === user.id).map(publicWorkflow), notifications: db.notifications[user.email] || [] })
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/reset') {
      const { email } = await readBody(req)
      const normalized = normalizeEmail(email)
      const user = db.users[normalized]
      if (user) {
        for (const [tokenHash, value] of Object.entries(db.resetTokens || {})) if (value.email === normalized) delete db.resetTokens[tokenHash]
        const token = randomBytes(32).toString('hex')
        db.resetTokens[hashResetToken(token)] = { email: normalized, expiresAt: Date.now() + RESET_TOKEN_TTL_MS }
        try { await sendPasswordResetEmail({ to: normalized, token }) } catch (error) { console.warn(`Password reset email failed: ${error.message}`) }
        await saveDb(db)
      }
      return json(res, 200, { message: 'If that account exists, a reset link has been sent.' })
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/reset/confirm') {
      const { token, password } = await readBody(req)
      const passwordValue = String(password || '')
      const reset = db.resetTokens?.[hashResetToken(String(token || ''))]
      if (!reset || reset.expiresAt <= Date.now() || passwordValue.length < 6) return json(res, 400, { error: 'This reset link is invalid or expired' })
      const user = db.users[reset.email]
      if (!user) return json(res, 400, { error: 'This reset link is invalid or expired' })
      Object.assign(user, hashPassword(passwordValue))
      delete db.resetTokens[hashResetToken(String(token))]
      for (const [sessionToken, session] of Object.entries(db.sessions)) { const sessionEmail = typeof session === 'string' ? session : session.email; if (sessionEmail === user.email) delete db.sessions[sessionToken] }
      await saveDb(db)
      return json(res, 200, { message: 'Password reset successfully' })
    }
    if ((req.method === 'GET' || req.method === 'POST') && url.pathname === '/api/auth/google') {
      if (!googleConfigured()) return json(res, 503, { error: 'Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.' }, allowedOrigin)
      const state = randomBytes(24).toString('hex')
      db.oauthStates[state] = { type: 'login', expiresAt: Date.now() + 10 * 60 * 1000 }
      await saveDb(db)
      const googleUrl = googleAuthLoginUrl(state)
      if (req.method === 'POST') {
        return json(res, 200, { url: googleUrl }, allowedOrigin, { 'set-cookie': `agentforge-google-auth-state=${state}; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=600` })
      }
      res.writeHead(302, {
        location: googleUrl,
        'set-cookie': `agentforge-google-auth-state=${state}; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=600`,
      })
      return res.end()
    }
    if (req.method === 'GET' && url.pathname === '/api/auth/google/callback') {
      const stateKey = url.searchParams.get('state')
      const state = db.oauthStates[stateKey]
      const errorParam = url.searchParams.get('error')
      if (errorParam) {
        res.writeHead(302, { location: `${CLIENT_ORIGIN.replace(/\/$/, '')}/login?error=${encodeURIComponent('Google sign-in was cancelled')}` })
        return res.end()
      }
      if (!state || state.expiresAt <= Date.now() || state.type !== 'login') {
        res.writeHead(302, { location: `${CLIENT_ORIGIN.replace(/\/$/, '')}/login?error=${encodeURIComponent('Google authentication state is invalid or expired')}` })
        return res.end()
      }
      try {
        const code = url.searchParams.get('code')
        if (!code) throw new Error('Authorization code missing from Google callback')
        const tokenResult = await exchangeGoogleAuthCode(code)
        const googleUser = await fetchGoogleUserInfo(tokenResult.access_token)
        const normalized = normalizeEmail(googleUser.email)
        let user = db.users[normalized]
        if (!user) {
          user = {
            id: randomUUID(),
            name: sanitizeText(googleUser.name, 120),
            email: normalized,
            googleId: googleUser.id,
            emailNotifications: true,
          }
          db.users[normalized] = user
          db.notifications[normalized] = [{ id: randomUUID(), title: 'Welcome to AgentForge', message: 'Signed in with Google successfully.', read: false, createdAt: Date.now() }]
        } else {
          user.googleId = googleUser.id
          if (googleUser.name && !user.name) user.name = sanitizeText(googleUser.name, 120)
        }
        delete db.oauthStates[stateKey]
        const token = tokenFor(normalized)
        await saveDb(db)
        res.writeHead(302, { location: `${CLIENT_ORIGIN.replace(/\/$/, '')}/dashboard` })
        return res.end()
      } catch (error) {
        console.error(`Google Auth Callback Error: ${error.message}`)
        res.writeHead(302, { location: `${CLIENT_ORIGIN.replace(/\/$/, '')}/login?error=${encodeURIComponent(error.message || 'Google sign-in failed')}` })
        return res.end()
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true }, allowedOrigin)
    if (req.method === 'GET' && url.pathname === '/api/ready') { const database = databaseStatus(); const ready = !database.configured || database.provider === 'mongodb'; return json(res, ready ? 200 : 503, { ok: ready }, allowedOrigin) }
    if (req.method === 'GET' && url.pathname === '/api/integrations/google/callback') {
      const stateKey = url.searchParams.get('state')
      const state = db.oauthStates[stateKey]
      if (!state || state.expiresAt <= Date.now()) return json(res, 400, { error: 'Google connection state is invalid or expired' }, allowedOrigin)
      if (cookieValue(req, 'agentforge-google-state') !== stateKey) return json(res, 400, { error: 'Google connection state is invalid' }, allowedOrigin)
      if (url.searchParams.get('error')) return json(res, 400, { error: 'Google connection was cancelled' }, allowedOrigin)
      const user = db.users[state.email]
      if (!user) return json(res, 404, { error: 'Account not found' }, allowedOrigin)
      user.googleOAuth = await exchangeGoogleCode(url.searchParams.get('code'))
      delete db.oauthStates[url.searchParams.get('state')]
      await saveDb(db)
      res.writeHead(302, { location: `${CLIENT_ORIGIN.replace(/\/$/, '')}/settings?google=connected` })
      return res.end()
    }
    if (['GET', 'POST'].includes(req.method) && parts[1] === 'hooks' && parts[2]) {
      const hookToken = parts[2]
      let workflow = Object.values(db.workflows || {}).find((candidate) => candidate && candidate.webhookToken === hookToken)
      if (!workflow) {
        workflow = Object.values(db.workflows || {}).find((candidate) => candidate && (candidate.id === hookToken || candidate.id === `wf-${hookToken}`))
      }
      if (!workflow || !workflow.isDeployed) return json(res, 404, { error: `Deployed agent with webhook token '${hookToken}' was not found.` }, allowedOrigin)
      if (workflow.isActive === false) return json(res, 409, { error: 'This agent is disabled' }, allowedOrigin)

      if (req.method === 'GET') {
        const publicApiOrigin = appConfig.publicApiOrigin || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
        const webhookEndpoint = `${publicApiOrigin.replace(/\/$/, '')}/api/hooks/${workflow.webhookToken}`
        return json(res, 200, {
          ok: true,
          agent: workflow.name,
          prompt: workflow.prompt,
          status: 'Live',
          webhookToken: workflow.webhookToken,
          message: 'This live agent webhook endpoint is ready. Send a POST request with a JSON body to run this agent.',
          exampleCurl: `curl -X POST "${webhookEndpoint}" -H "Content-Type: application/json" -d '{"input": "${workflow.prompt || 'test event'}"}'`,
        }, allowedOrigin)
      }

      const input = await readBody(req).catch(() => ({}))
      const owner = ownerOf(workflow, db)
      if (!owner) return json(res, 409, { error: 'This agent has no owner account to deliver results to' }, allowedOrigin)
      const run = await executeWorkflow(workflow, owner, input)
      notify(owner, run.status === 'Completed' ? 'Agent run completed' : 'Agent run failed', run.status === 'Completed' ? `${workflow.name} processed a webhook event.` : run.error)
      await saveDb(db)
      return json(res, run.status === 'Completed' ? 200 : 422, { run, workflow: publicWorkflow(workflow) }, allowedOrigin)
    }
    const user = requireUser(req, res); if (!user) return
    if (req.method === 'GET' && url.pathname === '/api/integrations') return json(res, 200, { google: { configured: googleConfigured(), connected: Boolean(user.googleOAuth) }, slack: { configured: true } })
    if (req.method === 'POST' && url.pathname === '/api/integrations/google/connect') { if (!googleConfigured()) return json(res, 503, { error: 'Google OAuth is not configured on the server' }); const state = randomBytes(24).toString('hex'); db.oauthStates[state] = { email: user.email, expiresAt: Date.now() + 10 * 60 * 1000 }; await saveDb(db); return json(res, 200, { url: googleAuthorizationUrl(state) }, allowedOrigin, { 'set-cookie': `agentforge-google-state=${state}; HttpOnly; SameSite=Lax; Path=/api/integrations/google; Max-Age=600` }) }
    if (req.method === 'DELETE' && url.pathname === '/api/integrations/google') { delete user.googleOAuth; await saveDb(db); return json(res, 200, { ok: true }) }
    if (req.method === 'GET' && url.pathname === '/api/me') return json(res, 200, { user: publicUser(user), workflows: Object.values(db.workflows).filter((workflow) => workflow.userId === user.id).map(publicWorkflow), notifications: db.notifications[user.email] || [] })
    if (req.method === 'POST' && url.pathname === '/api/auth/logout') { const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); delete db.sessions[sessionKey(token)]; delete db.sessions[token]; await saveDb(db); return json(res, 200, { ok: true }) }
    if (req.method === 'GET' && url.pathname === '/api/templates') return json(res, 200, { templates: Object.entries(TEMPLATES).map(([key, template]) => ({ key, name: template.name, nodes: template.nodes, edges: template.edges })) })
    if (req.method === 'GET' && url.pathname === '/api/workflows') return json(res, 200, { workflows: Object.values(db.workflows).filter((workflow) => workflow.userId === user.id).map(publicWorkflow) })
    if (req.method === 'POST' && url.pathname === '/api/workflows') { const { prompt, id } = await readBody(req); const text = String(prompt || '').trim(); if (text.length < 8) return json(res, 422, { error: 'Describe the workflow in at least 8 characters' }); let workflow = null; let generationWarning = null; try { const generated = await generateWorkflow(text); if (generated) workflow = buildWorkflow(text, generated, id); else if (geminiStatus().configured) generationWarning = 'The AI model returned an unusable workflow, so a matching template was used instead.' } catch (error) { console.warn(`Gemini generation failed: ${error.message}`); generationWarning = `AI generation failed (${error.message}), so a matching template was used instead.` } if (!workflow && !geminiStatus().configured) generationWarning = 'GEMINI_API_KEY is not set, so a matching template was used instead of AI generation.'; workflow ||= cloneTemplate(text, id); if (!workflow) return json(res, 422, { error: 'Unable to create a valid workflow from that prompt' }); workflow.generation ||= 'template'; if (db.workflows[workflow.id]) { workflow.id = `wf-${randomUUID()}` } workflow.userId = user.id; db.workflows[workflow.id] = workflow; notify(user, 'Workflow created', `"${workflow.name}" is ready to edit and run.`); await saveDb(db); return json(res, 201, { workflow: publicWorkflow(workflow), notifications: db.notifications[user.email], generation: workflow.generation, warning: generationWarning }) }
    const workflowId = parts[2]; let workflow = db.workflows[workflowId]; if (workflow && workflow.userId !== user.id) return json(res, 404, { error: 'Workflow not found' })
    if (parts[1] === 'workflows' && req.method === 'GET' && workflow) return json(res, 200, { workflow: publicWorkflow(workflow) })
    if (parts[1] === 'workflows' && req.method === 'DELETE') {
      if (!workflow) return json(res, 404, { error: 'Workflow not found' })
      delete db.workflows[workflowId]; notify(user, 'Workflow removed', 'The workflow was successfully deleted.'); await saveDb(db); return json(res, 200, { ok: true, notifications: db.notifications[user.email] })
    }
    if (parts[1] === 'workflows' && req.method === 'PATCH') {
      const body = await readBody(req)
      if (!workflow) {
        if (!body || typeof body !== 'object' || !body.name) return json(res, 404, { error: 'Workflow not found' })
        workflow = {
          id: workflowId,
          name: body.name || 'Untitled Agent',
          prompt: body.prompt || '',
          status: body.status || 'Draft',
          createdAt: body.createdAt || Date.now(),
          duration: body.duration || null,
          nodes: Array.isArray(body.nodes) ? body.nodes : [],
          edges: Array.isArray(body.edges) ? body.edges : [],
          logSteps: body.logSteps || [],
          resultsTemplate: body.resultsTemplate || [],
          executionLog: body.executionLog || [],
          executionHistory: body.executionHistory || [],
          isActive: body.isActive !== false,
          isDeployed: body.isDeployed === true,
          webhookToken: body.webhookToken || null,
          results: body.results || null,
          userId: user.id,
        }
        db.workflows[workflowId] = workflow
      } else {
        const allowedFields = ['name', 'prompt', 'nodes', 'edges', 'isActive', 'isDeployed', 'webhookToken', 'status', 'duration', 'sandboxScore', 'sandboxTests', 'results', 'executionLog', 'executionHistory']
        if (body.nodes !== undefined) sanitizeWorkflowNodes(body.nodes)
        for (const field of allowedFields) if (body[field] !== undefined) workflow[field] = body[field]
        workflow.updatedAt = Date.now()
      }
      await saveDb(db)
      return json(res, 200, { workflow: publicWorkflow(workflow) })
    }
    if (parts[1] === 'workflows' && parts[3] === 'run' && req.method === 'POST') {
      if (!workflow) return json(res, 404, { error: 'Workflow not found' })
      const body = await readBody(req); const run = await executeWorkflow(workflow, user, body.input ?? body); notify(user, run.status === 'Completed' ? 'Agent run completed' : 'Agent run failed', run.status === 'Completed' ? `${workflow.name} processed your input.` : run.error); await saveDb(db); return json(res, run.status === 'Completed' ? 200 : 422, { workflow: publicWorkflow(workflow), notifications: db.notifications[user.email], run })
    }
    if (parts[1] === 'workflows' && parts[3] === 'deploy' && req.method === 'POST') {
      const body = await readBody(req).catch(() => ({}))
      if (!workflow) {
        workflow = {
          id: workflowId,
          name: body.name || 'Agent',
          prompt: body.prompt || 'Automation agent',
          status: body.status || 'Draft',
          createdAt: body.createdAt || Date.now(),
          duration: body.duration || null,
          nodes: Array.isArray(body.nodes) ? body.nodes : [],
          edges: Array.isArray(body.edges) ? body.edges : [],
          logSteps: body.logSteps || [],
          resultsTemplate: body.resultsTemplate || [],
          executionLog: body.executionLog || [],
          executionHistory: body.executionHistory || [],
          isActive: true,
          isDeployed: true,
          webhookToken: body.webhookToken || randomBytes(32).toString('hex'),
          results: body.results || null,
          userId: user.id,
        }
        db.workflows[workflowId] = workflow
      }
      workflow.isDeployed = true; workflow.isActive = true; workflow.webhookToken ||= randomBytes(32).toString('hex'); notify(user, 'Agent deployed', `${workflow.name} is live and ready to receive webhook events.`); await saveDb(db); const publicApiOrigin = appConfig.publicApiOrigin || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`; const webhookUrl = `${publicApiOrigin.replace(/\/$/, '')}/api/hooks/${workflow.webhookToken}`; return json(res, 200, { workflow: publicWorkflow(workflow), notifications: db.notifications[user.email], webhookUrl }, allowedOrigin)
    }
    if (parts[1] === 'workflows' && parts[3] === 'sandbox' && req.method === 'POST' && workflow) { let evaluation = null; try { evaluation = await evaluateWorkflow(workflow) } catch (error) { console.warn(error.message) } if (evaluation) { workflow.sandboxScore = evaluation.score; workflow.sandboxTests = evaluation.tests; workflow.sandboxSource = 'gemini' } else { workflow.sandboxScore = staticScore(workflow); workflow.sandboxTests = []; workflow.sandboxSource = 'heuristic' } await saveDb(db); return json(res, 200, { workflow: publicWorkflow(workflow), sandboxSource: workflow.sandboxSource }) }
    if (req.method === 'PATCH' && url.pathname === '/api/profile') { const body = await readBody(req); const oldEmail = user.email; const email = normalizeEmail(body.email || oldEmail); const name = sanitizeText(body.name || user.name, 120); if (!/^\S+@\S+\.\S+$/.test(email) || !name) return json(res, 400, { error: 'A valid email and name are required' }); if (email !== oldEmail && db.users[email]) return json(res, 409, { error: 'That email is already in use' }); delete db.users[oldEmail]; user.email = email; user.name = name; db.users[email] = user; if (db.notifications[oldEmail]) { db.notifications[email] = db.notifications[oldEmail]; delete db.notifications[oldEmail] } for (const [token, session] of Object.entries(db.sessions)) { const sessionEmail = typeof session === 'string' ? session : session.email; if (sessionEmail === oldEmail) db.sessions[token] = { email, expiresAt: typeof session === 'string' ? Date.now() + SESSION_TTL_MS : session.expiresAt } } await saveDb(db); return json(res, 200, { user: publicUser(user) }) }
    if (req.method === 'GET' && url.pathname === '/api/notifications/status') return json(res, 200, { email: mailStatus(), sms: smsStatus() }, allowedOrigin)
    if (req.method === 'POST' && url.pathname === '/api/notifications/test') {
      const body = await readBody(req)
      const channel = resolveChannel(body.channel, '')
      const destination = sanitizeText(body.destination, 254)
      const check = validateDestination(channel, destination)
      if (!check.ok) return json(res, 400, { error: check.error }, allowedOrigin)
      const result = destination
        ? await deliverNotification({
            node: { data: { channel, destination, subject: 'AgentForge test notification' } },
            user,
            workflow: { name: sanitizeText(body.workflowName, 120) || 'Test notification' },
            output: 'This is a test notification. If you received it, this agent can reach you at this address.',
          })
        : { ...(await sendTestEmail({ to: user.email })), channel: 'email', to: user.email }
      if (result.error) return json(res, 502, { error: result.error }, allowedOrigin)
      return json(res, 200, {
        delivered: result.delivered,
        simulated: Boolean(result.simulated),
        channel: result.channel,
        to: result.to,
        message: result.delivered
          ? `Test notification sent to ${result.to}.`
          : `${result.channel === 'email' ? 'SMTP' : result.channel === 'sms' ? 'The SMS provider' : 'Slack'} is not configured on the server, so the message was written to the server log instead of being sent.`,
      }, allowedOrigin)
    }
    if (req.method === 'PATCH' && url.pathname === '/api/preferences') { const { emailNotifications } = await readBody(req); user.emailNotifications = emailNotifications === true; await saveDb(db); return json(res, 200, { user: publicUser(user) }) }
    if (req.method === 'PATCH' && url.pathname === '/api/notifications/read') { db.notifications[user.email] = (db.notifications[user.email] || []).map((notification) => ({ ...notification, read: true })); await saveDb(db); return json(res, 200, { notifications: db.notifications[user.email] }) }
    return json(res, 404, { error: 'Route not found' })
  } catch (error) { const status = error instanceof SyntaxError ? 400 : error.status || 500; if (status >= 500) console.error(error); return json(res, status, { error: error instanceof SyntaxError ? 'Malformed JSON request' : status >= 500 ? 'Internal server error' : error.message || 'Request failed' }, allowedOrigin) }
}

const scheduler = startScheduler({ db, executeWorkflow, saveDb, notify })
const server = createServer(handle)

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`[AgentForge Backend] Server is already active on http://${HOST}:${PORT}`)
    process.exit(0)
  } else {
    console.error('[AgentForge Backend] Server error:', error)
    process.exit(1)
  }
})

server.listen(PORT, HOST, () => console.log(`AgentForge API listening at http://${HOST}:${PORT}`))
server.requestTimeout = 120000
server.headersTimeout = 15000
server.keepAliveTimeout = 5000
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { scheduler.stop(); await server.close(); await closeDb(); process.exit(0) })