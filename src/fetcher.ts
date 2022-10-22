/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import 'dotenv/config'
import { prisma } from './components/prisma'
import { Sentry } from './components/sentry'
import axios from 'axios'
import dayjs from 'dayjs'

setInterval(() => {
	fetchNewChapters().catch(e => {
		console.error(e)
		Sentry.captureException(e)
	})
}, 10 * 1000)
fetchNewChapters().catch(e => {
	console.error(e)
	Sentry.captureException(e)
})

async function fetchNewChapters() {
	const lastPublishedDate = await getLastPublishedDate()
	const chapters = await fetchChaptersSince(
		dateToMdDate(lastPublishedDate || undefined)
	)

	// Users
	const uniqueUsers: any[] = []
	for (let chap of chapters) {
		if (
			chap.uploader &&
			!uniqueUsers.some(user => user.id === chap.uploader.id)
		)
			uniqueUsers.push(chap.uploader)
	}
	for (let user of uniqueUsers) {
		await saveUser(user)
	}

	// Scanlation groups
	const uniqueScanlationGroups: any[] = []
	for (let chap of chapters) {
		for (let group of chap.groups) {
			if (!uniqueScanlationGroups.some(g => g.id === group.id))
				uniqueScanlationGroups.push(group)
		}
	}
	for (let group of uniqueScanlationGroups) {
		await saveScanlationGroup(group)
	}

	// Manga
	const uniqueManga: any[] = []
	for (let chap of chapters) {
		if (!uniqueManga.some(manga => manga.id === chap.manga.id))
			uniqueManga.push(chap.manga)
	}
	for (let manga of uniqueManga) {
		await saveManga(manga)
	}

	// And finally chapters
	for (let chapter of chapters) {
		await saveChapter(chapter)
	}
}

async function getLastPublishedDate() {
	const agg = await prisma.chapter.aggregate({
		_max: {
			publishedAt: true
		}
	})
	return agg._max.publishedAt
}

async function saveUser(user: any) {
	await prisma.user.upsert({
		where: {
			uuid: user.id
		},
		create: {
			uuid: user.id,
			username: user.username
		},
		update: {
			username: user.username
		}
	})
}

async function saveManga(manga: any) {
	await prisma.manga.upsert({
		where: {
			uuid: manga.id
		},
		create: {
			uuid: manga.id,
			title: manga.title,
			originalLanguage: manga.originalLanguage
		},
		update: {
			title: manga.title,
			originalLanguage: manga.originalLanguage
		}
	})
}

async function saveScanlationGroup(group: any) {
	await prisma.scanlationGroup.upsert({
		where: {
			uuid: group.id
		},
		create: {
			uuid: group.id,
			name: group.name
		},
		update: {
			name: group.name
		}
	})
}

async function saveChapter(chapter: any) {
	await prisma.chapter.upsert({
		where: {
			uuid: chapter.id
		},
		create: {
			uuid: chapter.id,
			title: chapter.title,
			chapter: chapter.chapter,
			volume: chapter.volume,
			publishedAt: chapter.publishedAt,
			translatedLanguage: chapter.translatedLanguage,
			mangaUuid: chapter.manga.id,
			uploaderUuid: chapter.uploader.id,
			groupUuids: chapter.groups.map(group => group.id)
		},
		update: {
			title: chapter.title,
			chapter: chapter.chapter,
			volume: chapter.volume,
			publishedAt: chapter.publishedAt,
			translatedLanguage: chapter.translatedLanguage,
			mangaUuid: chapter.manga.id,
			uploaderUuid: chapter.uploader.id,
			groupUuids: chapter.groups.map(group => group.id)
		}
	})
}

async function fetchChaptersSince(since?: string) {
	const now = dayjs()

	return axios
		.get(`https://api.mangadex.org/chapter`, {
			params: {
				limit: 50,
				publishAtSince:
					since || dateToMdDate(dayjs().subtract(2, 'days').toDate()),
				'order[publishAt]': 'asc',
				includes: ['manga', 'user', 'scanlation_group'],
				includeFutureUpdates: 0
			}
		})
		.then(d => {
			return (d.data.data as any[]).map(r => {
				const attrs = r.attributes
				const rels = r.relationships
				return {
					id: r.id as string,
					title: attrs.title as string,
					volume: attrs.volume as string,
					chapter: attrs.chapter as string,
					publishedAt: attrs.publishAt as string,
					translatedLanguage: attrs.translatedLanguage as string,
					uploader: compactMdRelationshipObject(
						rels.find(rel => rel.type === 'user')
					),
					groups: rels
						.filter(rel => rel.type === 'scanlation_group')
						.map(compactMdRelationshipObject),
					manga: compactMdRelationshipObject(
						rels.find(rel => rel.type === 'manga')
					)
				}
			})
		})
		.then(chapters => chapters.filter(ch => now.isAfter(ch.publishedAt)))
}

function compactMdRelationshipObject(obj: any) {
	return {
		id: obj.id,
		...obj.attributes
	}
}

function dateToMdDate(d?: Date) {
	return d?.toISOString().split('.')[0]
}
