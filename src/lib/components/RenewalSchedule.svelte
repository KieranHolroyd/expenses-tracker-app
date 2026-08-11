<script lang="ts">
	import { expensePalette, fullDate, money } from '$lib/format';
	import type { ExpenseStats } from '$lib/types';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';

	let { stats }: { stats: ExpenseStats } = $props();
	let { upcoming, renewals, generatedOn } = $derived(stats);
	let windows = $derived([
		['Next 7 days', upcoming.next7],
		['Next 30 days', upcoming.next30],
		['Next 90 days', upcoming.next90]
	] as const);
	const daysAway = (date: string) =>
		Math.round(
			(new Date(`${date}T00:00:00Z`).getTime() - new Date(`${generatedOn}T00:00:00Z`).getTime()) /
				86_400_000
		);
</script>

<div class="grid gap-5">
	<Card.Root>
		<Card.Header>
			<p class="text-coral mb-3 text-[11px] font-extrabold tracking-[.16em] uppercase">
				Short horizon
			</p>
			<h2 class="font-serif text-2xl">What lands soon</h2>
		</Card.Header>
		<Card.Content class="space-y-5">
			<dl class="grid grid-cols-3 gap-4">
				{#each windows as [label, amount] (label)}
					<div>
						<dt class="text-[10px] font-bold tracking-wider text-[#8b948f] uppercase">{label}</dt>
						<dd class="mt-1 font-serif text-2xl">{money(amount)}</dd>
					</div>
				{/each}
			</dl>
			<ul class="space-y-2.5 border-t pt-5">
				{#each upcoming.charges as charge, index (`${charge.name}-${charge.date}-${index}`)}
					{@const away = daysAway(charge.date)}
					<li class="flex items-center justify-between gap-3 text-sm">
						<span class="flex min-w-0 items-center gap-2.5">
							<i
								class="size-2 shrink-0 rounded-full"
								style:background={expensePalette[charge.category] ?? expensePalette.Other}
							></i>
							<b class="truncate text-[13px]">{charge.name}</b>
							{#if charge.cadence === 'Yearly'}<Badge variant="secondary" class="text-[10px]"
									>Yearly</Badge
								>{/if}
						</span>
						<span class="text-muted-foreground shrink-0 text-xs tabular-nums">
							{away <= 0 ? 'today' : `in ${away}d`} · <b class="text-foreground"
								>{money(charge.amount)}</b
							>
						</span>
					</li>
				{:else}
					<li class="text-muted-foreground text-sm">No charges scheduled.</li>
				{/each}
			</ul>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<p class="text-coral mb-3 text-[11px] font-extrabold tracking-[.16em] uppercase">
				Annual renewals
			</p>
			<h2 class="font-serif text-2xl">{money(renewals.annual)} in lump sums</h2>
			<p class="text-muted-foreground mt-2 text-sm">
				{renewals.count} yearly charge{renewals.count === 1 ? '' : 's'} due over the next 12 months. Setting
				aside {money(renewals.annual / 12)} a month covers them.
			</p>
		</Card.Header>
		<Card.Content>
			<ul class="space-y-3">
				{#each renewals.charges as charge (`${charge.name}-${charge.date}`)}
					<li class="flex items-baseline justify-between gap-3">
						<div class="min-w-0">
							<b class="block truncate text-[13px]">{charge.name}</b>
							<small class="text-muted-foreground">{fullDate(charge.date)}</small>
						</div>
						<b class="shrink-0 text-sm tabular-nums">{money(charge.amount)}</b>
					</li>
				{:else}
					<li class="text-muted-foreground text-sm">
						Nothing on a yearly plan — every charge is spread across the months.
					</li>
				{/each}
			</ul>
		</Card.Content>
	</Card.Root>
</div>
