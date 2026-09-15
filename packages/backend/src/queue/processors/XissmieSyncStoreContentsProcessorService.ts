/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { XissmieStoreService } from '@/core/XissmieStoreService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';

@Injectable()
export class XissmieSyncStoreContentsProcessorService {
	private logger: Logger;

	constructor(
		private queueLoggerService: QueueLoggerService,
		private xissmieStoreService: XissmieStoreService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('xissmie-sync-store-contents');
	}

	@bindThis
	public async process(job: Bull.Job<Record<string, unknown>>): Promise<void> {
		let emojiError: unknown = null;
		let decorationError: unknown = null;

		try {
			const emojiResult = await this.xissmieStoreService.fetchStoreEmojis();
			this.logger.info(`emojis: total=${emojiResult.total} success=${emojiResult.success} failed=${emojiResult.failed}`);
		} catch (err) {
			emojiError = err;
			const reason = err instanceof Error ? err.message : String(err);
			this.logger.error(`fetchStoreEmojis failed: ${reason}`, { e: err });
		}

		try {
			await this.xissmieStoreService.fetchStoreDecorations();
		} catch (err) {
			decorationError = err;
			const reason = err instanceof Error ? err.message : String(err);
			this.logger.error(`fetchStoreDecorations failed: ${reason}`, { e: err });
		}

		if (emojiError != null && decorationError != null) {
			throw emojiError instanceof Error ? emojiError : new Error(String(emojiError));
		}
	}
}
