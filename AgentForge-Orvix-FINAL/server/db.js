import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
const DATA_FILE = path.join(DATA_DIR, 'agentforge.json')
const EMPTY_DB = { users: {}, sessions: {}, workflows: {}, notifications: {}, resetTokens: {}, oauthStates: {} }
let writeQueue = Promise.resolve()
let mongoClient = null
let mongoDatabase = null
let mongoSnapshot = structuredClone(EMPTY_DB)

function mongoOptions() {
  return {
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 20),
    minPoolSize: 0,
    maxIdleTimeMS: 300000,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
  }
}

async function loadMongoState() {
  try {
    mongoClient = new MongoClient(process.env.MONGODB_URI, mongoOptions())
    await mongoClient.connect()
    mongoDatabase = mongoClient.db(process.env.MONGODB_DB || 'agentforge')
    await Promise.all([
      mongoDatabase.collection('workflows').createIndex({ userId: 1, updatedAt: -1 }),
      mongoDatabase.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      mongoDatabase.collection('resetTokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ])
    const [users, sessions, workflows, notifications, resetTokens, oauthStates] = await Promise.all([
      mongoDatabase.collection('users').find({}).toArray(),
      mongoDatabase.collection('sessions').find({}).toArray(),
      mongoDatabase.collection('workflows').find({}).toArray(),
      mongoDatabase.collection('notifications').find({}).toArray(),
      mongoDatabase.collection('resetTokens').find({}).toArray(),
      mongoDatabase.collection('oauthStates').find({}).toArray(),
    ])
    const state = {
      users: Object.fromEntries(users.map(({ _id, ...user }) => [user.email || _id, user])),
      sessions: Object.fromEntries(sessions.map(({ _id, ...session }) => [_id, session.email ? session : session])),
      workflows: Object.fromEntries(workflows.map(({ _id, ...workflow }) => [workflow.id || _id, workflow])),
      notifications: Object.fromEntries(notifications.map(({ _id, ...notification }) => [notification.email || _id, notification.items || []])),
      resetTokens: Object.fromEntries(resetTokens.map(({ _id, ...token }) => [_id, token])),
      oauthStates: Object.fromEntries(oauthStates.map(({ _id, ...state }) => [_id, state])),
    }
    mongoSnapshot = structuredClone(state)
    return state
  } catch (error) {
    if (process.env.NODE_ENV === 'production') throw new Error(`MongoDB is required in production but unavailable: ${error.message}`)
    console.warn(`MongoDB unavailable, falling back to file storage: ${error.message}`)
    mongoClient = null
    mongoDatabase = null
    return structuredClone(EMPTY_DB)
  }
}

function sanitizeDbState(state) {
  const clean = {
    users: {},
    sessions: {},
    workflows: {},
    notifications: {},
    resetTokens: {},
    oauthStates: {},
    ...(state || {}),
  }
  for (const key of ['users', 'sessions', 'workflows', 'notifications', 'resetTokens', 'oauthStates']) {
    const rawMap = clean[key] || {}
    clean[key] = Object.fromEntries(
      Object.entries(rawMap).filter(([, val]) => val != null && typeof val === 'object' || typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean')
    )
  }
  return clean
}

export async function loadDb() {
  if (process.env.MONGODB_URI) {
    const mongoState = await loadMongoState()
    if (mongoDatabase) return sanitizeDbState(mongoState)
    const fileState = await loadFileState()
    return sanitizeDbState({ ...EMPTY_DB, ...fileState })
  }
  return sanitizeDbState(await loadFileState())
}

async function loadFileState() {
  try { return { ...EMPTY_DB, ...JSON.parse(await readFile(DATA_FILE, 'utf8')) } }
  catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`Database file cannot be read: ${error.message}`)
    await saveDb(EMPTY_DB)
    return structuredClone(EMPTY_DB)
  }
}

function persistedCollections(state) {
  return {
    users: Object.entries(state.users || {}).map(([email, user]) => ({ _id: email, ...user })),
    sessions: Object.entries(state.sessions || {}).map(([token, session]) => ({
      _id: token,
      ...(typeof session === 'string'
        ? { email: session }
        : { ...session, expiresAt: session?.expiresAt ? new Date(session.expiresAt) : undefined }),
    })),
    workflows: Object.entries(state.workflows || {}).map(([id, workflow]) => ({ _id: id, ...workflow })),
    notifications: Object.entries(state.notifications || {}).map(([email, items]) => ({ _id: email, email, items })),
    resetTokens: Object.entries(state.resetTokens || {}).map(([token, value]) => ({
      _id: token,
      ...value,
      expiresAt: value?.expiresAt ? new Date(value.expiresAt) : undefined,
    })),
    oauthStates: Object.entries(state.oauthStates || {}).map(([stateKey, value]) => ({
      _id: stateKey,
      ...value,
      expiresAt: value?.expiresAt ? new Date(value.expiresAt) : undefined,
    })),
  }
}

function documentKey(document) {
  return document?._id
}

function documentsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export async function saveDb(db) {
  const safeDb = structuredClone(sanitizeDbState(db))
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    if (mongoDatabase) {
      try {
        const collections = persistedCollections(safeDb)
      const previousCollections = persistedCollections(mongoSnapshot)
        for (const [name, documents] of Object.entries(collections)) {
          const collection = mongoDatabase.collection(name)
          const currentById = new Map(documents.map((document) => [documentKey(document), document]))
          const previousById = new Map((previousCollections[name] || []).map((document) => [documentKey(document), document]))

          const removedIds = [...previousById.keys()].filter((id) => !currentById.has(id))
          if (removedIds.length) await collection.deleteMany({ _id: { $in: removedIds } })

          const changedDocuments = documents.filter((document) => !documentsEqual(document, previousById.get(documentKey(document))))
          if (changedDocuments.length) {
            await collection.bulkWrite(
              changedDocuments.map((document) => ({
                replaceOne: {
                  filter: { _id: document._id },
                  replacement: document,
                  upsert: true,
                },
              })),
              { ordered: false },
            )
          }
        }
        mongoSnapshot = structuredClone(safeDb)
        return
      } catch (error) {
        if (process.env.NODE_ENV === 'production') throw new Error(`MongoDB write failed: ${error.message}`)
        console.warn(`MongoDB write failed, switching to file storage: ${error.message}`)
        mongoClient = null
        mongoDatabase = null
      }
    }
    try {
      await mkdir(DATA_DIR, { recursive: true })
      const temporaryFile = `${DATA_FILE}.tmp`
      await writeFile(temporaryFile, JSON.stringify(safeDb, null, 2), 'utf8')
      const { rename } = await import('node:fs/promises')
      try {
        await rename(temporaryFile, DATA_FILE)
      } catch (renameError) {
        if (['EPERM', 'EBUSY', 'EACCES'].includes(renameError.code)) {
          await writeFile(DATA_FILE, JSON.stringify(safeDb, null, 2), 'utf8')
        } else {
          throw renameError
        }
      }
    } catch (fsError) {
      console.warn(`File storage write warning: ${fsError.message}`)
    }
  })
  return writeQueue
}

export function databaseStatus() {
  return { provider: mongoDatabase ? 'mongodb' : 'file', configured: Boolean(process.env.MONGODB_URI), database: process.env.MONGODB_DB || 'agentforge' }
}

export async function closeDb() {
  await mongoClient?.close()
  mongoClient = null
  mongoDatabase = null
  mongoSnapshot = structuredClone(EMPTY_DB)
}