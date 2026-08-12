<script lang="ts">
	import { Combobox } from 'bits-ui';
	import { Check, ChevronDown, Plus } from '@lucide/svelte';
	import { categoryColor } from '$lib/format';

	/**
	 * A category picker that also accepts categories that do not exist yet: type a
	 * name nothing matches and the list offers to use it as typed. The value is
	 * mirrored into a hidden input so the surrounding form posts without JS having
	 * to assemble anything.
	 */
	let {
		value = $bindable(''),
		categories,
		name = 'category',
		id = 'expense-category',
		maxLength = 32
	}: {
		value: string;
		categories: string[];
		name?: string;
		id?: string;
		maxLength?: number;
	} = $props();

	let open = $state(false);
	let search = $state('');
	let trimmed = $derived(search.trim());
	let matches = $derived(
		trimmed
			? categories.filter((category) => category.toLowerCase().includes(trimmed.toLowerCase()))
			: categories
	);
	let exists = $derived(
		categories.some((category) => category.toLowerCase() === trimmed.toLowerCase())
	);
	let canCreate = $derived(trimmed.length > 0 && trimmed.length <= maxLength && !exists);
</script>

<Combobox.Root
	type="single"
	bind:value
	bind:open
	inputValue={value}
	onOpenChange={(isOpen) => {
		// Reopening always shows the full list rather than the last search.
		if (isOpen) search = '';
	}}
>
	<div class="relative">
		<Combobox.Input
			{id}
			class="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent py-2 pr-9 pl-2.5 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-3"
			placeholder="Search or create a category"
			maxlength={maxLength}
			aria-label="Category"
			oninput={(event) => (search = event.currentTarget.value)}
		/>
		<Combobox.Trigger
			class="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 grid w-9 place-items-center"
			aria-label="Show categories"><ChevronDown class="size-4" /></Combobox.Trigger
		>
	</div>
	<Combobox.Portal>
		<Combobox.Content
			sideOffset={4}
			class="bg-popover text-popover-foreground ring-foreground/10 z-50 max-h-64 w-(--bits-combobox-anchor-width) overflow-y-auto rounded-md p-1 shadow-md ring-1"
		>
			<Combobox.Viewport>
				{#if canCreate}
					<Combobox.Item
						value={trimmed}
						label={trimmed}
						class="data-highlighted:bg-accent text-coral flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-semibold outline-hidden select-none"
					>
						<Plus class="size-3.5 shrink-0" />
						<span class="truncate">Use “{trimmed}”</span>
					</Combobox.Item>
				{/if}
				{#each matches as category (category)}
					<Combobox.Item
						value={category}
						label={category}
						class="data-highlighted:bg-accent flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none"
					>
						{#snippet children({ selected })}
							<i class="size-2.5 shrink-0 rounded-full" style:background={categoryColor(category)}
							></i>
							<span class="flex-1 truncate">{category}</span>
							{#if selected}<Check class="size-3.5 shrink-0" />{/if}
						{/snippet}
					</Combobox.Item>
				{:else}
					{#if !canCreate}
						<p class="text-muted-foreground px-2 py-3 text-center text-xs">No categories yet.</p>
					{/if}
				{/each}
			</Combobox.Viewport>
		</Combobox.Content>
	</Combobox.Portal>
</Combobox.Root>
<input type="hidden" {name} {value} />
