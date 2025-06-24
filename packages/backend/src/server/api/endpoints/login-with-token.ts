/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundError } from 'typeorm';
import type { UserProfilesRepository, UsersRepository, XissmeLoginTokensRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import { generateNativeUserToken } from '@/misc/token.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	requireCredential: false,

	errors: {
		invalidToken: {
			message: 'Invalid login token.',
			code: 'INVALID_LOGIN_TOKEN',
			id: 'b0a7f5f8-dc2f-4171-b91f-de88ad238e14',
		},
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

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private userEntityService: UserEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
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

				if (!userProfile.user) {
					throw new ApiError(meta.errors.invalidToken);
				}

				// Ensure user has a token - generate one if they don't
				if (!userProfile.user.token) {
					const newToken = generateNativeUserToken();
					await this.usersRepository.update(userProfile.user.id, {
						token: newToken,
					});
					userProfile.user.token = newToken;
				}

				const user = await this.userEntityService.pack(userProfile.user, userProfile.user, {
					schema: 'MeDetailed',
					includeSecrets: true,
					userProfile,
				});

				return {
					...user,
					token: userProfile.user.token,
				};
			} catch (err) {
				if (err instanceof EntityNotFoundError) {
					throw new ApiError(meta.errors.invalidToken);
				}
				throw err;
			}
		});
	}
}
