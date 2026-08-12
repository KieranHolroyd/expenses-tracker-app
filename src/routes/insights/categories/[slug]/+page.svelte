<script lang="ts">
	import { ArrowLeft, Check } from '@lucide/svelte';
	import { categoryColor, fullDate, money, percent } from '$lib/format';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';

	let { data, form } = $props();
	let detail = $derived(data.detail);
	let category = $derived(detail.category);
	let color = $derived(categoryColor(category.name));
	let peers = $derived(data.stats.categories);
	let widest = $derived(Math.max(1, ...peers.map((entry) => entry.annual)));
	let monthMax = $derived(Math.max(1, ...detail.months.map((month) => month.total)));
	let ordinal = $derived(['', '1st', '2nd', '3rd'][detail.rank] ?? `${detail.rank}th`);
	let rates = $derived([
		['Per month', money(detail.rates.monthly)],
		['Per pay cycle', money(detail.rates.perCycle)],
		['Per week', money(detail.rates.weekly)],
		['Per day', money(detail.rates.daily)]
	]);
</script>

<svelte:head><title>{category.name} · Insights · Ledgerly</title></svelte:head>

{#if form?.message}<Alert class="mb-6 border-[#cbded4] bg-[#e8f2ed] text-[#326b59]"
		><Check /><AlertDescription>{form.message}</AlertDescription></Alert
	>{/if}

<section class="mb-10 flex items-end justify-between gap-8 max-sm:flex-col max-sm:items-start">
	<div>
		<p class="mb-3 flex items-center gap-2 text-[11px] font-extrabold tracking-[.16em] uppercase">
			<i class="size-2.5 rounded-full" style:background={color}></i>
			<span style:color>Category deep dive</span>
		</p>
		<h1
			class="m-0 font-serif text-[clamp(38px,4.5vw,60px)] leading-[.98] font-medium tracking-[-.045em]"
		>
			{category.name}
		</h1>
		<p class="mt-5 max-w-xl text-base leading-relaxed text-[#66706b]">
			{#if category.count}
				{ordinal} largest of {detail.categoryCount} categories — {money(category.annual)} a year across
				{category.count} active {category.count === 1 ? 'expense' : 'expenses'}, or
				{percent(category.share)} of everything committed.
			{:else}
				Every expense in this category is paused, so it costs nothing right now.
			{/if}
		</p>
	</div>
	<Button href="/insights" variant="outline" size="lg"><ArrowLeft size={16} /> All insights</Button>
</section>

<section class="mb-5 grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-4 max-lg:grid-cols-1">
	<Card.Root class="border-ink bg-ink text-white">
		<Card.Header
			><Card.Description class="text-[#aebbb4]">Yearly cost of {category.name}</Card.Description
			></Card.Header
		>
		<Card.Content>
			<strong class="block font-serif text-[clamp(44px,5.5vw,66px)] leading-none tracking-tight"
				>{money(category.annual)}</strong
			>
			<p class="mt-3 text-xs text-[#aebbb4]">
				{percent(detail.shareOfIncome, 1)} of take-home pay · {money(category.average)} a year per expense
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
			<Card.Header><Card.Description>How it is billed</Card.Description></Card.Header>
			<Card.Content>
				<div class="flex items-baseline gap-3">
					<strong class="font-serif text-3xl tracking-tight">{percent(category.yearlyShare)}</strong
					>
					<span class="text-muted-foreground text-xs"
						>on yearly plans — {detail.cadenceMix.yearlyCount} of {detail.cadenceMix.count}</span
					>
				</div>
				<div class="mt-4 flex h-2 gap-[2px] overflow-hidden rounded-full bg-[#eeeae2]">
					<div
						class="h-full rounded-l-full"
						style:width={`${(1 - category.yearlyShare) * 100}%`}
						style:background={color}
					></div>
					<div
						class="h-full rounded-r-full"
						style:width={`${category.yearlyShare * 100}%`}
						style:background={`color-mix(in srgb, ${color} 40%, white)`}
					></div>
				</div>
				<p class="text-muted-foreground mt-3 text-xs">
					{money(category.monthlyBilled)} billed monthly · {money(category.yearlyBilled)} in lump sums
				</p>
			</Card.Content>
		</Card.Root>
		<div class="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
			<Card.Root>
				<Card.Header><Card.Description class="text-xs">Concentration</Card.Description></Card.Header
				>
				<Card.Content>
					<strong class="font-serif text-3xl tracking-tight">{percent(category.topShare)}</strong>
					<p class="text-muted-foreground mt-2 text-xs">
						{#if category.largest}
							is {category.largest.name} alone
						{:else}
							nothing active in this category
						{/if}
					</p>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header><Card.Description class="text-xs">Required here</Card.Description></Card.Header
				>
				<Card.Content>
					<strong class="font-serif text-3xl tracking-tight"
						>{money(detail.commitment.required)}</strong
					>
					<p class="text-muted-foreground mt-2 text-xs">
						{#if detail.commitment.requiredCount}
							{detail.commitment.requiredCount} of {detail.cadenceMix.count} · {money(
								detail.commitment.optional
							)} still optional
						{:else}
							nothing here is marked required
						{/if}
					</p>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header
					><Card.Description class="text-xs">Since tracking began</Card.Description></Card.Header
				>
				<Card.Content>
					<strong class="font-serif text-3xl tracking-tight">{money(detail.tracked.total)}</strong>
					<p class="text-muted-foreground mt-2 text-xs">
						{detail.tracked.charges} charges
						{#if detail.tracked.since}since {fullDate(detail.tracked.since)}{/if}
					</p>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</section>

<section
	class="mb-5 grid grid-cols-[minmax(0,1fr)_minmax(0,380px)] items-start gap-5 max-xl:grid-cols-1"
>
	<Card.Root>
		<Card.Header>
			<p class="text-coral mb-3 text-[11px] font-extrabold tracking-[.16em] uppercase">
				Next 12 months
			</p>
			<h2 class="font-serif text-2xl">What {category.name} costs month by month</h2>
		</Card.Header>
		<Card.Content>
			<div class="flex h-40 items-end gap-1.5">
				{#each detail.months as month (month.key)}
					<div class="flex h-full flex-1 flex-col justify-end" title={money(month.total)}>
						<div
							class="rounded-t-[4px]"
							style:height={`${(month.total / monthMax) * 100}%`}
							style:background={color}
						></div>
					</div>
				{/each}
			</div>
			<div class="mt-2 flex gap-1.5 text-[10px] text-[#929995]">
				{#each detail.months as month, index (month.key)}
					<span class="min-w-0 flex-1 text-center {index % 2 ? 'max-sm:invisible' : ''}"
						>{month.label}</span
					>
				{/each}
			</div>
			<ul class="mt-6 space-y-2.5 border-t pt-5">
				{#each detail.upcoming.slice(0, 6) as charge, index (`${charge.name}-${charge.date}-${index}`)}
					<li class="flex items-center justify-between gap-3 text-sm">
						<b class="truncate text-[13px]">{charge.name}</b>
						<span class="text-muted-foreground shrink-0 text-xs tabular-nums"
							>{fullDate(charge.date)} · <b class="text-foreground">{money(charge.amount)}</b></span
						>
					</li>
				{:else}
					<li class="text-muted-foreground text-sm">Nothing due in this category.</li>
				{/each}
			</ul>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<p class="text-coral mb-3 text-[11px] font-extrabold tracking-[.16em] uppercase">
				Against the others
			</p>
			<h2 class="font-serif text-2xl">Where it sits</h2>
		</Card.Header>
		<Card.Content class="space-y-3.5">
			{#each peers as entry (entry.name)}
				{@const current = entry.name === category.name}
				<a class="text-ink block no-underline" href="/insights/categories/{entry.slug}">
					<div class="mb-1 flex items-baseline justify-between gap-3 text-xs">
						<span class="truncate {current ? 'font-bold' : ''}">{entry.name}</span>
						<b class="shrink-0 tabular-nums {current ? '' : 'text-muted-foreground font-normal'}"
							>{money(entry.annual)}</b
						>
					</div>
					<div class="h-1.5 overflow-hidden rounded-full bg-[#eeeae2]">
						<div
							class="h-full rounded-full"
							style:width={`${(entry.annual / widest) * 100}%`}
							style:background={categoryColor(entry.name)}
							style:opacity={current ? 1 : 0.45}
						></div>
					</div>
				</a>
			{/each}
			<p class="text-muted-foreground border-t pt-4 text-xs leading-relaxed">
				{#if category.vsAverageCategory >= 1}
					{category.name} costs {percent(category.vsAverageCategory - 1)} more than an average category.
				{:else}
					{category.name} costs {percent(1 - category.vsAverageCategory)} less than an average category.
				{/if}
			</p>
		</Card.Content>
	</Card.Root>
</section>

<Card.Root class="gap-0 overflow-hidden py-0">
	<div class="border-b p-6">
		<p class="text-coral mb-3 text-[11px] font-extrabold tracking-[.16em] uppercase">
			Line by line
		</p>
		<h2 class="font-serif text-2xl">Everything filed under {category.name}</h2>
	</div>
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Expense</Table.Head>
				<Table.Head class="text-right">Amount</Table.Head>
				<Table.Head>Next charge</Table.Head>
				<Table.Head class="text-right">Yearly</Table.Head>
				<Table.Head class="text-right max-lg:hidden">Share of category</Table.Head>
				<Table.Head class="text-right max-lg:hidden">Tracked</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each [...detail.items, ...detail.paused] as item (item.expense.id)}
				<Table.Row class={item.expense.active ? '' : 'opacity-50'}>
					<Table.Cell>
						<a class="text-ink no-underline" href="/insights/expenses/{item.expense.id}">
							<b class="block text-[13px] hover:underline">{item.expense.name}</b>
							<small class="text-muted-foreground"
								>{item.expense.active
									? `#${item.rankInCategory} in ${category.name}`
									: 'Paused'}</small
							>
						</a>
					</Table.Cell>
					<Table.Cell class="text-right tabular-nums"
						>{money(item.expense.amount_pence)}
						<Badge variant="secondary" class="ml-1.5 text-[10px]">{item.expense.cadence}</Badge
						>{#if item.expense.required}<Badge variant="outline" class="ml-1.5 text-[10px]"
								>Required</Badge
							>{/if}</Table.Cell
					>
					<Table.Cell class="text-muted-foreground"
						>{fullDate(item.expense.next_due_date)}</Table.Cell
					>
					<Table.Cell class="text-right font-semibold tabular-nums">{money(item.annual)}</Table.Cell
					>
					<Table.Cell class="text-right tabular-nums max-lg:hidden"
						>{percent(item.shareOfCategory)}</Table.Cell
					>
					<Table.Cell class="text-muted-foreground text-right tabular-nums max-lg:hidden"
						>{money(item.tracked.total)}</Table.Cell
					>
				</Table.Row>
			{:else}
				<Table.Row
					><Table.Cell colspan={6} class="text-muted-foreground h-28 text-center"
						>Nothing is filed under this category.</Table.Cell
					></Table.Row
				>
			{/each}
		</Table.Body>
	</Table.Root>
</Card.Root>
