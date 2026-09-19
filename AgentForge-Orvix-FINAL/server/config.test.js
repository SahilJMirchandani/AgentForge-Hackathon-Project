import { describe, expect, it } from 'vitest'
import { resolveAllowedOrigins, getAppConfig } from './config.js'

describe('app configuration', () => {
  it('parses configured origins from a comma-separated environment value', () => {
    const origins = resolveAllowedOrigins('https://app.example.com,https://admin.example.com,http://localhost:5173')

    expect(origins).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
      'http://localhost:5173',
    ])
  })

  it('exposes a safe default app config', () => {
    const config = getAppConfig()

    expect(config.port).toBe(4000)
    expect(config.host).toBe('127.0.0.1')
    expect(config.environment).toMatch(/^(development|test|production)$/)
    expect(Array.isArray(config.allowedOrigins)).toBe(true)
  })
})
