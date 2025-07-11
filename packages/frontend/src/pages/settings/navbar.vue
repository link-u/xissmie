<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/navbar" :label="i18n.ts.navbar" icon="ti ti-list" :keywords="['navbar', 'menu', 'sidebar']">
	<div class="_gaps_m">
		<FormSlot>
			<template #label>{{ i18n.ts.navbar }}</template>
			<MkContainer :showHeader="false">
				<Sortable
					v-model="items"
					itemKey="id"
					:animation="150"
					:handle="'.' + $style.itemHandle"
					@start="e => e.item.classList.add('active')"
					@end="e => e.item.classList.remove('active')"
				>
					<template #item="{element,index}">
						<div
							v-if="element.type === '-' || navbarItemDef[element.type]"
							:class="$style.item"
						>
							<button class="_button" :class="$style.itemHandle"><i class="ti ti-menu"></i></button>
							<template v-if="navbarItemDef[element.type]?.icon?.startsWith('material-symbols:')">
								<MkIcon :icon="navbarItemDef[element.type].icon" :class="$style.itemIcon"/>
							</template>
							<template v-else>
								<i class="ti-fw" :class="[$style.itemIcon, navbarItemDef[element.type]?.icon]"></i>
							</template>
							<span :class="$style.itemText">{{ navbarItemDef[element.type]?.title ?? i18n.ts.divider }}</span>
							<button class="_button" :class="$style.itemRemove" @click="removeItem(index)"><i class="ti ti-x"></i></button>
						</div>
					</template>
				</Sortable>
			</MkContainer>
		</FormSlot>
		<div class="_buttons">
			<MkButton @click="addItem"><i class="ti ti-plus"></i> {{ i18n.ts.addItem }}</MkButton>
			<MkButton danger @click="reset"><i class="ti ti-reload"></i> {{ i18n.ts.default }}</MkButton>
			<MkButton primary class="save" @click="save"><i class="ti ti-device-floppy"></i> {{ i18n.ts.save }}</MkButton>
		</div>

		<MkRadios v-model="menuDisplay">
			<template #label>{{ i18n.ts.display }}</template>
			<option value="sideFull">{{ i18n.ts._menuDisplay.sideFull }}</option>
			<option value="sideIcon">{{ i18n.ts._menuDisplay.sideIcon }}</option>
		</MkRadios>

		<SearchMarker :keywords="['navbar', 'sidebar', 'toggle', 'button', 'sub']">
			<MkPreferenceContainer k="showNavbarSubButtons">
				<MkSwitch v-model="showNavbarSubButtons">
					<template #label><SearchLabel>{{ i18n.ts._settings.showNavbarSubButtons }}</SearchLabel></template>
				</MkSwitch>
			</MkPreferenceContainer>
		</SearchMarker>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import MkRadios from '@/components/MkRadios.vue';
import MkButton from '@/components/MkButton.vue';
import FormSlot from '@/components/form/slot.vue';
import MkContainer from '@/components/MkContainer.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkPreferenceContainer from '@/components/MkPreferenceContainer.vue';
import * as os from '@/os.js';
import { navbarItemDef } from '@/navbar.js';
import { store } from '@/store.js';
import { reloadAsk } from '@/utility/reload-ask.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { prefer } from '@/preferences.js';
import { PREF_DEF } from '@/preferences/def.js';
import { getInitialPrefValue } from '@/preferences/manager.js';
import MkIcon from '@/components/MkIcon.vue';
import { genId } from '@/utility/id.js';

const Sortable = defineAsyncComponent(() => import('vuedraggable').then(x => x.default));

const items = ref(prefer.s.menu.map(x => ({
	id: genId(),
	type: x,
})));

const menuDisplay = computed(store.makeGetterSetter('menuDisplay'));
const showNavbarSubButtons = prefer.model('showNavbarSubButtons');

async function addItem() {
	const menu = Object.keys(navbarItemDef).filter(k => !prefer.s.menu.includes(k));
	const { canceled, result: item } = await os.select({
		title: i18n.ts.addItem,
		items: [...menu.map(k => ({
			value: k, text: navbarItemDef[k].title,
		})), {
			value: '-', text: i18n.ts.divider,
		}],
	});
	if (canceled) return;
	items.value = [...items.value, {
		id: genId(),
		type: item,
	}];
}

function removeItem(index: number) {
	items.value.splice(index, 1);
}

async function save() {
	prefer.commit('menu', items.value.map(x => x.type));
}

function reset() {
	items.value = getInitialPrefValue('menu').map(x => ({
		id: genId(),
		type: x,
	}));
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.navbar,
	icon: 'ti ti-list',
}));
</script>

<style lang="scss" module>
.item {
	position: relative;
	display: block;
	line-height: 2.85rem;
	text-overflow: ellipsis;
	overflow: hidden;
	white-space: nowrap;
	color: var(--MI_THEME-navFg);
}

.itemIcon {
	position: relative;
	width: 32px;
	margin-right: 8px;
	display: inline-flex;
	align-items: center;
	justify-content: center;

	/* MkIconコンポーネント内のSVGの色を設定 */
	:deep(svg) {
		fill: currentColor !important;
	}

	:deep(path) {
		fill: currentColor !important;
	}

	:deep(.root) {
		color: inherit !important;
	}
}

.itemText {
	position: relative;
	font-size: 0.9em;
}

.itemRemove {
	position: absolute;
	z-index: 10000;
	width: 32px;
	height: 32px;
	color: #ff2a2a;
	right: 8px;
	opacity: 0.8;
}

.itemHandle {
	cursor: move;
	width: 32px;
	height: 32px;
	margin: 0 8px;
	opacity: 0.5;
}
</style>
