const API_URL = import.meta.env.VITE_API_URL || '/api'

export function getApiUrl(path = '') {
  return `${API_URL.replace(/\/$/, '')}${path}`
}

export function getApiToken() { return localStorage.getItem('agentforge-api-token') || sessionStorage.getItem('agentforge-api-token') }
export function setApiToken(token, persistent = true) {
  localStorage.removeItem('agentforge-api-token')
  sessionStorage.removeItem('agentforge-api-token')
  if (token) (persistent ? localStorage : sessionStorage).setItem('agentforge-api-token', token)
}

function buildHeaders(options = {}) {
  const headers = { ...(options.headers || {}) }
  const hasBody = typeof options.body === 'string' && options.body.length > 0
    || options.body != null && typeof options.body !== 'string'

  if (hasBody && !headers['content-type']) headers['content-type'] = 'application/json'
  if (getApiToken() && !headers.authorization) headers.authorization = `Bearer ${getApiToken()}`
  return headers
}

export async function apiRequest(path, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000)
  const { timeoutMs, ...requestOptions } = options
  let response
  try {
    try {
      response = await fetch(getApiUrl(path), {
        ...requestOptions,
        credentials: requestOptions.credentials || 'include',
        signal: requestOptions.signal || controller.signal,
        headers: buildHeaders(requestOptions),
        body: requestOptions.body && typeof requestOptions.body !== 'string' ? JSON.stringify(requestOptions.body) : requestOptions.body,
      })
    } catch (networkError) {
      if (networkError.name === 'AbortError') {
        throw new Error('The request is taking longer than expected. Please wait a moment and try again.')
      }
      const error = new Error('Backend server connection refused. Ensure the backend server is running (npm run dev).')
      error.status = 503
      throw error
    }
    const text = await response.text()
    let payload = {}
    if (text) {
      try { payload = JSON.parse(text) } catch { payload = {} }
    }

    if (!response.ok) {
      const errorMessage = payload.error || payload.run?.error || payload.message || `Request failed (${response.status})`
      const error = new Error(errorMessage)
      error.status = response.status
      error.payload = payload
      throw error
    }

    return payload
  } finally {
    clearTimeout(timeout)
  }
}