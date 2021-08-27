/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import 'dotenv/config'
import { koa } from './components/router'
import './fetcher'

const port = parseInt(process.env.HTTP_PORT!) || 3000
koa.listen(port, process.env.HTTP_HOST)

for (let route of ['index', 'feed']) {
	require('./routes/' + route)?.init?.()
}
