<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :actions="headerActions" :tabs="headerTabs" :swipable="true">
	<div v-if="tab === 'overview'" class="_spacer" style="--MI_SPACER-w: 600px; --MI_SPACER-min: 20px;">
		<XOverview/>
	</div>
	<div v-else-if="tab === 'emojis'" class="_spacer" style="--MI_SPACER-w: 1000px; --MI_SPACER-min: 20px;">
		<XEmojis/>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { instance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { claimAchievement } from '@/utility/achievements.js';
import { definePage } from '@/page.js';

const XOverview = defineAsyncComponent(() => import('@/pages/about.overview.vue'));
const XEmojis = defineAsyncComponent(() => import('@/pages/about.emojis.vue'));

const props = withDefaults(defineProps<{
	initialTab?: string;
}>(), {
	initialTab: 'overview',
});

const tab = ref(props.initialTab);

watch(tab, () => {
	if (tab.value === 'charts') {
		claimAchievement('viewInstanceChart');
	}
});

const headerActions = computed(() => []);

const headerTabs = computed(() => {
	const items = [];

	items.push({
		key: 'overview',
		title: i18n.ts.overview,
	}, {
		key: 'emojis',
		title: i18n.ts.customEmojis,
		icon: 'ti ti-icons',
	});

	return items;
});

definePage(() => ({
	title: i18n.ts.instanceInfo,
	icon: 'ti ti-info-circle',
}));
</script>
