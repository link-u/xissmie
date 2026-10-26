/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In, MoreThan } from 'typeorm';
import promiseLimit from 'promise-limit';
import * as Redis from 'ioredis';
import type { MiUser, UserOwnedAvatarDecorationsRepository, UserOwnedEmojisRepository, EmojisRepository, AvatarDecorationsRepository, MiMeta } from '@/models/_.js';
import type { MiEmoji } from '@/models/Emoji.js';
import { IdService } from '@/core/IdService.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { CacheService } from '@/core/CacheService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import type { Config } from '@/config.js';
import { DriveService } from '@/core/DriveService.js';
import { LoggerService } from '@/core/LoggerService.js';
import { S3Service, isS3ObjectNotFoundError } from '@/core/S3Service.js';
import { EmojiSyncFailureNotificationService } from '@/core/EmojiSyncFailureNotificationService.js';
import type Logger from '@/logger.js';
import {
	ATTEMPT_TIMEOUT_MS,
	IN_RUN_MAX_ATTEMPTS,
	INTEGRITY_CONCURRENCY,
	INTEGRITY_PAGE_SIZE,
	MAX_REUPLOADS_PER_RUN,
	MAX_RUNS,
	RUN_DEADLINE_MS,
	UPLOAD_CONCURRENCY,
	backoffDelayMs,
	formatRetryRedisValue,
	getObjectStoragePublicBaseUrl,
	parseRetryRunCount,
	parseRetryXfolioUpdatedAt,
	retryRedisKey,
	shouldTripCircuit,
	tryParseInternalStorageKey,
	tryParseObjectStorageKey,
} from '@/core/xissmie-store-emoji-sync.js';

export type XissmieStoreEmojiSyncResult = {
	total: number;
	success: number;
	failed: number;
	skippedExcluded: number;
	deferred: number;
	circuitOpened: boolean;
};

export type XissmieStoreEmojiIntegrityResult = {
	scanned: number;
	missing: number;
	skippedNonLocalUrl: number;
	transientErrors: number;
	newlyReported: number;
};

type IntegrityProbeResult = 'ok' | 'missing' | 'skip' | 'transient';

type StoreEmojiCatalogItem = {
	id: string;
	name: string;
	imageUrl: string;
	authorId: string;
	authorName: string;
	productId: string;
	updatedAt: number;
	isPublic: boolean;
	keywords?: string[];
};

type EmojiUpsertRow = {
	id: string;
	name: string;
	originalUrl: string;
	publicUrl: string;
	updatedAt: Date;
	category: string | null;
	license: string | null;
	localOnly: boolean;
	isSensitive: boolean;
	isInStore: boolean;
	isPublic: boolean;
	storeProductId: string | null;
	storeAuthorId: string;
	storeAuthorName: string;
	aliases?: string[];
};

type FailedUploadThisRun = {
	id: string;
	name: string;
	incomingUpdatedAtMs: number;
};

@Injectable()
export class XissmieStoreService {
	private logger: Logger;
	private integrityLogger: Logger;

	constructor(
		@Inject(DI.userOwnedAvatarDecorationsRepository)
		private userOwnedAvatarDecorationsRepository: UserOwnedAvatarDecorationsRepository,

		@Inject(DI.userOwnedEmojisRepository)
		private userOwnedEmojisRepository: UserOwnedEmojisRepository,

		@Inject(DI.emojisRepository)
		private emojisRepository: EmojisRepository,

		@Inject(DI.avatarDecorationsRepository)
		private avatarDecorationsRepository: AvatarDecorationsRepository,

		@Inject(DI.config)
		private config: Config,

		@Inject(DI.meta)
		private meta: MiMeta,

		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		private idService: IdService,
		private cacheService: CacheService,
		private httpRequestService: HttpRequestService,
		private driveService: DriveService,
		private loggerService: LoggerService,
		private s3Service: S3Service,
		private emojiSyncFailureNotificationService: EmojiSyncFailureNotificationService,
	) {
		this.logger = this.loggerService.getLogger('xissmie-sync-store-contents');
		this.integrityLogger = this.loggerService.getLogger('xissmie-check-store-emoji-integrity');
	}

