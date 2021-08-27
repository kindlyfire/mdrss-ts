/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import 'dotenv/config'
import { prisma } from './components/prisma'
import { Sentry } from './components/sentry'
import axios from 'axios'

setInterval(() => {
	fetchNewChapters().catch(e => {
		console.error(e)
		Sentry.captureException(e)
	})
}, 60 * 1000)
fetchNewChapters().catch(e => {
	console.error(e)
	Sentry.captureException(e)
})

async function fetchNewChapters() {
	const lastPublishedDate = await getLastPublishedDate()
	const chapters = await fetchChaptersSince(
		lastPublishedDate?.toISOString().split('.')[0]
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
	return axios
		.get(`https://api.mangadex.org/chapter`, {
			params: {
				limit: 20,
				publishAtSince: since,
				'order[publishAt]': since ? 'asc' : 'desc', // If we don't have any chapters yet, we want the last chapters, not the first
				includes: ['manga', 'user', 'scanlation_group']
			}
		})
		.then(d => {
			return d.data.results.map(r => {
				const attrs = r.data.attributes
				return {
					id: r.data.id,
					title: attrs.title,
					volume: attrs.volume,
					chapter: attrs.chapter,
					publishedAt: attrs.publishAt,
					translatedLanguage: attrs.translatedLanguage,
					uploader: compactMdRelationshipObject(
						r.relationships.find(rel => rel.type === 'user')
					),
					groups: r.relationships
						.filter(rel => rel.type === 'scanlation_group')
						.map(compactMdRelationshipObject),
					manga: compactMdRelationshipObject(
						r.relationships.find(rel => rel.type === 'manga')
					)
				}
			})
		})
}

function compactMdRelationshipObject(obj: any) {
	return {
		id: obj.id,
		...obj.attributes
	}
}
