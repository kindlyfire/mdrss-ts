import dayjs from 'dayjs'

export async function fetchChaptersSince(since: Date) {
	const params = new URLSearchParams({
		limit: '100',
		publishAtSince: formatMdDate(since),
		'order[publishAt]': 'asc',
		includeFuturePublishAt: '0'
	})
	params.append('includes[]', 'manga')
	params.append('includes[]', 'user')
	params.append('includes[]', 'scanlation_group')

	// console.log(
	// 	`Fetching URL: https://api.mangadex.org/chapter?${params.toString()}`
	// )

	const v = await fetch(
		`https://api.mangadex.org/chapter?` + params.toString(),
		{
			headers: {
				'user-agent': 'MDRSS (https://github.com/kindlyfire/mdrss-ts)'
			}
		}
	)
	if (!v.ok) throw new Error(`Failed to fetch chapters: ${v.statusText}`)
	const rawData = await v.json()
	const chapters = (rawData.data as any[]).map(r => {
		const attrs = r.attributes
		const rels = r.relationships as any[]
		return {
			id: r.id as string,
			title: attrs.title as string,
			volume: attrs.volume as string,
			chapter: attrs.chapter as string,
			publishedAt: attrs.publishAt as string,
			translatedLanguage: attrs.translatedLanguage as string,
			uploader: compactMdRelationshipObject<{
				id: string
				username?: string
			}>(rels.find(rel => rel.type === 'user')),
			groups: rels
				.filter(rel => rel.type === 'scanlation_group')
				.map(v =>
					compactMdRelationshipObject<{
						id: string
						name?: string | null
					}>(v)
				),
			manga: compactMdRelationshipObject<{
				id: string
				title: Record<string, string>
				originalLanguage: string
				tags: Array<{
					id: string
				}>
			}>(rels.find((rel: any) => rel.type === 'manga'))
		}
	})

	const now = dayjs()
	return chapters.filter(ch => now.isAfter(ch.publishedAt))
}
export type MdChapter = Awaited<ReturnType<typeof fetchChaptersSince>>[number]

function compactMdRelationshipObject<T = any>(obj: any): T {
	return {
		id: obj.id,
		...obj.attributes
	}
}

function formatMdDate(d: Date) {
	return d.toISOString().split('.')[0]
}
