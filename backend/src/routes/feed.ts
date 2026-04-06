import {
	SQL,
	and,
	arrayContains,
	desc,
	eq,
	inArray,
	not,
	or
} from 'drizzle-orm'
import { tChapters, tManga, tScanlationGroup, tUsers } from '../database/schema'
import { db } from '../database'
import { Feed } from 'feed'

export const feedHandler = async (
	req: Request,
	url: URL
): Promise<Response> => {
	const rawQueries = url.searchParams
		.getAll('q')
		.map(v => v.split(',').filter(v => v))
		.filter(v => v.length)

	if (!rawQueries.length) return new Response('No queries', { status: 400 })
	if (rawQueries.length > 10)
		return new Response('Too many queries (> 10)', { status: 400 })

	const queries = rawQueries.map(q => parseQuery(q))
	if (queries.some(v => v[1] > 10 || v[1] === 0))
		return new Response(
			'Some queries have either 0 or too many matchers (> 10)',
			{ status: 400 }
		)

	const results = await executeQueries(queries)
	const feed = buildFeed(queries, results, url)
	return new Response(feed, {
		headers: { 'content-type': 'application/xml' }
	})
}

function parseQuery(rawQuery: string[]) {
	const matchers = rawQuery.map(v => v.split(':')).filter(v => v.length === 2)
	let extracted = 0
	const extract = (key: string) =>
		matchers.filter(v => v[0] === key).map(v => (extracted++, v[1]))
	return [
		{
			manga: extract('manga'),
			users: extract('user'),
			groups: extract('groups').concat(extract('group')),
			languages: extract('tl'),
			originalLanguages: extract('ol'),
			tags: extract('tags'),
			ntags: extract('ntags')
		},
		extracted
	] as const
}
type ParsedQuery = ReturnType<typeof parseQuery>

async function executeQueries(queries: ParsedQuery[]) {
	const results = await db
		.select()
		.from(tChapters)
		.innerJoin(tManga, eq(tChapters.mangaUuid, tManga.id))
		.innerJoin(tUsers, eq(tChapters.uploaderUuid, tUsers.id))
		.where(or(...queries.map(queryToSql)))
		.orderBy(desc(tChapters.publishedAt))
		.limit(20)

	const groupIds = Array.from(
		new Set(results.flatMap(v => v.chapters.groupUuids ?? []))
	)
	const groups =
		groupIds.length === 0
			? []
			: await db
					.select()
					.from(tScanlationGroup)
					.where(inArray(tScanlationGroup.id, groupIds))

	return results.map(r => {
		return {
			...r,
			groups:
				r.chapters.groupUuids?.map(
					uuid =>
						groups.find(v => v.id === uuid) ?? {
							id: uuid,
							name: 'Unknown group'
						}
				) ?? []
		}
	})
}
type QueryResults = Awaited<ReturnType<typeof executeQueries>>

function queryToSql(query: ParsedQuery) {
	const q = query[0]
	let querySql: (SQL | undefined)[] = []

	// Chapter queries
	if (q.users.length) {
		querySql.push(or(...q.users.map(v => eq(tChapters.uploaderUuid, v))))
	}
	if (q.manga.length) {
		querySql.push(or(...q.manga.map(v => eq(tChapters.mangaUuid, v))))
	}
	if (q.languages.length) {
		querySql.push(
			or(...q.languages.map(v => eq(tChapters.translatedLanguage, v)))
		)
	}
	if (query[0].groups.length) {
		querySql.push(arrayContains(tChapters.groupUuids, query[0].groups))
	}

	// Manga queries
	if (q.originalLanguages.length) {
		querySql.push(
			or(...q.originalLanguages.map(v => eq(tManga.originalLanguage, v)))
		)
	}
	if (q.tags.length) {
		querySql.push(arrayContains(tManga.tagUuids, q.tags))
	}
	if (q.ntags.length) {
		querySql.push(
			and(...q.ntags.map(v => not(arrayContains(tManga.tagUuids, [v]))))
		)
	}

	return and(...querySql)
}

function buildFeed(queries: ParsedQuery[], results: QueryResults, url: URL) {
	const title = formatFeedTitle(queries, results)
	const pageUrl = 'https://mdrss.tijlvdb.me' + url.pathname + url.search
	const feed = new Feed({
		title: 'MDRSS' + (title ? ` - ${title}` : ''),
		copyright: '',
		description: '',
		link: pageUrl,
		id: pageUrl,
		generator: 'MDRSS'
	})
	for (const r of results) {
		let mangaTitle =
			r.manga.title[r.chapters.translatedLanguage] ||
			r.manga.title.en ||
			Object.values(r.manga.title)[0] ||
			''

		let chapterTitle = [
			r.chapters.volume && `Vol. ${r.chapters.volume}`,
			r.chapters.chapter && `Ch. ${r.chapters.chapter}`,
			r.chapters.title
		]
			.filter(v => !!v)
			.join(' ')

		feed.addItem({
			title: `${mangaTitle}: ${chapterTitle}`,
			date: r.chapters.publishedAt,
			link: `https://mangadex.org/chapter/${r.chapters.id}`,
			author: r.groups.map(group => {
				return {
					name: group.name,
					link: `https://mangadex.org/group/${group.id}`
				}
			}),
			description: `
                <b>${mangaTitle}</b><br />
                ${chapterTitle}<br /><br />
				<b>Groups</b>: ${r.groups
					.map(
						group =>
							`<a href="https://mangadex.org/group/${group.id}" target="_blank">${group.name}</a>`
					)
					.join(', ')}<br />
				<b>Uploader</b>: <a href="https://mangadex.org/user/${r.user.id}">${
					r.user.username ?? 'Unknown user'
				}</a><br /><br />
                <a href="https://mangadex.org/chapter/${
									r.chapters.id
								}" target="_blank"><b>Read chapter</b></a><br />
                <a href="https://mangadex.org/title/${
									r.manga.id
								}" target="_blank">View manga</a>
            `
		})
	}
	return feed.rss2()
}

function formatFeedTitle(queries: ParsedQuery[], results: QueryResults) {
	if (queries.length > 1 || results.length === 0) return ''

	let title = ''
	const q = queries[0][0]
	const r = results[0]
	if (q.manga.length) {
		const titles = r.manga.title
		title =
			q.languages.map(l => titles[l]).filter(v => v)[0] ||
			titles.en ||
			Object.values(titles)[0] ||
			''
	} else if (q.users.length) {
		title = 'User: '
		title += r.user.username ?? `Unknown user`
	} else if (q.languages.length) {
		title = 'Language: '
		title += q.languages.join(', ')
	} else if (q.originalLanguages) {
		title = 'Original language: '
		title += q.originalLanguages.join(', ')
	}

	return title
}
