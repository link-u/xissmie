/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import ms from 'ms';
import * as mfm from 'mfm-js';
import { Inject, Injectable } from '@nestjs/common';
import type { EmojisRepository, FlashsRepository, UserOwnedEmojisRepository } from '@/models/_.js';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { FlashEntityService } from '@/core/entities/FlashEntityService.js';
import { extractCustomEmojisFromMfm } from '@/misc/extract-custom-emojis-from-mfm.js';
import { ApiError } from '../../error.js';
import { In } from 'typeorm';

export const meta = {
	tags: ['flash'],

	requireCredential: true,

	prohibitMoved: true,

	kind: 'write:flash',

	limit: {
		duration: ms('1hour'),
		max: 10,
	},

	errors: {
		emojiNotOwned: {
			message: 'You do not own one or more emojis used.',
			code: 'EMOJI_NOT_OWNED',
			id: '0fcbe7ef-8d42-41b2-8204-aafd9f16293d',
			httpStatusCode: 403,
		},
	},

	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'Flash',
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		title: { type: 'string' },
		summary: { type: 'string' },
		script: { type: 'string' },
		permissions: { type: 'array', items: {
			type: 'string',
		} },
		visibility: { type: 'string', enum: ['public', 'private'], default: 'public' },
	},
	required: ['title', 'summary', 'script', 'permissions'],
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

		private flashEntityService: FlashEntityService,
		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
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

			const flash = await this.flashsRepository.insertOne({
				id: this.idService.gen(),
				userId: me.id,
				updatedAt: new Date(),
				title: ps.title,
				summary: ps.summary,
				script: ps.script,
				permissions: ps.permissions,
				visibility: ps.visibility,
			});

			return await this.flashEntityService.pack(flash);
		});
	}
}
