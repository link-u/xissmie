<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/security" :label="i18n.ts.security" :keywords="['security']" icon="ti ti-lock" :inlining="['2fa']">
	<div class="_gaps_m">
		<MkFeatureBanner icon="/client-assets/locked_with_key_3d.png" color="#ffbf00">
			<SearchKeyword>{{ i18n.ts._settings.securityBanner }}</SearchKeyword>
		</MkFeatureBanner>

		<X2fa/>

		<FormSection>
			<template #label>{{ i18n.ts.signinHistory }}</template>
			<MkPagination :pagination="pagination" disableAutoLoad>
				<template #default="{items}">
					<div>
						<div v-for="item in items" :key="item.id" v-panel class="timnmucd">
							<header>
								<i v-if="item.success" class="ti ti-check icon succ"></i>
								<i v-else class="ti ti-circle-x icon fail"></i>
								<code class="ip _monospace">{{ item.ip }}</code>
								<MkTime :time="item.createdAt" class="time"/>
							</header>
						</div>
					</div>
				</template>
			</MkPagination>
		</FormSection>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import X2fa from './2fa.vue';
import FormSection from '@/components/form/section.vue';
import MkButton from '@/components/MkButton.vue';
import MkPagination from '@/components/MkPagination.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import MkFeatureBanner from '@/components/MkFeatureBanner.vue';

const pagination = {
	endpoint: 'i/signin-history' as const,
	limit: 5,
};

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.security,
	icon: 'ti ti-lock',
}));
</script>

<style lang="scss" scoped>
.timnmucd {
	padding: 12px;

	&:first-child {
		border-top-left-radius: 6px;
		border-top-right-radius: 6px;
	}

	&:last-child {
		border-bottom-left-radius: 6px;
		border-bottom-right-radius: 6px;
	}

	&:not(:last-child) {
		border-bottom: solid 0.5px var(--MI_THEME-divider);
	}

	> header {
		display: flex;
		align-items: center;

		> .icon {
			width: 1em;
			margin-right: 0.75em;

			&.succ {
				color: var(--MI_THEME-success);
			}

			&.fail {
				color: var(--MI_THEME-error);
			}
		}

		> .ip {
			flex: 1;
			min-width: 0;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			margin-right: 12px;
		}

		> .time {
			margin-left: auto;
			opacity: 0.7;
		}
	}
}
</style>
