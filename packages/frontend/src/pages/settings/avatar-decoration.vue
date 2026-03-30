<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/avatar-decoration" :label="i18n.ts.avatarDecorations" :keywords="['avatar', 'icon', 'decoration']" icon="ti ti-sparkles">
	<div>
		<div v-if="!loading" class="_gaps">
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
			<MkButton primary rounded @click="refreshPurchasedDecorations"><i class="ti ti-refresh"></i> 更新</MkButton>

			<hr>

			<div>★creator★</div>

			<div :class="$style.decorations">
				<XDecoration
					v-for="avatarDecoration in storeAvatarDecorations"
					:key="avatarDecoration.id"
					:decoration="avatarDecoration"
					:locked="!purchasedAvatarDecorations.some(d => d.id === avatarDecoration.id)"
					@click="openDecoration(avatarDecoration)"
				/>
			</div>
			<MkButton primary rounded @click="loadMoreStoreDecorations">もっと見る</MkButton>
		</div>
		<div v-else>
			<MkLoading/>
		</div>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import { ref, defineAsyncComponent, computed } from 'vue';
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

const $i = ensureSignin();

const loading = ref(true);
const serverAvatarDecorations = ref<Misskey.entities.GetAvatarDecorationsResponse>([]);
const purchasedAvatarDecorations = ref<Misskey.entities.GetAvatarDecorationsResponse>([]);
const storeAvatarDecorations = ref<Misskey.entities.XissmieStoreAvatarDecorationsResponse>([]);
const allDecorations = computed(() => [...serverAvatarDecorations.value, ...purchasedAvatarDecorations.value]);

Promise.all([misskeyApi('get-avatar-decorations'), misskeyApi('xissmie/purchased-avatar-decorations')]).then(([s, p]) => {
	serverAvatarDecorations.value = s;
	purchasedAvatarDecorations.value = p;
	loading.value = false;
});

misskeyApi('xissmie/store-avatar-decorations').then((storeDecorations) => {
	storeAvatarDecorations.value = storeDecorations;
});

function refreshPurchasedDecorations() {
	misskeyApi('xissmie/purchased-avatar-decorations').then(p => {
		purchasedAvatarDecorations.value = p;
	});
}

function loadMoreStoreDecorations() {
	misskeyApi('xissmie/store-avatar-decorations', {
		untilId: storeAvatarDecorations.value[storeAvatarDecorations.value.length - 1]!.id,
	}).then(x => {
		storeAvatarDecorations.value = storeAvatarDecorations.value.concat(x);
	});
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
