/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { IsNull } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type { UserOwnedAvatarDecorationsRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { DI } from '@/di-symbols.js';
import { XissmieStoreService } from '@/core/XissmieStoreService.js';

export const meta = {
	tags: ['meta'],

	requireCredential: true,

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			emojis: {
				type: 'array',
				optional: false, nullable: false,
				items: {
					type: 'object',
					optional: false, nullable: false,
					ref: 'EmojiSimple',
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userOwnedAvatarDecorationsRepository)
		private userOwnedAvatarDecorationsRepository: UserOwnedAvatarDecorationsRepository,

		private emojiEntityService: EmojiEntityService,
		private xissmieStoreService: XissmieStoreService,
	) {
		super(meta, paramDef, async (ps, me) => {
			await this.xissmieStoreService.fetchPurchasedAvatarDecorationsFromStore(me.id);

			const ownedDecorations = await this.userOwnedAvatarDecorationsRepository.find({
				where: {
					userId: me.id,
				},
				relations: ['avatarDecoration'],
			});

			return ownedDecorations.map(x => ({
				id: x.avatarDecoration!.id,
				name: x.avatarDecoration!.name,
				description: x.avatarDecoration!.description,
				url: x.avatarDecoration!.url,
				roleIdsThatCanBeUsedThisDecoration: [],
			}));
		});
	}
}
