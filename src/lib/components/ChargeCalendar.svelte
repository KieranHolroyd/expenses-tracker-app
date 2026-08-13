<script lang="ts">
	import { money } from '$lib/format';
	import type { ExpenseStats } from '$lib/types';
	import * as Card from '$lib/components/ui/card';

	let { stats }: { stats: ExpenseStats } = $props();
	let { chargeDays, tracked } = $derived(stats);
	let byDay = $derived(new Map(chargeDays.days.map((load) => [load.day, load])));
	let peak = $derived(Math.max(1, ...chargeDays.days.map((load) => load.amount)));
	let days = $derived(Array.from({ length: 31 }, (_, index) => index + 1));
	let hovered = $state<number | null>(null);
	let detail = $derived(hovered === null ? null : (byDay.get(hovered) ?? null));
	/** Twelve months of charges land on these days, so a day's share is per year. */
	const shade = (amount: number) =>
		`color-mix(in srgb, var(--color-coral) ${Math.round(12 + (amount / peak) * 88)}%, #f0ece3)`;
</script>

<Card.Root>
	<Card.Header>
		<h2 class="font-serif text-2xl">When in the month it lands</h2>
		<p class="text-muted-foreground mt-2 text-sm">
			Every charge in the next 12 months, stacked onto the day of the month it falls on. Darker is
			heavier; a bar under the date means something required lands that day.
		</p>
	</Card.Header>
	<Card.Content>
		<div class="grid grid-cols-[repeat(auto-fit,minmax(28px,1fr))] gap-1.5">
			{#each days as day (day)}
				{@const load = byDay.get(day)}
				<button
					type="button"
					class="aspect-square cursor-default rounded-md border border-transparent text-[10px] font-semibold transition-colors"
					class:border-ink={hovered === day}
					style:background={load ? shade(load.amount) : '#f4f1ea'}
					style:color={load && load.amount > peak * 0.55 ? 'white' : '#8b948f'}
					onmouseenter={() => (hovered = day)}
					onmouseleave={() => (hovered = null)}
					onfocus={() => (hovered = day)}
					onblur={() => (hovered = null)}
					aria-label={load
						? `Day ${day}: ${money(load.amount)} across ${load.count} charges, ${money(load.required)} of it required`
						: `Day ${day}: nothing charged`}
					>{day}{#if load?.required}<i
							class="mx-auto mt-0.5 block h-[3px] w-2 rounded-full"
							style:background={load.amount > peak * 0.55 ? 'white' : 'var(--color-ink)'}
							aria-hidden="true"
						></i>{/if}</button
				>
			{/each}
		</div>

		<div class="mt-5 min-h-16 border-t pt-4">
			{#if detail}
				<p class="text-[10px] font-bold tracking-wider text-[#8b948f] uppercase">
					Day {detail.day} of the month
				</p>
				<p class="mt-1 font-serif text-2xl">{money(detail.amount)}</p>
				<p class="text-muted-foreground text-xs">
					{detail.count} charge{detail.count === 1 ? '' : 's'} over the year ·
					{#if detail.required}
						{money(detail.required)} required, {money(detail.amount - detail.required)} optional
					{:else}
						all optional
					{/if}
				</p>
			{:else if chargeDays.heaviest}
				<p class="text-muted-foreground text-xs leading-relaxed">
					<b class="text-foreground"
						>Day {chargeDays.heaviest.day} is the heaviest at {money(chargeDays.heaviest.amount)}</b
					>
					a year across {chargeDays.heaviest.count} charges. Most of the weight sits in
					{chargeDays.busiestThird} of the month — worth knowing if your pay does not.
				</p>
			{:else}
				<p class="text-muted-foreground text-xs">No charges scheduled.</p>
			{/if}
		</div>
	</Card.Content>
	{#if tracked.charges > 0 && tracked.since}
		<Card.Footer class="bg-paper mx-6 mb-6 block rounded-xl p-4">
			<p class="text-[10px] font-bold tracking-wider text-[#8b948f] uppercase">
				Since tracking began
			</p>
			<p class="mt-1 font-serif text-2xl">{money(tracked.total)}</p>
			<p class="text-muted-foreground mt-1 text-xs leading-relaxed">
				{tracked.charges} charges across everything active, counted back to when each expense was added.
				Assumes today's price and cadence held throughout.
			</p>
		</Card.Footer>
	{/if}
</Card.Root>