	@bindThis
	public async fetchStoreDecorations(): Promise<void> {
		const params = new URLSearchParams({
			token: this.config.xfolioApiToken,
		});

		const res = await this.httpRequestService.send(`https://${this.config.xfolioApiHost}/api/v1/xissmie/decorations_list`, {
			method: 'POST',
			body: params.toString(),
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});

		const data = await res.json() as {
			id: string;
			name: string;
			imageUrl: string;
			authorId: string;
			authorName: string;
			productId: string;
			updatedAt: number;
			isPublic: boolean;
			// 検索用キーワード（配列）
			keywords?: string[];
		}[];

		//const data = [{
		//	id: 'da',
		//	name: 'おうかん',
		//	imageUrl: 'https://files-p1.a9z.dev/p1/ac48c0e4-5f1c-401f-8437-69e68a27c1d0.png',
		//	authorId: 'aa',
		//	authorName: 'syuilo',
		//	updatedAt: 0,
		//}, {
		//	id: 'db',
		//	name: 'はーと',
		//	imageUrl: 'https://files-p1.a9z.dev/p1/3ea6bbe8-5feb-4a8a-82fd-6771fe298414.png',
		//	authorId: 'aa',
		//	authorName: 'syuilo',
		//	updatedAt: 0,
		//}];

		// 既存データの更新日時を取得して無駄な再保存を回避
		const existing = await this.avatarDecorationsRepository.findBy({ id: In(data.map(d => d.id)) });
		const existingMap = new Map(existing.map(e => [e.id, e]));

		const rows = [] as {
			id: string;
			name: string;
			description: string;
			url: string;
			updatedAt: Date;
			isInStore: boolean;
			isPublic: boolean;
			storeProductId: string | null;
			storeAuthorId: string;
			storeAuthorName: string;
		}[];

		for (const x of data) {
			const incomingUpdatedAt = new Date(x.updatedAt);
			const ex = existingMap.get(x.id);
			let stableUrl: string | null = ex?.url ?? null;

			if (!(ex && ex.updatedAt && ex.updatedAt >= incomingUpdatedAt && ex.url)) {
				// 画像をDriveに取り込み（オブジェクトストレージ設定ならそちら、無ければ内部保存）
				const file = await this.driveService.uploadFromUrl({
					url: x.imageUrl,
					user: null,
					isLink: false,
					comment: `decoration:${x.id}`,
				});
				stableUrl = file.webpublicUrl ?? file.url;
			}

			rows.push({
				id: x.id,
				name: `${x.name}_d_${x.authorId}`,
				description: '',
				url: stableUrl ?? x.imageUrl,
				updatedAt: incomingUpdatedAt,
				isInStore: true,
				isPublic: x.isPublic,
				storeProductId: x.productId ?? null,
				storeAuthorId: x.authorId,
				storeAuthorName: x.authorName,
			});
		}

		await this.avatarDecorationsRepository.upsert(rows, ['id']);
	}

