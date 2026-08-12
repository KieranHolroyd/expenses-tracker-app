<script lang="ts">
	import { ArrowLeft, Check, CirclePause, Lock, LockOpen, Pencil, Trash2 } from '@lucide/svelte';
	import AddExpenseDialog from '$lib/components/AddExpenseDialog.svelte';
	import { categoryColor, categorySlug, fullDate, money, percent } from '$lib/format';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';

	let { data, form } = $props();
	let detail = $derived(data.detail);
	let expense = $derived(detail.item.expense);
	let color = $derived(categoryColor(expense.category));
	let showEdit = $state(false);
	let rates = $derived([
		['Per month', money(detail.rates.monthly)],
		['Per pay cycle', money(detail.rates.perCycle)],
		['Per week', money(detail.rates.weekly)],
		['Per day', money(detail.rates.daily)]
	]);
	let peerMax = $derived(
		Math.max(detail.item.annual, ...detail.peers.map((peer) => peer.annual), 1)
	);
	let daysAway = $derived(
		Math.round(
			(new Date(`${expense.next_due_date}T00:00:00Z`).getTime() -
				new Date(`${detail.generatedOn}T00:00:00Z`).getTime()) /
				86_400_000
		)
	);
</script>

<svelte:head><title>{expense.name} · Insights · Ledgerly</title></svelte:head>

