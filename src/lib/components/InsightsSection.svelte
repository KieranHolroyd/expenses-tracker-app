<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * One chapter of the insights page. The heading carries the framing so the
	 * cards underneath can get straight to their numbers instead of each
	 * re-introducing itself.
	 */
	let {
		id,
		step,
		title,
		description,
		children
	}: {
		id: string;
		step: string;
		title: string;
		description?: string;
		children: Snippet;
	} = $props();
</script>

<section {id} class="mb-14 scroll-mt-24">
	<div
		class="border-line mb-6 flex items-end justify-between gap-8 border-b pb-4 max-sm:flex-col max-sm:items-start"
	>
		<div>
			<p class="text-coral mb-2 text-[11px] font-extrabold tracking-[.16em] uppercase">
				{step}
			</p>
			<h2 class="font-serif text-[clamp(24px,2.4vw,32px)] leading-tight tracking-[-.02em]">
				{title}
			</h2>
		</div>
		{#if description}
			<p class="text-muted-foreground max-w-md text-sm leading-relaxed max-sm:max-w-none">
				{description}
			</p>
		{/if}
	</div>
	{@render children()}
</section>
