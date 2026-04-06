import { sql } from 'drizzle-orm'
import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

const defaultColumns = () => ({
	id: text('id').notNull().primaryKey(),
	createdAt: timestamp('created_at')
		.notNull()
		.default(sql`now()`),
	updatedAt: timestamp('updated_at')
		.notNull()
		.default(sql`now()`)
		.$onUpdateFn(() => new Date())
})

export const tChapters = pgTable('chapters', {
	...defaultColumns(),
	title: text('title'),
	volume: text('volume'),
	chapter: text('chapter'),
	publishedAt: timestamp('published_at').notNull(),
	translatedLanguage: text('translated_language').notNull(),
	groupUuids: text('group_uuids').notNull().array(),
	uploaderUuid: text('uploader_uuid')
		.notNull()
		.references(() => tUsers.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	mangaUuid: text('manga_uuid')
		.notNull()
		.references(() => tManga.id, { onDelete: 'cascade', onUpdate: 'cascade' })
})

export const tScanlationGroup = pgTable('scanlation_group', {
	...defaultColumns(),
	name: text('name').notNull()
})

export const tManga = pgTable('manga', {
	...defaultColumns(),
	title: jsonb('title').notNull().$type<Record<string, string>>(),
	originalLanguage: text('original_language').notNull(),
	tagUuids: text('tags').notNull().array()
})

export const tUsers = pgTable('user', {
	...defaultColumns(),
	username: text('username')
})
