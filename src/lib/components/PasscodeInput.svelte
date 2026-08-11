<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { cn } from '$lib/utils';

	let {
		id,
		name,
		focus = false,
		class: className
	}: { id: string; name: string; focus?: boolean; class?: string } = $props();

	let element = $state<HTMLInputElement | null>(null);
	$effect(() => {
		if (focus) element?.focus();
	});
</script>

<!-- A password field rather than a numeric one so the code is not shoulder-readable,
     with inputmode=numeric to still raise a keypad on a phone. -->
<Input
	bind:ref={element}
	{id}
	{name}
	type="password"
	inputmode="numeric"
	pattern={'\\d{4}'}
	maxlength={4}
	minlength={4}
	required
	autocomplete="off"
	placeholder="••••"
	class={cn('h-12 text-center font-mono text-2xl tracking-[0.6em]', className)}
	oninput={(event) => {
		const input = event.currentTarget as HTMLInputElement;
		input.value = input.value.replace(/\D/g, '').slice(0, 4);
	}}
/>
