/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { setTimeout } from 'node:timers/promises';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource, IsNull, LessThan, QueryFailedError, Not } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { MiMeta } from '@/models/_.js';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { IdService } from '@/core/IdService.js';
import { XissmieStoreService } from '@/core/XissmieStoreService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';

@Injectable()
export class XissmieSyncStoreContentsProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.meta)
		private meta: MiMeta,

		@Inject(DI.db)
		private db: DataSource,

		private idService: IdService,
		private queueLoggerService: QueueLoggerService,
		private xissmieStoreService: XissmieStoreService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('xissmie-sync-store-contents');
	}

	@bindThis
	public async process(job: Bull.Job<Record<string, unknown>>): Promise<void> {
		await Promise.all([
			this.xissmieStoreService.fetchStoreEmojis(),
			this.xissmieStoreService.fetchStoreDecorations(),
		]);
	}
}
