<script lang="ts">
	import { annualCost, money, percent } from '$lib/format';
	import type { ExpenseStats } from '$lib/types';
	import * as Card from '$lib/components/ui/card';

	let { stats }: { stats: ExpenseStats } = $props();
	let { distribution, concentration, counts } = $derived(stats);
	// A spread wider than the middle value means a handful of expenses set the tone.
	let skewed = $derived(distribution.median > 0 && distribution.stdDev > distribution.median);
	let measures = $derived([
		{
			label: 'Mean per expense',
			value: money(distribution.mean),
			note: 'monthly equivalent'
		},
		{
			label: 'Median per expense',
			value: money(distribution.median),
			note: skewed ? 'well below the mean — a few large ones skew it' : 'the typical expense'
		},
		{
			label: 'Standard deviation',
			value: money(distribution.stdDev),
			note: skewed ? 'high spread' : 'tightly clustered'
		},
		{
			label: 'Range',
			value: `${money(distribution.min)} – ${money(distribution.max)}`,
			note: `across ${counts.active} active expenses`
		}
	]);
</script>

<Card.Root>
	<Card.Header>
		<h2 class="font-serif text-2xl">How the spend is spread</h2>
	</Card.Header>
	<Card.Content class="space-y-6">
		<dl class="grid grid-cols-2 gap-x-6 gap-y-5 max-sm:grid-cols-1">
			{#each measures as measure (measure.label)}
				<div>
					<dt class="text-[10px] font-bold tracking-wider text-[#8b948f] uppercase">
						{measure.label}
					</dt>
					<dd class="mt-1 font-serif text-2xl">{measure.value}</dd>
					<p class="text-muted-foreground mt-0.5 text-xs">{measure.note}</p>
				</div>
			{/each}
		</dl>

		<div class="bg-paper space-y-3 rounded-xl p-4">
			<p class="text-[10px] font-bold tracking-wider text-[#8b948f] uppercase">Concentration</p>
			<div class="grid grid-cols-3 gap-4 text-center max-sm:grid-cols-1 max-sm:text-left">
				<div>
					<b class="block font-serif text-xl">{percent(concentration.topShare)}</b>
					<span class="text-muted-foreground text-xs">largest expense</span>
				</div>
				<div>
					<b class="block font-serif text-xl">{percent(concentration.top3Share)}</b>
					<span class="text-muted-foreground text-xs">top three</span>
				</div>
				<div>
					<b class="block font-serif text-xl">{concentration.effectiveCount.toFixed(1)}</b>
					<span class="text-muted-foreground text-xs">effective count</span>
				</div>
			</div>
			<p class="text-muted-foreground text-xs leading-relaxed">
				Your {counts.active} expenses behave like
				<b class="text-foreground">{concentration.effectiveCount.toFixed(1)} equal ones</b>. The
				lower that number, the more cancelling a single line would move the total.
			</p>
		</div>

		{#if distribution.largest && distribution.smallest}
			<div class="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
				{#each [['Biggest commitment', distribution.largest], ['Smallest commitment', distribution.smallest]] as const as [label, expense] (label)}
					<div class="rounded-xl border p-4">
						<p class="text-[10px] font-bold tracking-wider text-[#8b948f] uppercase">{label}</p>
						<b class="mt-1 block text-sm">{expense.name}</b>
						<p class="text-muted-foreground text-xs">
							{money(annualCost(expense))}/yr · {expense.category}
						</p>
					</div>
				{/each}
			</div>
		{/if}
	</Card.Content>
</Card.Root>
