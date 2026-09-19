import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('mongodb', () => ({
  MongoClient: class {
    constructor() {
      this.connected = false
    }

    async connect() {
      this.connected = true
      throw new Error('MongoDB unavailable')
    }

    db() {
      return {
        collection() {
          return {
            createIndex: async () => {},
            find: () => ({ toArray: async () => [] }),
            deleteMany: async () => {},
            insertMany: async () => {},
          }
        },
      }
    }

    async close() {
      this.connected = false
    }
  },
}))

const { loadDb, databaseStatus } = await import('./db.js')

describe('database fallback handling', () => {
  beforeEach(() => {
    process.env.MONGODB_URI = 'mongodb://invalid-host:27017/agentforge'
    process.env.MONGODB_DB = 'agentforge'
  })

  it('falls back to the file database when MongoDB is unavailable', async () => {
    const state = await loadDb()

    expect(typeof state.users).toBe('object')
    expect(typeof state.workflows).toBe('object')
    expect(databaseStatus()).toMatchObject({
      configured: true,
      provider: 'file',
      database: 'agentforge',
    })
  })
})
