/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as _Sentry from '@sentry/node'

export const Sentry = _Sentry

_Sentry.init({
	dsn: process.env.SENTRY_DSN,
	tracesSampleRate: 1.0
})
