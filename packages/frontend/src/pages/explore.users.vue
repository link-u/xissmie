<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_spacer" style="--MI_SPACER-w: 1200px;">
	<template v-if="tag == null">
		<MkFoldableSection class="_margin" persistKey="explore-pinned-users">
			<template #header><i class="ti ti-bookmark ti-fw" style="margin-right: 0.5em;"></i>{{ i18n.ts.pinnedUsers }}</template>
			<MkUserList :paginator="pinnedUsersPaginator"/>
		</MkFoldableSection>
		<MkFoldableSection class="_margin" persistKey="explore-popular-users">
			<template #header><i class="ti ti-chart-line ti-fw" style="margin-right: 0.5em;"></i>{{ i18n.ts.popularUsers }}</template>
			<MkUserList :paginator="popularUsersPaginator"/>
		</MkFoldableSection>
		<MkFoldableSection class="_margin" persistKey="explore-recently-updated-users">
			<template #header><i class="ti ti-message ti-fw" style="margin-right: 0.5em;"></i>{{ i18n.ts.recentlyUpdatedUsers }}</template>
			<MkUserList :paginator="recentlyUpdatedUsersPaginator"/>
		</MkFoldableSection>
		<MkFoldableSection class="_margin" persistKey="explore-recently-registered-users">
			<template #header><i class="ti ti-plus ti-fw" style="margin-right: 0.5em;"></i>{{ i18n.ts.recentlyRegisteredUsers }}</template>
			<MkUserList :paginator="recentlyRegisteredUsersPaginator"/>
		</MkFoldableSection>
	</template>
	<MkFoldableSection v-else-if="tagUsersPaginator != null" :key="`${tag}`" class="_margin">
		<template #header><i class="ti ti-hash ti-fw" style="margin-right: 0.5em;"></i>{{ tag }}</template>
		<MkUserList :paginator="tagUsersPaginator"/>
	</MkFoldableSection>
</div>
</template>

<script lang="ts" setup>
import { markRaw } from 'vue';
import MkUserList from '@/components/MkUserList.vue';
import MkFoldableSection from '@/components/MkFoldableSection.vue';
import { i18n } from '@/i18n.js';
import { Paginator } from '@/utility/paginator.js';

const props = defineProps<{
	tag?: string;
}>();

const tagUsersPaginator = props.tag != null ? markRaw(new Paginator('hashtags/users', {
	limit: 30,
	params: {
		tag: props.tag,
		origin: 'local',
		sort: '+follower',
	},
})) : null;

const pinnedUsersPaginator = markRaw(new Paginator('pinned-users', {
	noPaging: true,
}));

const popularUsersPaginator = markRaw(new Paginator('users', {
	limit: 10,
	noPaging: true,
	params: {
		state: 'alive',
		origin: 'local',
		sort: '+follower',
	},
}));

const recentlyUpdatedUsersPaginator = markRaw(new Paginator('users', {
	limit: 10,
	noPaging: true,
	params: {
		origin: 'local',
		sort: '+updatedAt',
	},
}));

const recentlyRegisteredUsersPaginator = markRaw(new Paginator('users', {
	limit: 10,
	noPaging: true,
	params: {
		origin: 'local',
		state: 'alive',
		sort: '+createdAt',
	},
}));
</script>
