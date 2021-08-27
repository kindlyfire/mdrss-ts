# MDRSS-TS

Public feed generator for [MangaDex](https://mangadex.org/).

- Can output RSS 2.0, JSON Feed 1.0 and Atom 1.0 feeds
- Supports filtering by manga, scanlation group, uploader, language, original language
- Supports filtering by a combination of any of the above
- Will never hit the MangaDex rate limit

## Creating a feed

### Step 1: Create a query

A query is made out of multiple key-value matchers in `key:value` format,
separated by commas. The different available keys are:

- `manga`: Filter my manga UUID
- `group`: Filter by group UUID (repeatable)
- `user`: Filter by uploader UUID
- `tl`: Translation language (repeatable)
- `ol`: Original language (repeatable)

Repeatable matchers are `OR`s internally, so at least one of each specified kind
will match. At least one matcher must be present per query.

Examples:

- Manga [Tensei Slime](https://mangadex.org/title/e78a489b-6632-4d61-b00b-5206f5b8b22b/tensei-shitara-slime-datta-ken): Any group, any language: `manga:e78a489b-6632-4d61-b00b-5206f5b8b22b`
- Manga [Tensei Slime](https://mangadex.org/title/e78a489b-6632-4d61-b00b-5206f5b8b22b/tensei-shitara-slime-datta-ken): Group [Tempest](16801d0b-5f1f-450e-bd1b-f59ef830bf26), only English: `manga:e78a489b-6632-4d61-b00b-5206f5b8b22b,group:16801d0b-5f1f-450e-bd1b-f59ef830bf26,tl:en`

### Step 2: Create the feed URL

Build the feed URL by using the following steps:

- Base URL of `https://mdrss.tijlvdb.me/feed?`
- For each query (up to 10 per feed):
  - Type `q=`
  - Paste the query from the previous step
  - Type `&`
- Select your format (optional):
  - Type `format=rss2` for RSS (default)
  - Type `format=json1` for JSON
  - Type `format=atom1` for Atom
