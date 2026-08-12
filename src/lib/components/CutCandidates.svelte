<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { Lock, Scissors } from '@lucide/svelte';
	import { categoryColor, money, percent } from '$lib/format';
	import type { ExpenseStats } from '$lib/types';
	import * as Card from '$lib/components/ui/card';

	let { stats }: { stats: ExpenseStats } = $props();
	let { cutCandidates, totals, income, commitment } = $derived(stats);
	let lockedHere = $derived(cutCandidates.filter((candidate) => candidate.required));
	// Selection is a what-if only: nothing here writes to the expense itself.
	let selected = new SvelteSet<number>();
	let saved = $derived(
		cutCandidates
			.filter((candidate) => selected.has(candidate.id))
			.reduce((sum, candidate) => sum + candidate.annual, 0)
	);
	let remaining = $derived(totals.annual - saved);

	function toggle(id: number) {
		if (!selected.delete(id)) selected.add(id);
	}
</script>

<Card.Root>
	<Card.Header>
		<h2 class="font-serif text-2xl">The costly few</h2>
		<p class="text-muted-foreground mt-2 text-sm">
			Ranked by yearly cost. Tick anything to see what dropping it would actually save — nothing is
			changed until you pause or delete it yourself. Anything marked required is locked.
		</p>
	</Card.Header>
	<Card.Content class="space-y-2.5">
		{#each cutCandidates as candidate (candidate.id)}
			{@const checked = selected.has(candidate.id)}
			<div class="flex items-center gap-3">
				<label
					class="flex min-w-0 flex-1 items-center gap-3"
					class:cursor-pointer={!candidate.required}
				>
					{#if candidate.required}
						<!-- Required expenses stay on the list for scale, but there is no
						     saving to model: dropping one is not on the table. -->
						<Lock class="text-muted-foreground size-4 shrink-0" aria-label="Required" />
					{:else}
						<input
							type="checkbox"
							class="accent-coral size-4 shrink-0"
							{checked}
							onchange={() => toggle(candidate.id)}
						/>
					{/if}
					<i
						class="size-2.5 shrink-0 rounded-full"
						style:background={categoryColor(candidate.category)}
					></i>
					<span class="min-w-0 flex-1">
						<b class="block truncate text-[13px]" class:line-through={checked}>{candidate.name}</b>
						<span class="text-muted-foreground text-xs"
							>{candidate.category}{#if candidate.required}
								· required{/if}</span
						>
					</span>
				</label>
				<a
					class="hover:text-coral text-right text-sm tabular-nums no-underline"
					href="/insights/expenses/{candidate.id}"
					aria-label="Deep dive into {candidate.name}"
				>
					<b>{money(candidate.annual)}</b>
					<span class="text-muted-foreground block text-[11px]"
						>{percent(candidate.share, 1)} · {percent(candidate.cumulativeShare)} running</span
					>
				</a>
			</div>
		{:else}
			<p class="text-muted-foreground text-sm">Add an expense to see what dominates the total.</p>
		{/each}
	</Card.Content>
	{#if cutCandidates.length}
		<Card.Footer class="bg-paper mx-6 mb-6 block rounded-xl p-4">
			{#if saved > 0}
				<p class="flex items-baseline justify-between gap-3">
					<span class="flex items-center gap-2 text-xs font-semibold"
						><Scissors size={14} /> Dropping {selected.size}
						{selected.size === 1 ? 'expense' : 'expenses'}</span
					>
					<b class="font-serif text-2xl">{money(saved)}<span class="text-sm">/yr</span></b>
				</p>
				<p class="text-muted-foreground mt-2 text-xs">
					{money(saved / 12)} a month back. Committed spend would fall to
					<b class="text-foreground">{money(remaining)}</b>, or
					{percent(income.annual ? remaining / income.annual : 0, 1)} of take-home pay — down from
					{percent(income.committedShare, 1)}.{#if commitment.required}
						No amount of ticking gets below the
						<b class="text-foreground">{money(commitment.required)}</b> you have marked required.{/if}
				</p>
			{:else}
				<p class="text-muted-foreground text-xs leading-relaxed">
					The top three are <b class="text-foreground"
						>{percent(
							cutCandidates[2]?.cumulativeShare ?? cutCandidates.at(-1)!.cumulativeShare
						)}</b
					>
					of everything committed. Tick a few to model the saving.{#if lockedHere.length}
						{lockedHere.length} of the {cutCandidates.length} here
						{lockedHere.length === 1 ? 'is' : 'are'} required, so
						{lockedHere.length === 1 ? 'it is' : 'they are'} shown for scale only.{/if}
				</p>
			{/if}
		</Card.Footer>
	{/if}
</Card.Root>
