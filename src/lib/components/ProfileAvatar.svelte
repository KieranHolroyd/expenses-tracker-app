<script lang="ts">
	import * as Avatar from '$lib/components/ui/avatar';

	let {
		name,
		color,
		class: className = ''
	}: { name: string; color: string; class?: string } = $props();

	let initial = $derived(name.trim().charAt(0).toUpperCase() || '?');
</script>

<Avatar.Root class={className}>
	<Avatar.Fallback
		class="text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)]"
		style={`background-color: ${color}`}
	>
		{initial}
	</Avatar.Fallback>
</Avatar.Root>
