<script lang="ts">
	import { expensePalette, money, percent } from '$lib/format';
	import type { ExpenseStats } from '$lib/types';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';

	let { stats }: { stats: ExpenseStats } = $props();
	let { categories, totals } = $derived(stats);
	const colorOf = (name: string) => expensePalette[name] ?? expensePalette.Other;
</script>

<Card.Root class="gap-0 overflow-hidden py-0">
	<div class="border-b p-6">
		<p class="text-coral mb-3 text-[11px] font-extrabold tracking-[.16em] uppercase">By category</p>
		<h2 class="font-serif text-2xl">Yearly cost per category</h2>
		<p class="text-muted-foreground mt-2 text-sm">
			Cadence-normalised, so a £79/year licence sits beside a £18/month subscription fairly.
		</p>
	</div>
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Category</Table.Head>
				<Table.Head class="text-right">Items</Table.Head>
				<Table.Head class="text-right">Monthly</Table.Head>
				<Table.Head class="text-right">Yearly</Table.Head>
				<Table.Head class="w-48 max-lg:hidden">Share</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each categories as category (category.name)}
				<Table.Row>
					<Table.Cell>
						<div class="flex items-center gap-2.5">
							<i class="size-2.5 shrink-0 rounded-full" style:background={colorOf(category.name)}
							></i>
							<div>
								<b class="block text-[13px]">{category.name}</b>
								{#if category.largest}
									<small class="text-muted-foreground"
										>largest: {category.largest.name} · {money(category.largest.annual)}/yr</small
									>
								{/if}
							</div>
						</div>
					</Table.Cell>
					<Table.Cell class="text-right tabular-nums">{category.count}</Table.Cell>
					<Table.Cell class="text-muted-foreground text-right tabular-nums"
						>{money(category.monthly)}</Table.Cell
					>
					<Table.Cell class="text-right font-semibold tabular-nums"
						>{money(category.annual)}</Table.Cell
					>
					<Table.Cell class="max-lg:hidden">
						<div class="flex items-center gap-3">
							<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eeeae2]">
								<div
									class="h-full rounded-full"
									style:width={`${category.share * 100}%`}
									style:background={colorOf(category.name)}
								></div>
							</div>
							<span class="w-9 text-right text-xs tabular-nums">{percent(category.share)}</span>
						</div>
					</Table.Cell>
				</Table.Row>
			{:else}
				<Table.Row
					><Table.Cell colspan={5} class="text-muted-foreground h-28 text-center"
						>Add an expense to see category statistics.</Table.Cell
					></Table.Row
				>
			{/each}
		</Table.Body>
		{#if categories.length}
			<Table.Footer>
				<Table.Row>
					<Table.Cell><b>All categories</b></Table.Cell>
					<Table.Cell class="text-right tabular-nums">{stats.counts.active}</Table.Cell>
					<Table.Cell class="text-right tabular-nums">{money(totals.monthly)}</Table.Cell>
					<Table.Cell class="text-right font-semibold tabular-nums">{money(totals.annual)}</Table.Cell
					>
					<Table.Cell class="max-lg:hidden"></Table.Cell>
				</Table.Row>
			</Table.Footer>
		{/if}
	</Table.Root>
</Card.Root>
