<script lang="ts">
	import { CalendarDays, Sparkles, TrendingUp, WalletCards } from '@lucide/svelte';
	import { fullDate, money, monthlyCost } from '$lib/format';
	import type { Expense } from '$lib/types';
	import * as Card from '$lib/components/ui/card';
	let { expenses }: { expenses: Expense[] } = $props();
	let active = $derived(expenses.filter((expense) => expense.active));
	let monthly = $derived(active.reduce((sum, expense) => sum + monthlyCost(expense), 0));
	let annual = $derived(monthly * 12);
	let next = $derived(active.toSorted((a, b) => a.next_due_date.localeCompare(b.next_due_date))[0]);
</script>

<section class="mb-5 grid grid-cols-3 gap-4 max-md:grid-cols-1" aria-label="Expense summary">
	<Card.Root class="border-ink bg-ink text-white"
		><Card.Header
			><Card.Description class="flex justify-between text-[#aebbb4]"
				>Monthly outgoings <WalletCards size={20} /></Card.Description
			></Card.Header
		><Card.Content
			><strong class="font-serif text-4xl tracking-tight">{money(monthly)}</strong>
			<p class="mt-2 text-xs text-[#aebbb4]">
				<span class="inline-flex items-center gap-1 text-[#93c6a6]"
					><TrendingUp size={13} /> all tracked</span
				>
				across {active.length} active expenses
			</p></Card.Content
		></Card.Root
	>
	<Card.Root
		><Card.Header
			><Card.Description class="flex justify-between"
				>Annual outlook <CalendarDays size={20} /></Card.Description
			></Card.Header
		><Card.Content
			><strong class="font-serif text-4xl tracking-tight">{money(annual)}</strong>
			<p class="text-muted-foreground mt-2 text-xs">
				Projected across the next 12 months
			</p></Card.Content
		></Card.Root
	>
	<Card.Root class="max-md:hidden"
		><Card.Header
			><Card.Description class="flex justify-between"
				>Coming up next <Sparkles size={20} /></Card.Description
			></Card.Header
		><Card.Content
			>{#if next}<strong class="font-serif text-4xl tracking-tight"
					>{money(next.amount_pence)}</strong
				>
				<p class="text-muted-foreground mt-2 text-xs">
					<b class="text-foreground">{next.name}</b> · {fullDate(next.next_due_date)}
				</p>{/if}</Card.Content
		></Card.Root
	>
</section>
