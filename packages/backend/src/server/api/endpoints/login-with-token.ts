/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { UserProfilesRepository, XissmeLoginTokensRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';

export const meta = {
	requireCredential: false,

	errors: {

	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		token: { type: 'string' },
	},
	required: ['token'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.xissmeLoginTokensRepository)
		private xissmeLoginTokensRepository: XissmeLoginTokensRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private userEntityService: UserEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const t = await this.xissmeLoginTokensRepository.findOneByOrFail({
				token: ps.token,
			});

			await this.xissmeLoginTokensRepository.delete(t.id);

			await this.xissmeLoginTokensRepository.insert({
				userId: t.userId,
				token: secureRndstr(32),
			});

			const userProfile = await this.userProfilesRepository.findOneOrFail({
				where: {
					userId: t.userId,
				},
				relations: ['user'],
			});

			const user = await this.userEntityService.pack(userProfile.user!, userProfile.user!, {
				schema: 'MeDetailed',
				includeSecrets: true,
				userProfile,
			});

			return {
				...user,
				token: userProfile.user!.token,
			};
		});
	}
}