	@bindThis
	public async fetchStoreEmojis(): Promise<XissmieStoreEmojiSyncResult> {
		const startedAt = Date.now();
		const params = new URLSearchParams({
			token: this.config.xfolioApiToken,
		});

		const res = await this.httpRequestService.send(`https://${this.config.xfolioApiHost}/api/v1/xissmie/emojis_list`, {
			method: 'POST',
			body: params.toString(),
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});

		const data = await res.json() as StoreEmojiCatalogItem[];

		const existing = data.length > 0
			? await this.emojisRepository.findBy({ id: In(data.map(d => d.id)) })
			: [];
		const existingMap = new Map(existing.map(e => [e.id, e]));

		const rows: EmojiUpsertRow[] = [];
		const uploadCandidates: StoreEmojiCatalogItem[] = [];
		let skippedExcluded = 0;
		let success = 0;
		let failed = 0;

		for (const x of data) {
			const incomingUpdatedAt = new Date(x.updatedAt);
			const incomingUpdatedAtMs = incomingUpdatedAt.getTime();
			const ex = existingMap.get(x.id);
			const emojiName = `${x.name}_e_${x.authorId}`;
			const needsUpload = !(ex && ex.updatedAt && ex.updatedAt >= incomingUpdatedAt && ex.publicUrl);

			if (!needsUpload) {
				await this.redisClient.del(retryRedisKey(x.id));
				rows.push(this.buildEmojiUpsertRow(x, emojiName, ex!.publicUrl, incomingUpdatedAt, ex));
				success++;
				continue;
			}

			const redisVal = await this.redisClient.get(retryRedisKey(x.id));
			const runs = parseRetryRunCount(redisVal);
			const storedUpdatedAt = parseRetryXfolioUpdatedAt(redisVal);

			if (storedUpdatedAt != null && incomingUpdatedAtMs > storedUpdatedAt) {
				await this.redisClient.del(retryRedisKey(x.id));
			} else if (runs >= MAX_RUNS) {
				skippedExcluded++;
				this.logger.info(`emoji skipped (retry limit): id=${x.id} name=${emojiName} runs=${runs}`);
				continue;
			}

			uploadCandidates.push(x);
		}

		const deferredByCap = Math.max(0, uploadCandidates.length - MAX_REUPLOADS_PER_RUN);
		const toUpload = uploadCandidates.slice(0, MAX_REUPLOADS_PER_RUN);

		let circuitOpened = false;
		let consecutiveFails = 0;
		let attempted = 0;
		let deferred = deferredByCap;
		const failedThisRun: FailedUploadThisRun[] = [];

		let nextIndex = 0;
		const workerCount = Math.min(UPLOAD_CONCURRENCY, Math.max(toUpload.length, 0));
		const workers = Array.from({ length: workerCount }, async () => {
			while (true) {
				if (circuitOpened || (Date.now() - startedAt) >= RUN_DEADLINE_MS) {
					break;
				}
				const i = nextIndex++;
				if (i >= toUpload.length) break;
				const x = toUpload[i]!;

				const incomingUpdatedAt = new Date(x.updatedAt);
				const emojiName = `${x.name}_e_${x.authorId}`;
				const ex = existingMap.get(x.id);
				attempted++;

				const publicUrl = await this.uploadEmojiWithRetries(x, emojiName);
				if (publicUrl != null) {
					consecutiveFails = 0;
					await this.redisClient.del(retryRedisKey(x.id));
					rows.push(this.buildEmojiUpsertRow(x, emojiName, publicUrl, incomingUpdatedAt, ex));
					success++;
					continue;
				}

				failed++;
				consecutiveFails++;
				failedThisRun.push({
					id: x.id,
					name: emojiName,
					incomingUpdatedAtMs: incomingUpdatedAt.getTime(),
				});

				if (shouldTripCircuit({ consecutiveFails, failed, attempted })) {
					circuitOpened = true;
					this.logger.error(
						`circuit opened: attempted=${attempted} failed=${failed} consecutiveFails=${consecutiveFails}`,
					);
				}
			}
		});
		await Promise.all(workers);

		// デッドライン／サーキットで未着手分
		deferred += Math.max(0, toUpload.length - attempted);

		if (rows.length > 0) {
			await this.emojisRepository.upsert(rows, ['id']);
		}

		const newlyExcluded: { id: string; name: string }[] = [];
		if (!circuitOpened) {
			for (const item of failedThisRun) {
				const key = retryRedisKey(item.id);
				const prev = await this.redisClient.get(key);
				const nextRuns = parseRetryRunCount(prev) + 1;
				await this.redisClient.set(key, formatRetryRedisValue(nextRuns, item.incomingUpdatedAtMs));
				if (nextRuns >= MAX_RUNS) {
					newlyExcluded.push({ id: item.id, name: item.name });
				}
			}
		}

		if (newlyExcluded.length > 0) {
			await this.emojiSyncFailureNotificationService.notifyRetryLimitReached(newlyExcluded);
		}
		if (circuitOpened) {
			this.logger.error(
				`upload aborted for this run (no email): attempted=${attempted} failed=${failed} consecutiveFails=${consecutiveFails}`,
			);
		}

		const result: XissmieStoreEmojiSyncResult = {
			total: data.length,
			success,
			failed,
			skippedExcluded,
			deferred,
			circuitOpened,
		};
		this.logger.info(
			`emojis sync done: total=${result.total} success=${result.success} failed=${result.failed} skippedExcluded=${result.skippedExcluded} deferred=${result.deferred} circuitOpened=${result.circuitOpened} attemptedUploads=${attempted}`,
		);
		return result;
	}

