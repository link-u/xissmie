<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/avatar-decoration" :label="i18n.ts.avatarDecorations" :keywords="['avatar', 'icon', 'decoration']" icon="ti ti-sparkles">
	<div>
		<div v-if="!loading && !loadingError" class="_gaps">
			<MkInfo>{{ i18n.tsx._profile.avatarDecorationMax({ max: $i.policies.avatarDecorationLimit }) }} ({{ i18n.tsx.remainingN({ n: $i.policies.avatarDecorationLimit - $i.avatarDecorations.length }) }})</MkInfo>

			<MkAvatar :class="$style.avatar" :user="$i" forceShowDecoration/>

			<div v-if="$i.avatarDecorations.length > 0" v-panel :class="$style.current" class="_gaps_s">
				<div>{{ i18n.ts.inUse }}</div>

				<div :class="$style.decorations">
					<XDecoration
						v-for="(avatarDecoration, i) in $i.avatarDecorations"
						:decoration="allDecorations.find(d => d.id === avatarDecoration.id) ?? { id: '', url: '', name: '?', roleIdsThatCanBeUsedThisDecoration: [] }"
						:angle="avatarDecoration.angle"
						:flipH="avatarDecoration.flipH"
						:offsetX="avatarDecoration.offsetX"
						:offsetY="avatarDecoration.offsetY"
						:active="true"
						@click="openAttachedDecoration(i)"
					/>
				</div>

				<MkButton danger @click="detachAllDecorations">{{ i18n.ts.detachAll }}</MkButton>
			</div>

			<div :class="$style.decorations">
				<XDecoration
					v-for="avatarDecoration in serverAvatarDecorations"
					:key="avatarDecoration.id"
					:decoration="avatarDecoration"
					@click="openDecoration(avatarDecoration)"
				/>
			</div>

			<hr>

			<div>購入済み</div>

			<div :class="$style.decorations">
				<XDecoration
					v-for="avatarDecoration in purchasedAvatarDecorations"
					:key="avatarDecoration.id"
					:decoration="avatarDecoration"
					@click="openDecoration(avatarDecoration)"
				/>
			</div>
			<MkButton primary rounded :wait="purchasedDecorationsLoading" @click="refreshPurchasedDecorations"><i class="ti ti-refresh"></i> 更新</MkButton>

			<hr>

			<div>★creator★</div>

			<div :class="$style.decorations">
				<XDecoration
					v-for="avatarDecoration in publicStoreAvatarDecorations"
					:key="avatarDecoration.id"
					:decoration="avatarDecoration"
					:locked="!purchasedAvatarDecorations.some(d => d.id === avatarDecoration.id)"
					@click="openDecoration(avatarDecoration)"
				/>
			</div>
			<MkButton primary rounded :wait="storeDecorationsLoading" :disabled="!hasMoreStoreDecorations" @click="loadMoreStoreDecorations">もっと見る</MkButton>
		</div>
		<div v-else-if="loading">
			<MkLoading/>
		</div>
		<div v-else class="_gaps">
			<MkInfo warn>{{ i18n.ts.somethingHappened }}</MkInfo>
			<MkButton @click="loadDecorations">{{ i18n.ts.retry }}</MkButton>
		</div>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import * as Misskey from 'misskey-js';
import XDecoration from './avatar-decoration.decoration.vue';
import XDialog from './avatar-decoration.dialog.vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { ensureSignin } from '@/i.js';
import MkInfo from '@/components/MkInfo.vue';
import { definePage } from '@/page.js';
import { xissmieAvatarDecorationPurchaseRequired } from '@/xissmie.js';
import { fetchMoreStoreItems } from '@/utility/xissmie-store.js';

const $i = ensureSignin();

const loading = ref(true);
const loadingError = ref(false);
const purchasedDecorationsLoading = ref(false);
const storeDecorationsLoading = ref(false);
const hasMoreStoreDecorations = ref(false);
const STORE_DECORATIONS_PAGE_SIZE = 30;
const serverAvatarDecorations = ref<Misskey.entities.GetAvatarDecorationsResponse>([]);
const purchasedAvatarDecorations = ref<Misskey.entities.GetAvatarDecorationsResponse>([]);
const storeAvatarDecorations = ref<Misskey.entities.XissmieStoreAvatarDecorationsResponse>([]);
const publicStoreAvatarDecorations = computed(() =>
	storeAvatarDecorations.value.filter((x) => (x as { isPublic?: boolean }).isPublic),
);
const allDecorations = computed(() => [...serverAvatarDecorations.value, ...purchasedAvatarDecorations.value]);

void loadDecorations();

