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
export class XissmieCheckStoreEmojiIntegrityProcessorService {
	private logger: Logger;

	constructor(
		private queueLoggerService: QueueLoggerService,
		private xissmieStoreService: XissmieStoreService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('xissmie-check-store-emoji-integrity');
	}

	@bindThis
	public async process(_job: Bull.Job<Record<string, unknown>>): Promise<void> {
		const result = await this.xissmieStoreService.checkStoreEmojiIntegrity();
		this.logger.info(
			`done: scanned=${result.scanned} missing=${result.missing} skippedNonLocalUrl=${result.skippedNonLocalUrl} transientErrors=${result.transientErrors} reportableMissing=${result.newlyReported}`,
		);
	}
}
