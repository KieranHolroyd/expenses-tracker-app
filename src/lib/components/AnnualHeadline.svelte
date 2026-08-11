<script lang="ts">
	import { CalendarClock, PiggyBank, Repeat2, Wallet } from '@lucide/svelte';
	import { money, percent } from '$lib/format';
	import type { ExpenseStats } from '$lib/types';
	import * as Card from '$lib/components/ui/card';

	let { stats }: { stats: ExpenseStats } = $props();
	let { totals, income, cadenceMix, counts, paused } = $derived(stats);
	let committedWidth = $derived(`${Math.min(100, income.committedShare * 100)}%`);
	let rates = $derived([
		['Per month', money(totals.monthly)],
		['Per pay cycle', money(totals.perCycle)],
		['Per week', money(totals.weekly)],
		['Per day', money(totals.daily)]
	]);
</script>

<section class="mb-5 grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-4 max-lg:grid-cols-1">
	<Card.Root class="border-ink bg-ink text-white">
		<Card.Header>
			<Card.Description class="flex justify-between text-[#aebbb4]">
				Committed every year <Wallet size={20} />
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<strong class="block font-serif text-[clamp(48px,6vw,72px)] leading-none tracking-tight"
				>{money(totals.annual)}</strong
			>
			<p class="mt-3 text-xs text-[#aebbb4]">
				{counts.active} active expenses · {counts.monthly} billed monthly, {counts.yearly} billed yearly
			</p>
			<dl class="mt-6 grid grid-cols-4 gap-4 border-t border-white/10 pt-5 max-sm:grid-cols-2">
				{#each rates as [label, value] (label)}
					<div>
						<dt class="text-[10px] font-bold tracking-wider text-[#8b9a93] uppercase">{label}</dt>
						<dd class="mt-1 font-serif text-xl">{value}</dd>
					</div>
				{/each}
			</dl>
		</Card.Content>
	</Card.Root>

	<div class="grid gap-4">
		<Card.Root>
			<Card.Header>
				<Card.Description class="flex justify-between"
					>Share of take-home pay <PiggyBank size={20} /></Card.Description
				>
			</Card.Header>
			<Card.Content>
				<div class="flex items-baseline gap-3">
					<strong class="font-serif text-4xl tracking-tight"
						>{percent(income.committedShare, 1)}</strong
					>
					<span class="text-muted-foreground text-xs"
						>of {money(income.annual)} across {income.periodsPerYear} payments</span
					>
				</div>
				<div class="mt-4 h-2 overflow-hidden rounded-full bg-[#eeeae2]">
					<div class="bg-coral h-full rounded-full" style:width={committedWidth}></div>
				</div>
				<p class="text-muted-foreground mt-3 text-xs">
					{#if income.free >= 0}
						<b class="text-foreground">{money(income.free)}</b> a year left after recurring costs.
					{:else}
						Recurring costs exceed pay by
						<b class="text-foreground">{money(Math.abs(income.free))}</b> a year.
					{/if}
				</p>
			</Card.Content>
		</Card.Root>

		<div class="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
			<Card.Root>
				<Card.Header>
					<Card.Description class="flex justify-between text-xs"
						>Locked in annual plans <Repeat2 size={18} /></Card.Description
					>
				</Card.Header>
				<Card.Content>
					<strong class="font-serif text-3xl tracking-tight"
						>{money(cadenceMix.yearlyBilled)}</strong
					>
					<p class="text-muted-foreground mt-2 text-xs">
						{percent(cadenceMix.yearlyShare)} of the annual total, charged in lump sums
					</p>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header>
					<Card.Description class="flex justify-between text-xs"
						>Paused expenses <CalendarClock size={18} /></Card.Description
					>
				</Card.Header>
				<Card.Content>
					<strong class="font-serif text-3xl tracking-tight">{money(paused.annual)}</strong>
					<p class="text-muted-foreground mt-2 text-xs">
						{paused.count} paused · a year saved while they stay off
					</p>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</section>