async function loadDecorations() {
	loading.value = true;
	loadingError.value = false;
	try {
		const [server, purchased, catalog] = await Promise.all([
			misskeyApi('get-avatar-decorations'),
			misskeyApi('xissmie/purchased-avatar-decorations'),
			misskeyApi('xissmie/store-avatar-decorations', { limit: STORE_DECORATIONS_PAGE_SIZE }),
		]);
		serverAvatarDecorations.value = server;
		purchasedAvatarDecorations.value = purchased;
		storeAvatarDecorations.value = catalog;
		hasMoreStoreDecorations.value = catalog.length >= STORE_DECORATIONS_PAGE_SIZE;
	} catch {
		loadingError.value = true;
	} finally {
		loading.value = false;
	}
}

async function refreshPurchasedDecorations() {
	if (purchasedDecorationsLoading.value) return;
	purchasedDecorationsLoading.value = true;
	try {
		purchasedAvatarDecorations.value = await misskeyApi('xissmie/purchased-avatar-decorations');
	} catch {
		void os.alert({ type: 'error', text: i18n.ts.somethingHappened });
	} finally {
		purchasedDecorationsLoading.value = false;
	}
}

async function loadMoreStoreDecorations() {
	if (storeDecorationsLoading.value || !hasMoreStoreDecorations.value) return;
	storeDecorationsLoading.value = true;
	try {
		const page = await fetchMoreStoreItems(storeAvatarDecorations.value, STORE_DECORATIONS_PAGE_SIZE, untilId => misskeyApi('xissmie/store-avatar-decorations', {
			limit: STORE_DECORATIONS_PAGE_SIZE,
			untilId,
		}));
		storeAvatarDecorations.value = page.items;
		hasMoreStoreDecorations.value = page.hasMore;
	} catch {
		void os.alert({ type: 'error', text: i18n.ts.somethingHappened });
	} finally {
		storeDecorationsLoading.value = false;
	}
}

function openAttachedDecoration(index: number) {
	const d = allDecorations.value.find(d => d.id === $i.avatarDecorations[index].id);
	openDecoration(d ?? { id: '', url: '', name: '?', roleIdsThatCanBeUsedThisDecoration: [] }, index);
}

async function openDecoration(avatarDecoration: {
	id: string;
	url: string;
	name: string;
	roleIdsThatCanBeUsedThisDecoration: string[];
}, index?: number) {
	if (storeAvatarDecorations.value.some(d => d.id === avatarDecoration.id) && !purchasedAvatarDecorations.value.some(d => d.id === avatarDecoration.id)) {
		xissmieAvatarDecorationPurchaseRequired(avatarDecoration);
		return;
	}

	const { dispose } = os.popup(XDialog, {
		decoration: avatarDecoration,
		usingIndex: index ?? null,
	}, {
		'attach': async (payload) => {
			const decoration = {
				id: avatarDecoration.id,
				url: avatarDecoration.url,
				angle: payload.angle,
				flipH: payload.flipH,
				offsetX: payload.offsetX,
				offsetY: payload.offsetY,
			};
			const update = [...$i.avatarDecorations, decoration];
			await os.apiWithDialog('i/update', {
				avatarDecorations: update,
			});
			$i.avatarDecorations = update;
		},
		'update': async (payload) => {
			const decoration = {
				id: avatarDecoration.id,
				url: avatarDecoration.url,
				angle: payload.angle,
				flipH: payload.flipH,
				offsetX: payload.offsetX,
				offsetY: payload.offsetY,
			};
			const update = [...$i.avatarDecorations];
			update[index!] = decoration;
			await os.apiWithDialog('i/update', {
				avatarDecorations: update,
			});
			$i.avatarDecorations = update;
		},
		'detach': async () => {
			const update = [...$i.avatarDecorations];
			update.splice(index!, 1);
			await os.apiWithDialog('i/update', {
				avatarDecorations: update,
			});
			$i.avatarDecorations = update;
		},
		closed: () => dispose(),
	});
}

function detachAllDecorations() {
	os.confirm({
		type: 'warning',
		text: i18n.ts.areYouSure,
	}).then(async ({ canceled }) => {
		if (canceled) return;
		await os.apiWithDialog('i/update', {
			avatarDecorations: [],
		});
		$i.avatarDecorations = [];
	});
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.avatarDecorations,
	icon: 'ti ti-sparkles',
}));
</script>

<style lang="scss" module>
.avatar {
	display: inline-block;
	width: 72px;
	height: 72px;
	margin: 16px auto;
}

.current {
	padding: 16px;
	border-radius: var(--MI-radius);
}

.decorations {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
	grid-gap: 12px;
}
</style>
