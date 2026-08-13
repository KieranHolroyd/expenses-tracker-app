<script lang="ts">
	import { CalendarDays, Sparkles, TrendingUp, WalletCards } from '@lucide/svelte';
	import { fullDate, money, percent } from '$lib/format';
	import type { ExpenseStats } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	let { stats }: { stats: ExpenseStats } = $props();
	let next = $derived(stats.upcoming.charges[0] ?? null);
</script>

<section class="mb-5 grid grid-cols-3 gap-4 max-md:grid-cols-1" aria-label="Expense summary">
	<Card.Root class="border-ink bg-ink text-white"
		><Card.Header
			><Card.Description class="flex justify-between text-[#aebbb4]"
				>Monthly outgoings <WalletCards size={20} /></Card.Description
			></Card.Header
		><Card.Content
			><strong class="font-serif text-4xl tracking-tight">{money(stats.totals.monthly)}</strong>
			<p class="mt-2 text-xs text-[#aebbb4]">
				<span class="inline-flex items-center gap-1 text-[#93c6a6]"
					><TrendingUp size={13} /> all tracked</span
				>
				across {stats.counts.active} active expenses
			</p></Card.Content
		></Card.Root
	>
	<Card.Root
		><Card.Header
			><Card.Description class="flex justify-between"
				>Annual outlook <CalendarDays size={20} /></Card.Description
			></Card.Header
		><Card.Content
			><strong class="font-serif text-4xl tracking-tight">{money(stats.totals.annual)}</strong>
			<p class="text-muted-foreground mt-2 text-xs">
				{money(stats.totals.daily)} a day · {percent(stats.income.committedShare)} of take-home pay
			</p>
			<p class="text-muted-foreground mt-1 text-xs">
				{#if stats.commitment.requiredCount}
					{money(stats.commitment.required)} of it required ({percent(
						stats.commitment.requiredShare
					)})
				{:else}
					none of it marked required yet
				{/if}
			</p></Card.Content
		><Card.Footer
			><Button href="/insights" variant="ghost" class="flex w-full justify-between"
				>See the full breakdown <span>→</span></Button
			></Card.Footer
		></Card.Root
	>
	<Card.Root class="max-md:hidden"
		><Card.Header
			><Card.Description class="flex justify-between"
				>Coming up next <Sparkles size={20} /></Card.Description
			></Card.Header
		><Card.Content
			>{#if next}<strong class="font-serif text-4xl tracking-tight">{money(next.amount)}</strong>
				<p class="text-muted-foreground mt-2 text-xs">
					<b class="text-foreground">{next.name}</b> · {fullDate(next.date)}
				</p>
				<p class="text-muted-foreground mt-1 text-xs">
					{money(stats.upcoming.next30.total)} due in the next 30 days{#if stats.upcoming.next30.required},
						{money(stats.upcoming.next30.required)} of it required{/if}
				</p>{/if}</Card.Content
		></Card.Root
	>
</section>