	@bindThis
	public async checkStoreEmojiIntegrity(): Promise<XissmieStoreEmojiIntegrityResult> {
		const missing: { id: string; name: string; publicUrl: string }[] = [];
		let scanned = 0;
		let skippedNonLocalUrl = 0;
		let transientErrors = 0;
		let cursor: string | null = null;

		while (true) {
			const page = await this.emojisRepository.find({
				where: cursor == null
					? { isInStore: true }
					: { isInStore: true, id: MoreThan(cursor) },
				order: { id: 'ASC' },
				take: INTEGRITY_PAGE_SIZE,
			});
			if (page.length === 0) break;

			scanned += page.length;
			const limit = promiseLimit<IntegrityProbeResult>(INTEGRITY_CONCURRENCY);
			const results = await Promise.all(page.map(emoji => limit(() => this.probeStoreEmojiObject(emoji))));

			for (let i = 0; i < page.length; i++) {
				const emoji = page[i]!;
				const result = results[i]!;
				if (result === 'skip') {
					skippedNonLocalUrl++;
				} else if (result === 'transient') {
					transientErrors++;
					this.integrityLogger.warn(`transient error checking emoji: id=${emoji.id} name=${emoji.name}`);
				} else if (result === 'missing') {
					missing.push({ id: emoji.id, name: emoji.name, publicUrl: emoji.publicUrl });
					this.integrityLogger.error(`missing object: id=${emoji.id} name=${emoji.name} publicUrl=${emoji.publicUrl}`);
				}
			}

			cursor = page[page.length - 1]!.id;
			if (page.length < INTEGRITY_PAGE_SIZE) break;
		}

		// メールは再試行上限到達時のみ。日次検知はログに残し、除外済みは件数から外す。
		let newlyReported = 0;
		for (const item of missing) {
			if (await this.isRetryLimitReached(item.id)) {
				continue;
			}
			newlyReported++;
		}

		const summary: XissmieStoreEmojiIntegrityResult = {
			scanned,
			missing: missing.length,
			skippedNonLocalUrl,
			transientErrors,
			newlyReported,
		};
		this.integrityLogger.info(
			`integrity check done: scanned=${summary.scanned} missing=${summary.missing} skippedNonLocalUrl=${summary.skippedNonLocalUrl} transientErrors=${summary.transientErrors} reportableMissing=${summary.newlyReported}`,
		);
		return summary;
	}

