/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { router } from '../components/router'
import * as Boom from '@hapi/boom'
import { prisma } from '../components/prisma'
import { Feed } from 'feed'
import { Chapter, Manga, ScanlationGroup, User } from '@prisma/client'

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

		let title = ''
		if (queries.length === 1 && results.length > 0) {
			if (queries[0].manga.length === 1) {
				const titles = results[0]?.manga.title as any
				title =
					queries[0].languages.map(l => titles[l]).filter(v => !!v)[0] ||
					titles['en'] ||
					Object.values(titles)[0] ||
					''
			} else if (queries[0].groups.length > 0) {
				title =
					'Groups: ' +
					queries[0].groups
						.map(group =>
							results
								.map(res => res.groups.find(g => g.uuid === group)?.name)
								.find(v => !!v)
						)
						.filter(v => !!v)
						.join(', ')
			} else if (queries[0].user.length === 1) {
				title = 'User: ' + results[0].uploader.username
			} else if (queries[0].languages.length > 0) {
				title = 'Languages: ' + queries[0].languages.join(', ')
			} else if (queries[0].originalLanguages.length > 0) {
				title = 'Original languages: ' + queries[0].originalLanguages.join(', ')
			}
		}

		const feed = buildFeed(
			results,
			'https://mdrss.tijlvdb.me' + ctx.request.url,
			title
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
		manga: ids.filter(uuid => uuid[0] === 'manga').map(u => u[1]),
		user: ids.filter(uuid => uuid[0] === 'user').map(u => u[1]),
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
					mangaUuid:
						query.manga.length > 0
							? {
									in: query.manga
							  }
							: undefined,
					uploaderUuid:
						query.user.length > 0
							? {
									in: query.user
							  }
							: undefined,
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
			manga: true,
			uploader: true
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
			groups: result.groupUuids
				.map(uuid => groups.find(g => g?.uuid === uuid))
				.filter(v => !!v) as NonNullable<typeof groups[0]>[]
		}
	})
}

function buildFeed(
	chapters: (Chapter & {
		manga: Manga
		groups: ScanlationGroup[]
		uploader: User
	})[],
	url: string,
	title: string
) {
	const feed = new Feed({
		title: 'MDRSS' + (title ? ` - ${title}` : ''),
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
                ${chapterTitle}<br /><br />
				<b>Groups</b>: ${chapter.groups
					.map(
						group =>
							`<a href="https://mangadex.org/group/${group.uuid}" target="_blank">${group.name}</a>`
					)
					.join(', ')}<br />
				<b>Uploader</b>: <a href="https://mangadex.org/user/${chapter.uploader.uuid}">${
				chapter.uploader.username
			}</a><br /><br />
                <a href="https://mangadex.org/chapter/${
									chapter.uuid
								}" target="_blank"><b>Read chapter</b></a><br />
                <a href="https://mangadex.org/title/${
									chapter.manga.uuid
								}" target="_blank">View manga</a>
            `
		})
	}

	return feed
}