{#if form?.message}<Alert class="mb-6 border-[#cbded4] bg-[#e8f2ed] text-[#326b59]"
		><Check /><AlertDescription>{form.message}</AlertDescription></Alert
	>{/if}

<section class="mb-10 flex items-end justify-between gap-8 max-sm:flex-col max-sm:items-start">
	<div>
		<p class="mb-3 flex items-center gap-2 text-[11px] font-extrabold tracking-[.16em] uppercase">
			<i class="size-2.5 rounded-full" style:background={color}></i>
			<a
				class="no-underline hover:underline"
				style:color
				href="/insights/categories/{categorySlug(expense.category)}">{expense.category}</a
			>
			{#if !expense.active}<Badge variant="secondary">Paused</Badge
				>{/if}{#if expense.required}<Badge variant="outline">Required</Badge>{/if}
		</p>
		<h1
			class="m-0 font-serif text-[clamp(38px,4.5vw,60px)] leading-[.98] font-medium tracking-[-.045em]"
		>
			{expense.name}
		</h1>
		<p class="mt-5 max-w-xl text-base leading-relaxed text-[#66706b]">
			{money(expense.amount_pence)}
			{expense.cadence.toLowerCase()}, next on {fullDate(expense.next_due_date)}
			{#if daysAway > 0}({daysAway} {daysAway === 1 ? 'day' : 'days'} away){/if}.
			{#if expense.active}
				That is {percent(detail.item.shareOfTotal, 1)} of everything you have committed, and #{detail
					.item.rank} of {detail.activeCount}.
			{/if}
		</p>
	</div>
	<div class="flex gap-2.5">
		<Button href="/insights/categories/{categorySlug(expense.category)}" variant="outline" size="lg"
			><ArrowLeft size={16} /> {expense.category}</Button
		>
		<Button size="lg" onclick={() => (showEdit = true)}><Pencil size={16} /> Edit</Button>
	</div>
</section>

<section class="mb-5 grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-4 max-lg:grid-cols-1">
	<Card.Root class="border-ink bg-ink text-white">
		<Card.Header
			><Card.Description class="text-[#aebbb4]">Costs you a year</Card.Description></Card.Header
		>
		<Card.Content>
			<strong class="block font-serif text-[clamp(44px,5.5vw,66px)] leading-none tracking-tight"
				>{money(detail.rates.annual)}</strong
			>
			<p class="mt-3 text-xs text-[#aebbb4]">
				{percent(detail.shareOfIncome, 1)} of take-home pay · {percent(detail.item.shareOfCategory)} of
				{expense.category}
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
			<Card.Header><Card.Description>Since you started tracking it</Card.Description></Card.Header>
			<Card.Content>
				<div class="flex items-baseline gap-3">
					<strong class="font-serif text-3xl tracking-tight"
						>{money(detail.item.tracked.total)}</strong
					>
					<span class="text-muted-foreground text-xs"
						>{detail.item.tracked.charges} charge{detail.item.tracked.charges === 1
							? ''
							: 's'}</span
					>
				</div>
				<p class="text-muted-foreground mt-3 text-xs leading-relaxed">
					{#if detail.item.tracked.since}
						Counted back to {fullDate(detail.item.tracked.since)}, when it was added. It assumes the
						price and cadence have not changed since.
					{:else}
						Nothing has been charged yet.
					{/if}
				</p>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Header><Card.Description>Scale</Card.Description></Card.Header>
			<Card.Content class="space-y-2 text-sm">
				<p class="text-muted-foreground text-xs leading-relaxed">
					{#if detail.outweighs.count > 1}
						A year of {expense.name} costs more than
						<b class="text-foreground"
							>{detail.outweighs.count} of your cheapest expenses combined</b
						>
						— {detail.outweighs.names.slice(0, 3).join(', ')}{detail.outweighs.count > 3
							? ' and more'
							: ''}.
					{:else if detail.outranks > 0}
						It costs more over a year than {detail.outranks} of your other
						{detail.outranks === 1 ? 'expense' : 'expenses'}.
					{:else}
						It is the cheapest thing you are tracking.
					{/if}
				</p>
				<p class="text-muted-foreground text-xs leading-relaxed">
					Dropping it would free <b class="text-foreground">{money(detail.rates.perCycle)}</b> every pay
					cycle.
				</p>
			</Card.Content>
		</Card.Root>
	</div>
</section>

<section
	class="mb-5 grid grid-cols-[minmax(0,1fr)_minmax(0,380px)] items-start gap-5 max-xl:grid-cols-1"
>
	<Card.Root>
		<Card.Header>
			<p class="text-coral mb-3 text-[11px] font-extrabold tracking-[.16em] uppercase">Schedule</p>
			<h2 class="font-serif text-2xl">Every charge in the next 12 months</h2>
			<p class="text-muted-foreground mt-2 text-sm">
				{detail.schedule.length} charge{detail.schedule.length === 1 ? '' : 's'} totalling {money(
					detail.schedule.reduce((sum, charge) => sum + charge.amount, 0)
				)}.
			</p>
		</Card.Header>
		<Card.Content>
			<ol class="space-y-0">
				{#each detail.schedule as charge, index (charge.date)}
					{@const past = charge.date < detail.generatedOn}
					<li
						class="flex items-center gap-4 border-b py-2.5 last:border-b-0"
						class:opacity-50={past}
					>
						<span class="text-muted-foreground w-6 text-xs tabular-nums">{index + 1}</span>
						<i class="size-2 shrink-0 rounded-full" style:background={color}></i>
						<span class="flex-1 text-sm">{fullDate(charge.date)}</span>
						<b class="text-sm tabular-nums">{money(charge.amount)}</b>
					</li>
				{:else}
					<li class="text-muted-foreground text-sm">Nothing scheduled.</li>
				{/each}
			</ol>
		</Card.Content>
	</Card.Root>

	<div class="grid gap-5">
		<Card.Root>
			<Card.Header>
				<p class="text-coral mb-3 text-[11px] font-extrabold tracking-[.16em] uppercase">
					Against its peers
				</p>
				<h2 class="font-serif text-2xl">Inside {expense.category}</h2>
			</Card.Header>
			<Card.Content class="space-y-3.5">
				{#each [detail.item, ...detail.peers].toSorted((a, b) => b.annual - a.annual) as peer (peer.expense.id)}
					{@const current = peer.expense.id === expense.id}
					<a class="text-ink block no-underline" href="/insights/expenses/{peer.expense.id}">
						<div class="mb-1 flex items-baseline justify-between gap-3 text-xs">
							<span class="truncate {current ? 'font-bold' : ''}">{peer.expense.name}</span>
							<b class="shrink-0 tabular-nums {current ? '' : 'text-muted-foreground font-normal'}"
								>{money(peer.annual)}</b
							>
						</div>
						<div class="h-1.5 overflow-hidden rounded-full bg-[#eeeae2]">
							<div
								class="h-full rounded-full"
								style:width={`${(peer.annual / peerMax) * 100}%`}
								style:background={color}
								style:opacity={current ? 1 : 0.4}
							></div>
						</div>
					</a>
				{/each}
				{#if !detail.peers.length}
					<p class="text-muted-foreground text-xs">
						It is the only thing in {expense.category}.
					</p>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header><Card.Description>Manage</Card.Description></Card.Header>
			<Card.Content class="flex flex-wrap gap-2.5">
				<form method="POST" action="?/toggle">
					<input type="hidden" name="id" value={expense.id} />
					<Button type="submit" variant="outline"
						><CirclePause size={16} /> {expense.active ? 'Pause' : 'Resume'}</Button
					>
				</form>
				<form method="POST" action="?/toggleRequired">
					<input type="hidden" name="id" value={expense.id} />
					<Button type="submit" variant="outline"
						>{#if expense.required}<LockOpen size={16} /> Mark optional{:else}<Lock size={16} /> Mark
							required{/if}</Button
					>
				</form>
				<form method="POST" action="?/delete">
					<input type="hidden" name="id" value={expense.id} />
					<Button type="submit" variant="outline" class="text-destructive"
						><Trash2 size={16} /> Delete</Button
					>
				</form>
			</Card.Content>
			<Card.Footer
				><p class="text-muted-foreground text-xs">
					Pausing keeps the row and its history but takes it out of every total. Marking it required
					keeps it out of the cut list. Deleting cannot be undone.
				</p></Card.Footer
			>
		</Card.Root>
	</div>
</section>

<AddExpenseDialog bind:open={showEdit} {expense} categories={data.categories} />
