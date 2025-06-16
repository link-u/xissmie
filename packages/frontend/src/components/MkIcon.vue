<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div
	:class="[$style.root, className]"
	:style="{ fontSize: size ? `${size}px` : undefined }"
	v-html="iconSvg"
/>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import volunteerActivismIcon from '@material-symbols/svg-400/outlined/volunteer_activism.svg?raw';

const props = defineProps<{
	icon: string;
	size?: number;
	className?: string;
}>();

// アイコンマップ（必要に応じて追加）
const iconMap: Record<string, string> = {
	'volunteer_activism': volunteerActivismIcon,
};

const iconSvg = computed(() => {
	if (props.icon.startsWith('material-symbols:')) {
		const iconName = props.icon.replace('material-symbols:', '');
		const rawSvg = iconMap[iconName] || '';

		if (rawSvg) {
			// SVGにfill="currentColor"を追加し、width/heightを小さく設定
			return rawSvg
				.replace(/<svg([^>]*)>/, '<svg$1 fill="currentColor">')
				.replace(/<path([^>]*?)>/g, '<path$1 fill="currentColor">')
				.replace(/width="[^"]*"/g, 'width="24"')
				.replace(/height="[^"]*"/g, 'height="24"');
		}
	}
	return '';
});
</script>

<style lang="scss" module>
.root {
	display: inline-block;
	vertical-align: middle;
	color: inherit;

	:deep(svg) {
		fill: currentColor !important;
		color: inherit;
	}

	:deep(path) {
		fill: currentColor !important;
	}
}
</style>
