import * as schema from './schema'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

if (!process.env.DB_URL) throw new Error('DB_URL is required')

const queryClient = postgres(process.env.DB_URL)
export const db = drizzle(queryClient, { schema })
