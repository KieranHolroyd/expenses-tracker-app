<script lang="ts">
	import { categoryColor, money, monthlyCost } from '$lib/format';
	import type { Expense } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	let { expenses }: { expenses: Expense[] } = $props();
	let monthly = $derived(
		expenses.filter((item) => item.active).reduce((sum, item) => sum + monthlyCost(item), 0)
	);
	// Each category carries its required portion, so one bar shows both how big
	// the category is and how much of it is actually up for review.
	let categories = $derived(
		Object.values(
			expenses
				.filter((item) => item.active)
				.reduce((acc: Record<string, { name: string; amount: number; required: number }>, item) => {
					const entry = acc[item.category] ?? { name: item.category, amount: 0, required: 0 };
					entry.amount += monthlyCost(item);
					if (item.required) entry.required += monthlyCost(item);
					acc[item.category] = entry;
					return acc;
				}, {})
		).sort((a, b) => b.amount - a.amount)
	);
	let required = $derived(categories.reduce((sum, entry) => sum + entry.required, 0));
</script>

<Card.Root class="max-sm:hidden">
	<Card.Header>
		<p class="text-coral mb-3 text-[11px] font-extrabold tracking-[.16em] uppercase">
			Where it goes
		</p>
		<h2 class="font-serif text-2xl">Monthly mix</h2>
		<p class="text-muted-foreground mt-2 mb-4 text-xs">
			{#if required}
				The solid end of each bar is the part you have marked required — {money(required)} a month across
				everything.
			{:else}
				Nothing is marked required yet, so every bar is entirely discretionary.
			{/if}
		</p>
	</Card.Header>
	<Card.Content class="space-y-5">
		{#each categories as category (category.name)}<div>
				<div class="mb-1.5 grid grid-cols-[1fr_auto] text-xs">
					<span class="flex items-center gap-2"
						><i class="size-2 rounded-full" style:background={categoryColor(category.name)}
						></i>{category.name}</span
					><b>{money(category.amount)}</b>
				</div>
				<div class="h-1.5 overflow-hidden rounded-full bg-[#eeeae2]">
					<!-- One bar, two tones: full colour for the required part, a wash of the
					     same hue for the rest, so the category still reads as one block. -->
					<div
						class="flex h-full rounded-full"
						style:width={`${(category.amount / monthly) * 100}%`}
					>
						{#if category.required}
							<div
								class="h-full"
								style:width={`${(category.required / category.amount) * 100}%`}
								style:background={categoryColor(category.name)}
							></div>
						{/if}
						<div
							class="h-full flex-1"
							style:background={`color-mix(in srgb, ${categoryColor(category.name)} ${category.required ? 35 : 100}%, white)`}
						></div>
					</div>
				</div>
				{#if category.required}
					<p class="text-muted-foreground mt-1 text-[11px] tabular-nums">
						{money(category.required)} required · {money(category.amount - category.required)} optional
					</p>
				{/if}
			</div>{/each}
	</Card.Content>
	<Card.Footer
		><Button href="/usage" variant="ghost" class="flex w-full justify-between"
			>View usage forecast <span>→</span></Button
		></Card.Footer
	>
</Card.Root>
