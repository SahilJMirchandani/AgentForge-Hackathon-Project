import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'agentforge.json')
const source = JSON.parse(await readFile(file, 'utf8'))
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required')

const client = new MongoClient(process.env.MONGODB_URI, {
  maxPoolSize: 5,
  minPoolSize: 0,
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 5000,
})
await client.connect()
const database = client.db(process.env.MONGODB_DB || 'agentforge')
const collections = {
  users: Object.entries(source.users || {}).map(([email, user]) => ({ _id: email, ...user })),
  sessions: Object.entries(source.sessions || {}).map(([token, session]) => ({ _id: token, ...(typeof session === 'string' ? { email: session } : { ...session, expiresAt: session.expiresAt ? new Date(session.expiresAt) : undefined }) })),
  workflows: Object.entries(source.workflows || {}).map(([id, workflow]) => ({ _id: id, ...workflow })),
  notifications: Object.entries(source.notifications || {}).map(([email, items]) => ({ _id: email, email, items })),
  resetTokens: Object.entries(source.resetTokens || {}).map(([token, value]) => ({ _id: token, ...value, expiresAt: value.expiresAt ? new Date(value.expiresAt) : undefined })),
  oauthStates: Object.entries(source.oauthStates || {}).map(([state, value]) => ({ _id: state, ...value, expiresAt: value.expiresAt ? new Date(value.expiresAt) : undefined })),
}
for (const [name, documents] of Object.entries(collections)) {
  const collection = database.collection(name)
  if (documents.length) await collection.bulkWrite(documents.map((document) => ({ replaceOne: { filter: { _id: document._id }, replacement: document, upsert: true } })))
}
await database.collection('workflows').createIndex({ userId: 1, updatedAt: -1 })
await database.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
await database.collection('resetTokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
await client.close()
console.log('Migrated AgentForge file data to MongoDB.')