	@bindThis
	private async probeStoreEmojiObject(emoji: MiEmoji): Promise<IntegrityProbeResult> {
		if (this.meta.useObjectStorage) {
			const baseUrl = getObjectStoragePublicBaseUrl(this.meta);
			const key = tryParseObjectStorageKey(baseUrl, emoji.publicUrl);
			if (key == null) return 'skip';
			try {
				await this.s3Service.head(this.meta, {
					Bucket: this.meta.objectStorageBucket ?? undefined,
					Key: key,
				});
				return 'ok';
			} catch (err) {
				if (isS3ObjectNotFoundError(err)) return 'missing';
				this.integrityLogger.warn(`HeadObject failed: id=${emoji.id} key=${key}`, { e: err });
				return 'transient';
			}
		}

		const key = tryParseInternalStorageKey(this.config.url, emoji.publicUrl);
		if (key == null) return 'skip';
		try {
			const res = await this.httpRequestService.send(emoji.publicUrl, {
				method: 'HEAD',
				timeout: 5000,
				isLocalAddressAllowed: true,
			}, {
				throwErrorWhenResponseNotOk: false,
			});
			if (res.status === 404) return 'missing';
			if (res.ok) return 'ok';
			this.integrityLogger.warn(`HEAD ${res.status} for id=${emoji.id} publicUrl=${emoji.publicUrl}`);
			return 'transient';
		} catch (err) {
			this.integrityLogger.warn(`HEAD failed: id=${emoji.id} publicUrl=${emoji.publicUrl}`, { e: err });
			return 'transient';
		}
	}

	@bindThis
	private async isRetryLimitReached(emojiId: string): Promise<boolean> {
		const value = await this.redisClient.get(retryRedisKey(emojiId));
		return parseRetryRunCount(value) >= MAX_RUNS;
	}

	@bindThis
	private buildEmojiUpsertRow(
		x: StoreEmojiCatalogItem,
		emojiName: string,
		publicUrl: string,
		incomingUpdatedAt: Date,
		ex: MiEmoji | undefined,
	): EmojiUpsertRow {
		const keywordsInput: string[] = Array.isArray(x.keywords) ? x.keywords : [];
		const keywords = keywordsInput.map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
		const aliasSet = new Set<string>((ex?.aliases ?? []).map(a => a.toLowerCase()));
		aliasSet.add(x.name.toLowerCase());
		for (const k of keywords) aliasSet.add(k);

		return {
			id: x.id,
			name: emojiName,
			originalUrl: x.imageUrl,
			publicUrl,
			updatedAt: incomingUpdatedAt,
			category: '★creator★',
			license: x.authorName,
			localOnly: true,
			isSensitive: false,
			isInStore: true,
			isPublic: x.isPublic,
			storeProductId: x.productId ?? null,
			storeAuthorId: x.authorId,
			storeAuthorName: x.authorName,
			aliases: Array.from(aliasSet),
		};
	}

	@bindThis
	private async uploadEmojiWithRetries(x: StoreEmojiCatalogItem, emojiName: string): Promise<string | null> {
		for (let attempt = 1; attempt <= IN_RUN_MAX_ATTEMPTS; attempt++) {
			try {
				const publicUrl = await this.uploadEmojiOnce(x);
				if (publicUrl == null || publicUrl === '') {
					throw new Error('empty publicUrl');
				}
				return publicUrl;
			} catch (err) {
				const reason = err instanceof Error ? err.message : String(err);
				this.logger.error(
					`emoji upload failed: id=${x.id} name=${emojiName} attempt=${attempt}/${IN_RUN_MAX_ATTEMPTS} reason=${reason}`,
					{ emojiId: x.id, emojiName, e: err },
				);
				if (attempt < IN_RUN_MAX_ATTEMPTS) {
					const delay = backoffDelayMs(attempt - 1);
					await new Promise<void>(resolve => setTimeout(resolve, delay));
				}
			}
		}
		return null;
	}

