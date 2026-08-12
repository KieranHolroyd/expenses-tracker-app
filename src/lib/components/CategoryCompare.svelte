<script lang="ts">
	import { categoryColor, money, percent } from '$lib/format';
	import type { ExpenseStats } from '$lib/types';
	import * as Card from '$lib/components/ui/card';

	let { stats }: { stats: ExpenseStats } = $props();
	let { categories, concentration } = $derived(stats);
	let widest = $derived(Math.max(1, ...categories.map((category) => category.annual)));
	let biggest = $derived(categories[0] ?? null);
	let smallest = $derived(categories.at(-1) ?? null);
	// A category that costs more per expense than any other is where the money
	// goes on few, large commitments rather than on a long tail of small ones.
	let priciest = $derived(categories.toSorted((a, b) => b.average - a.average)[0] ?? null);
	let mostConcentrated = $derived(
		categories
			.filter((category) => category.count > 1)
			.toSorted((a, b) => b.topShare - a.topShare)[0] ?? null
	);
</script>

<Card.Root class="gap-0 overflow-hidden py-0">
	<div class="border-b p-6">
		<h2 class="font-serif text-2xl">How the categories compare</h2>
		<p class="text-muted-foreground mt-2 max-w-2xl text-sm">
			Each bar is a category's yearly cost, split by how it is billed. The number beside it is how
			that category compares to an average one — with {categories.length} categories, average is {money(
				stats.totals.annual / Math.max(1, categories.length)
			)} a year.
		</p>
	</div>

	<div class="space-y-4 p-6">
		{#each categories as category (category.name)}
			{@const monthlyWidth = (category.monthlyBilled / widest) * 100}
			{@const yearlyWidth = (category.yearlyBilled / widest) * 100}
			<a
				class="text-ink block no-underline"
				href="/insights/categories/{category.slug}"
				aria-label="Deep dive into {category.name}"
			>
				<div class="mb-1.5 flex items-baseline justify-between gap-4 text-xs">
					<span class="flex min-w-0 items-center gap-2">
						<i
							class="size-2.5 shrink-0 rounded-full"
							style:background={categoryColor(category.name)}
						></i>
						<b class="truncate text-[13px] hover:underline">{category.name}</b>
						<span class="text-muted-foreground shrink-0"
							>{category.count} item{category.count === 1 ? '' : 's'} · {money(category.average)}
							each</span
						>
					</span>
					<span class="flex shrink-0 items-baseline gap-2 tabular-nums">
						<b>{money(category.annual)}</b>
						<span
							class="w-14 text-right text-[11px] font-semibold"
							style:color={category.vsAverageCategory >= 1 ? '#b8563f' : '#4b8c7c'}
							>{category.vsAverageCategory >= 1 ? '+' : '−'}{percent(
								Math.abs(category.vsAverageCategory - 1)
							)}</span
						>
					</span>
				</div>
				<div class="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
					<div
						class="h-full rounded-l-full"
						class:rounded-r-full={yearlyWidth === 0}
						style:width={`${monthlyWidth}%`}
						style:background={categoryColor(category.name)}
					></div>
					{#if yearlyWidth > 0}
						<div
							class="h-full rounded-r-full"
							class:rounded-l-full={monthlyWidth === 0}
							style:width={`${yearlyWidth}%`}
							style:background={`color-mix(in srgb, ${categoryColor(category.name)} 40%, white)`}
						></div>
					{/if}
					<div class="flex-1"></div>
				</div>
			</a>
		{:else}
			<p class="text-muted-foreground py-6 text-center text-sm">
				Add expenses in more than one category to compare them.
			</p>
		{/each}
	</div>

	{#if categories.length > 1 && biggest && smallest && priciest}
		<div class="bg-paper m-6 mt-0 grid grid-cols-4 gap-6 rounded-xl p-4 max-md:grid-cols-2">
			{#each [['Largest category', biggest.name, `${money(biggest.annual)} · ${percent(biggest.share)} of everything`], ['Smallest category', smallest.name, `${money(smallest.annual)} · ${percent(smallest.share)} of everything`], ['Priciest per item', priciest.name, `${money(priciest.average)} a year each`], ['Spread across categories', `${concentration.categoryEffectiveCount.toFixed(1)} even`, `${categories.length} categories, weighted by cost`]] as item (item[0])}
				<div>
					<p class="text-[10px] font-bold tracking-wider text-[#8b948f] uppercase">{item[0]}</p>
					<b class="mt-1 block truncate text-sm">{item[1]}</b>
					<p class="text-muted-foreground text-xs">{item[2]}</p>
				</div>
			{/each}
		</div>
		{#if mostConcentrated}
			<p class="text-muted-foreground border-t px-6 py-4 text-xs leading-relaxed">
				<b class="text-foreground">{mostConcentrated.name}</b> is the most lopsided category:
				{mostConcentrated.largest?.name} alone is {percent(mostConcentrated.topShare)} of it. The lighter
				half of each bar is what gets billed as a yearly lump sum.
			</p>
		{/if}
	{/if}
</Card.Root>
