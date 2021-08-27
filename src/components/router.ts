/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import Koa from 'koa'
import KoaRouter from 'koa-router'
import KoaStatic from 'koa-static'
import KoaMount from 'koa-mount'
import * as Boom from '@hapi/boom'
import path from 'path'
import { Sentry } from './sentry'

export interface KoaState extends Koa.DefaultState {}

export interface KoaContext extends Koa.Context {
	state: KoaState
}

export const koa = new Koa<KoaState, KoaContext>()
export const router = new KoaRouter<KoaState, KoaContext>({
	prefix: process.env.HTTP_URL_PREFIX
})

koa.use(KoaMount('/', KoaStatic(path.join(__dirname, '../../frontend/dist/'))))

// Error catcher
koa.use(async (ctx, next) => {
	ctx.set('X-Powered-By', 'Sweat and tears')

	try {
		await next()
	} catch (e: any) {
		Sentry.captureException(e)
		console.error(e)

		if (!Boom.isBoom(e)) {
			e = Boom.internal()
		}

		ctx.status = e.output.statusCode
		ctx.body = {
			...e.output.payload,
			status: ctx.status,
			statusCode: undefined
		}
	}
})

koa.use(router.routes())
koa.use(router.allowedMethods())
