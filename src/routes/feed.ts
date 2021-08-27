/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { router } from '../components/router'
import * as Boom from '@hapi/boom'
import { prisma } from '../components/prisma'
import { Feed } from 'feed'
import { Chapter, Manga, ScanlationGroup } from '@prisma/client'

export function init() {
	router.get('/feed', async ctx => {
		// Make sure we have an array of query elements, otherwise null
		const rawQueries = (
			Array.isArray(ctx.query.q)
				? ctx.query.q
				: ctx.query.q
				? [ctx.query.q]
				: undefined
		)
			?.map(q => q.split(',').filter(v => !!v))
			.filter(v => v.length > 0)

		if (!rawQueries || rawQueries.length === 0) {
			throw Boom.badRequest('No actionable queries')
		}

		if (rawQueries.length > 10) {
			throw Boom.badRequest('Too many queries in a single request (max 10)')
		}

		const queries = rawQueries.map(parseQuery)
		const results = await executeQueries(queries)

		const feed = buildFeed(
			results,
			'https://mdrss.tijlvdb.me' + ctx.request.url
		)

		const format = ['rss2', 'json1', 'atom1'].includes(ctx.query.format as any)
			? ctx.query.format
			: 'rss2'
		if (format === 'rss2') {
			ctx.set('content-type', 'application/xml')
			ctx.body = feed.rss2()
		} else if (format === 'json1') {
			ctx.set('content-type', 'application/feed+json')
			ctx.body = feed.json1()
		} else if (format === 'atom1') {
			ctx.set('content-type', 'application/xml')
			ctx.body = feed.atom1()
		}
	})
}

function parseQuery(parts: string[]) {
	const ids = parts.map(p => p.toLowerCase().split(':'))
	return {
		manga: ids.find(uuid => uuid[0] === 'manga')?.[1],
		user: ids.find(uuid => uuid[0] === 'user')?.[1],
		groups: ids.filter(uuid => uuid[0] === 'group').map(u => u[1]),
		languages: ids.filter(uuid => uuid[0] === 'tl').map(u => u[1]),
		originalLanguages: ids.filter(uuid => uuid[0] === 'ol').map(u => u[1])
	}
}

async function executeQueries(queries: ReturnType<typeof parseQuery>[]) {
	const results = await prisma.chapter.findMany({
		where: {
			OR: queries.map(query => {
				return {
					mangaUuid: query.manga,
					uploaderUuid: query.user,
					groupUuids:
						query.groups.length > 0
							? {
									hasSome: query.groups
							  }
							: undefined,
					translatedLanguage:
						query.languages.length > 0
							? {
									in: query.languages
							  }
							: undefined,
					manga:
						query.originalLanguages.length > 0
							? {
									originalLanguage: {
										in: query.originalLanguages
									}
							  }
							: undefined
				}
			})
		},
		include: {
			manga: true
		},
		orderBy: {
			publishedAt: 'desc'
		},
		take: 20
	})

	const groups = await Promise.all(
		results
			.map(r => {
				return r.groupUuids.map(uuid =>
					// Thankfully, even though we seem to execute the query once
					// for each group for each chapter, Prisma groups them
					// together in a single query.
					prisma.scanlationGroup.findUnique({
						where: {
							uuid
						}
					})
				)
			})
			.flat()
	)

	return results.map(result => {
		return {
			...result,
			groups: groups.filter(g =>
				result.groupUuids.includes(g?.uuid!)
			) as NonNullable<typeof groups[0]>[]
		}
	})
}

function buildFeed(
	chapters: (Chapter & { manga: Manga; groups: ScanlationGroup[] })[],
	url: string
) {
	const feed = new Feed({
		title: 'MDRSS',
		copyright: '',
		description: '',
		link: url,
		id: url,
		generator: 'MDRSS'
	})

	for (let chapter of chapters) {
		let mangaTitle =
			chapter.manga.title![chapter.translatedLanguage] ||
			chapter.manga.title!['en'] ||
			Object.values(chapter.manga.title!)[0] ||
			''

		let chapterTitle = [
			chapter.volume && `Vol. ${chapter.volume}`,
			chapter.chapter && `Ch. ${chapter.chapter}`,
			chapter.title
		]
			.filter(v => !!v)
			.join(' ')

		feed.addItem({
			title: `${mangaTitle}: ${chapterTitle}`,
			date: chapter.publishedAt,
			link: `https://mangadex.org/chapter/${chapter.uuid}`,
			author: chapter.groups.map(group => {
				return {
					name: group.name,
					link: `https://mangadex.org/group/${group.uuid}`
				}
			}),
			description: `
                <b>${mangaTitle}</b><br />
                ${chapterTitle}<br />
                <a href="https://mangadex.org/chapter/${chapter.uuid}" target="_blank">Read chapter</a><br />
                <a href="https://mangadex.org/title/${chapter.manga.uuid}" target="_blank">View manga</a>
            `
		})
	}

	return feed
}
