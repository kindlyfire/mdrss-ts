import { desc } from 'drizzle-orm'
import { db } from '../../database'
import {
	tChapters,
	tManga,
	tScanlationGroup,
	tUsers
} from '../../database/schema'
import { fetchChaptersSince, type MdChapter } from './fetch'
import dayjs from 'dayjs'

let _timeout: null | Timer = null
function queueChaptersUpdate(t = 5 * 60 * 1000) {
	const run = () =>
		updateChapters().catch(e => {
			console.error('Error updating chapters:', e)
			queueChaptersUpdate()
		})
	if (_timeout) clearTimeout(_timeout)
	_timeout = setTimeout(run, t)
}
queueChaptersUpdate(0)

export async function updateChapters() {
	const latestChapter = await db.query.tChapters.findFirst({
		orderBy: desc(tChapters.publishedAt)
	})
	const updateFromDate =
		latestChapter?.publishedAt || dayjs().subtract(90, 'days').toDate()
	const chapters = await fetchChaptersSince(updateFromDate)

	for (const chapter of chapters) {
		try {
			await saveUser(chapter.uploader)
			await saveManga(chapter.manga)
			await saveChapter(chapter)
			for (const group of chapter.groups) await saveGroup(group)
		} catch (e) {
			console.error(
				`Error saving chapter ${chapter.id}:`,
				JSON.stringify(chapter, null, 2)
			)
			throw e
		}
	}

	const prefix = `Updating from ${dayjs(updateFromDate).format(
		'YYYY-MM-DD HH:mm'
	)}:`
	if (
		chapters.length === 0 ||
		chapters.every(c => dayjs(c.publishedAt).isSame(updateFromDate, 'second'))
	) {
		console.log(`${prefix} No new chapters found`)
		queueChaptersUpdate()
	} else {
		console.log(`${prefix} Added ${chapters.length} chapters`)
		queueChaptersUpdate(5000)
	}
}

async function saveUser(user: MdChapter['uploader']) {
	if (user.username)
		await db
			.insert(tUsers)
			.values({ id: user.id, username: user.username ?? null })
			.onConflictDoUpdate({
				target: tUsers.id,
				set: { username: user.username }
			})
	else
		await db
			.insert(tUsers)
			.values({ id: user.id, username: user.username ?? null })
			.onConflictDoNothing()
}

async function saveManga(manga: MdChapter['manga']) {
	const data = {
		title: manga.title,
		originalLanguage: manga.originalLanguage,
		tagUuids: manga.tags.map(t => t.id)
	}
	await db
		.insert(tManga)
		.values({ id: manga.id, ...data })
		.onConflictDoUpdate({
			target: tManga.id,
			set: data
		})
}

async function saveChapter(chapter: MdChapter) {
	const data = {
		mangaUuid: chapter.manga.id,
		publishedAt: new Date(chapter.publishedAt),
		title: chapter.title,
		translatedLanguage: chapter.translatedLanguage,
		volume: chapter.volume,
		uploaderUuid: chapter.uploader.id,
		chapter: chapter.chapter,
		groupUuids: chapter.groups.map(g => g.id)
	}
	await db
		.insert(tChapters)
		.values({ id: chapter.id, ...data })
		.onConflictDoUpdate({
			target: tChapters.id,
			set: data
		})
}

async function saveGroup(group: MdChapter['groups'][0]) {
	const data = { name: group.name || '' }
	await db
		.insert(tScanlationGroup)
		.values({ id: group.id, ...data })
		.onConflictDoUpdate({
			target: tScanlationGroup.id,
			set: data
		})
}
