/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import ms from 'ms';
import * as mfm from 'mfm-js';
import { Inject, Injectable } from '@nestjs/common';
import type { EmojisRepository, FlashsRepository, UserOwnedEmojisRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '../../error.js';
import { extractCustomEmojisFromMfm } from '@/misc/extract-custom-emojis-from-mfm.js';
import { In } from 'typeorm';

export const meta = {
	tags: ['flash'],

	requireCredential: true,

	prohibitMoved: true,

	kind: 'write:flash',

	limit: {
		duration: ms('1hour'),
		max: 300,
	},

	errors: {
		noSuchFlash: {
			message: 'No such flash.',
			code: 'NO_SUCH_FLASH',
			id: '611e13d2-309e-419a-a5e4-e0422da39b02',
		},

		accessDenied: {
			message: 'Access denied.',
			code: 'ACCESS_DENIED',
			id: '08e60c88-5948-478e-a132-02ec701d67b2',
		},
		emojiNotOwned: {
			message: 'You do not own one or more emojis used.',
			code: 'EMOJI_NOT_OWNED',
			id: '0fcbe7ef-8d42-41b2-8204-aafd9f16293d',
			httpStatusCode: 403,
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		flashId: { type: 'string', format: 'misskey:id' },
		title: { type: 'string' },
		summary: { type: 'string' },
		script: { type: 'string' },
		permissions: { type: 'array', items: {
			type: 'string',
		} },
		visibility: { type: 'string', enum: ['public', 'private'] },
	},
	required: ['flashId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.flashsRepository)
		private flashsRepository: FlashsRepository,

		@Inject(DI.emojisRepository)
		private emojisRepository: EmojisRepository,

		@Inject(DI.userOwnedEmojisRepository)
		private userOwnedEmojisRepository: UserOwnedEmojisRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const flash = await this.flashsRepository.findOneBy({ id: ps.flashId });
			if (flash == null) {
				throw new ApiError(meta.errors.noSuchFlash);
			}
			if (flash.userId !== me.id) {
				throw new ApiError(meta.errors.accessDenied);
			}

			// Validate summary emojis ownership (store emojis only)
			if (ps.summary) {
				const tokens = mfm.parse(ps.summary);
				const emojis = extractCustomEmojisFromMfm(tokens);
				const storeEmojiNames = [...new Set(
					emojis
						.map(e => e.replaceAll(':', ''))
						.filter(n => n.includes('_e_') || n.includes('-store-'))
				)];
				if (storeEmojiNames.length > 0) {
					const storeEmojiEntities = await this.emojisRepository.findBy({ name: In(storeEmojiNames) });
					if (storeEmojiEntities.length > 0) {
						const requiredEmojiIds = new Set(storeEmojiEntities.map(e => e.id));
						const owned = await this.userOwnedEmojisRepository.findBy({ userId: me.id });
						const ownedIds = new Set(owned.map(o => o.emojiId));
						const hasUnowned = [...requiredEmojiIds].some(id => !ownedIds.has(id));
						if (hasUnowned) {
							throw new ApiError(meta.errors.emojiNotOwned);
						}
					}
				}
			}

			await this.flashsRepository.update(flash.id, {
				updatedAt: new Date(),
				...Object.fromEntries(
					Object.entries(ps).filter(
						([key, val]) => (key !== 'flashId') && Object.hasOwn(paramDef.properties, key),
					),
				),
			});
		});
	}
}
