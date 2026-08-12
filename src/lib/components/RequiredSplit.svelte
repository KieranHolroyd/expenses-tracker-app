<script lang="ts">
	import { Lock, LockOpen } from '@lucide/svelte';
	import { money, percent } from '$lib/format';
	import type { ExpenseStats } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';

	let { stats }: { stats: ExpenseStats } = $props();
	let { commitment, counts, income, totals } = $derived(stats);
	let requiredWidth = $derived(`${Math.min(100, commitment.requiredShare * 100)}%`);
	let rates = $derived([
		['Per month', money(commitment.rates.monthly)],
		['Per pay cycle', money(commitment.rates.perCycle)],
		['Per week', money(commitment.rates.weekly)],
		['Per day', money(commitment.rates.daily)]
	]);
</script>

<Card.Root>
	<Card.Header>
		<p class="text-coral mb-3 text-[11px] font-extrabold tracking-[.16em] uppercase">
			Required vs optional
		</p>
		<h2 class="font-serif text-2xl">The floor, and the room above it</h2>
		<p class="text-muted-foreground mt-2 text-sm">
			Nothing is required until you say so. What you mark stays out of the cut list and sets the
			lowest your recurring spend can honestly go.
		</p>
	</Card.Header>
	<Card.Content>
		{#if commitment.requiredCount}
			<div class="grid grid-cols-2 gap-5 max-sm:grid-cols-1">
				<div>
					<p class="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
						<Lock class="size-3.5" /> Required
					</p>
					<strong class="mt-1 block font-serif text-4xl tracking-tight"
						>{money(commitment.required)}</strong
					>
					<p class="text-muted-foreground mt-2 text-xs">
						{commitment.requiredCount}
						{commitment.requiredCount === 1 ? 'expense' : 'expenses'} · {percent(
							commitment.requiredShare
						)} of the annual total
					</p>
				</div>
				<div>
					<p class="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
						<LockOpen class="size-3.5" /> Optional
					</p>
					<strong class="mt-1 block font-serif text-4xl tracking-tight"
						>{money(commitment.optional)}</strong
					>
					<p class="text-muted-foreground mt-2 text-xs">
						{commitment.optionalCount}
						{commitment.optionalCount === 1 ? 'expense' : 'expenses'} · what is actually available to
						cut
					</p>
				</div>
			</div>

			<div class="mt-5 flex h-2 overflow-hidden rounded-full bg-[#eeeae2]">
				<div class="bg-ink h-full" style:width={requiredWidth}></div>
			</div>

			<dl class="mt-6 grid grid-cols-4 gap-4 border-t pt-5 max-sm:grid-cols-2">
				{#each rates as [label, value] (label)}
					<div>
						<dt class="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
							{label}
						</dt>
						<dd class="mt-1 font-serif text-xl">{value}</dd>
					</div>
				{/each}
			</dl>

			<div class="bg-paper mt-6 space-y-2 rounded-xl p-4 text-xs leading-relaxed">
				<p class="text-muted-foreground">
					Required costs take <b class="text-foreground">{percent(income.requiredShare, 1)}</b> of
					take-home pay, leaving
					<b class="text-foreground">{money(income.afterRequired)}</b> a year before a single optional
					expense is counted.
				</p>
				{#if commitment.peakRequiredMonth}
					<p class="text-muted-foreground">
						The heaviest required month is
						<b class="text-foreground"
							>{commitment.peakRequiredMonth.label}
							{commitment.peakRequiredMonth.year}</b
						>
						at {money(commitment.peakRequiredMonth.required)}, out of
						{money(commitment.peakRequiredMonth.total)} charged that month.
					</p>
				{/if}
				{#if commitment.fixedCategories.length}
					<p class="text-muted-foreground">
						Nothing in {commitment.fixedCategories.join(', ')} is optional, so the only lever there is
						the price itself.
					</p>
				{/if}
			</div>
		{:else}
			<p class="text-muted-foreground text-sm">
				None of your {counts.active} active expenses are marked required, so all
				<b class="text-foreground">{money(totals.annual)}</b> reads as discretionary. Mark the ones you
				cannot drop to see the floor underneath.
			</p>
			<Button href="/expenses" variant="outline" class="mt-4">Mark expenses required</Button>
		{/if}
	</Card.Content>
</Card.Root>
