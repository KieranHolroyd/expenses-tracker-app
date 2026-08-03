<script lang="ts">
	import { expensePalette, money, monthlyCost } from '$lib/format';
	import type { Expense } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	let { expenses }: { expenses: Expense[] } = $props();
	let monthly = $derived(
		expenses.filter((item) => item.active).reduce((sum, item) => sum + monthlyCost(item), 0)
	);
	let categories = $derived(
		Object.entries(
			expenses
				.filter((item) => item.active)
				.reduce((acc: Record<string, number>, item) => {
					acc[item.category] = (acc[item.category] ?? 0) + monthlyCost(item);
					return acc;
				}, {})
		).sort((a, b) => b[1] - a[1])
	);
</script>

<Card.Root class="max-sm:hidden">
	<Card.Header>
		<p class="text-coral mb-3 text-[11px] font-extrabold tracking-[.16em] uppercase">
			Where it goes
		</p>
		<h2 class="mb-6 font-serif text-2xl">Monthly mix</h2>
	</Card.Header>
	<Card.Content class="space-y-5">
		{#each categories as [name, amount] (name)}<div>
				<div class="mb-1.5 grid grid-cols-[1fr_auto] text-xs">
					<span class="flex items-center gap-2"
						><i
							class="size-2 rounded-full"
							style:background={expensePalette[name] ?? expensePalette.Other}
						></i>{name}</span
					><b>{money(amount)}</b>
				</div>
				<div class="h-1.5 overflow-hidden rounded-full bg-[#eeeae2]">
					<div
						class="h-full rounded-full"
						style:width={`${(amount / monthly) * 100}%`}
						style:background={expensePalette[name] ?? expensePalette.Other}
					></div>
				</div>
			</div>{/each}
	</Card.Content>
	<Card.Footer
		><Button href="/usage" variant="ghost" class="flex w-full justify-between"
			>View usage forecast <span>→</span></Button
		></Card.Footer
	>
</Card.Root>