	@bindThis
	private async uploadEmojiOnce(x: StoreEmojiCatalogItem): Promise<string | null> {
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			const file = await Promise.race([
				this.driveService.uploadFromUrl({
					url: x.imageUrl,
					user: null,
					isLink: false,
					comment: `emoji:${x.id}`,
				}),
				new Promise<never>((_, reject) => {
					timer = setTimeout(() => reject(new Error(`upload timeout (${ATTEMPT_TIMEOUT_MS}ms)`)), ATTEMPT_TIMEOUT_MS);
				}),
			]);
			return file.webpublicUrl ?? file.url;
		} finally {
			if (timer != null) clearTimeout(timer);
		}
	}

	/* unused
	@bindThis
	public async avatarDecorationPurchased(userId: MiUser['id'], avatarDecorationIds: string[], purchasedAt: Date | null = null): Promise<void> {
		await this.userOwnedAvatarDecorationsRepository.insert(avatarDecorationIds.map((avatarDecorationId) => ({
			id: this.idService.gen(),
			userId,
			avatarDecorationId,
			purchasedAt: purchasedAt ?? new Date(),
		})));
	}

	@bindThis
	public async emojiPurchased(userId: MiUser['id'], emojiIds: string[], purchasedAt: Date | null = null): Promise<void> {
		await this.userOwnedEmojisRepository.insert(emojiIds.map((emojiId) => ({
			id: this.idService.gen(),
			userId,
			emojiId,
			purchasedAt: purchasedAt ?? new Date(),
		})));
	}
	*/

	@bindThis
	public async fetchPurchasedAvatarDecorationsFromStore(userId: MiUser['id']) {
		const currentlyOwned = await this.userOwnedAvatarDecorationsRepository.find({
			where: {
				userId,
			},
		});
		const currentlyOwnedDecorationIds = new Set(currentlyOwned.map(x => x.avatarDecorationId));

		const params = new URLSearchParams({
			userId,
			token: this.config.xfolioApiToken,
		});

		const res = await this.httpRequestService.send(`https://${this.config.xfolioApiHost}/api/v1/xissmie/users_purchased_decorations`, {
			method: 'POST',
			body: params.toString(),
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});

		const data = await res.json() as { avatarDecorations: { id: string; purchasedAt: number; }[] };

		//const data = { avatarDecorations: [{ id: 'da', purchasedAt: 0 }] };

		const newDecorations = data.avatarDecorations.filter(x => !currentlyOwnedDecorationIds.has(x.id));

		if (newDecorations.length > 0) {
			// TODO: 当該コンテンツがまだfetchされていなかった場合のケア
			await this.userOwnedAvatarDecorationsRepository.insert(newDecorations.map((x) => ({
				id: this.idService.gen(x.purchasedAt),
				userId,
				avatarDecorationId: x.id,
				purchasedAt: new Date(x.purchasedAt),
			})));
		}
	}

	@bindThis
	public async fetchPurchasedEmojisFromStore(userId: MiUser['id']) {
		const currentlyOwned = await this.userOwnedEmojisRepository.find({
			where: {
				userId,
			},
		});
		const currentlyOwnedEmojiIds = new Set(currentlyOwned.map(x => x.emojiId));

		const params = new URLSearchParams({
			userId,
			token: this.config.xfolioApiToken,
		});

		const res = await this.httpRequestService.send(`https://${this.config.xfolioApiHost}/api/v1/xissmie/users_purchased_emojis`, {
			method: 'POST',
			body: params.toString(),
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});

		const data = await res.json() as { emojis: { id: string; purchasedAt: number; }[] };

		//const data = { emojis: [{ id: 'ea', purchasedAt: 0 }] };

		const newEmojis = data.emojis.filter(x => !currentlyOwnedEmojiIds.has(x.id));

		if (newEmojis.length > 0) {
			const foundEmojis = await this.emojisRepository.findBy({
				id: In(newEmojis.map(x => x.id)),
			});

			await this.userOwnedEmojisRepository.insert(foundEmojis.map((x) => ({
				id: this.idService.gen(newEmojis.find(e => e.id === x.id)!.purchasedAt),
				userId,
				emojiId: x.id,
				emojiName: x.name,
				purchasedAt: new Date(newEmojis.find(e => e.id === x.id)!.purchasedAt),
			})));
		}
	}

	@bindThis
	public async getPurchasedDecorations(userId: MiUser['id']) {
		const ownedDecorations = await this.userOwnedAvatarDecorationsRepository.find({
			where: {
				userId,
			},
			relations: { avatarDecoration: true },
		});

		return ownedDecorations.map(x => x.avatarDecoration).filter((x): x is NonNullable<typeof x> => x != null);
	}
}
