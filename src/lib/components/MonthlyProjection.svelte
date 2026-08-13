<script lang="ts">
	import { Table2 } from '@lucide/svelte';
	import { money, percent } from '$lib/format';
	import type { ExpenseStats, MonthProjection } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';

	// Coral / indigo validated for CVD separation, chroma and contrast on a white surface.
	const RECURRING = '#de735c';
	const RENEWAL = '#5968c5';
	const REQUIRED = '#172621';

	let { stats }: { stats: ExpenseStats } = $props();
	let { months, average, peak, trough, swing, total } = $derived(stats.projection);
	let scaleMax = $derived(Math.max(1000, ...months.map((month) => month.total)) * 1.12);
	let hovered = $state<number | null>(null);
	let showTable = $state(false);
	// Which way each column is cut: by how it is billed, or by whether it can be
	// dropped. The bars are the same height either way — only the split moves.
	let split = $state<'cadence' | 'necessity'>('cadence');
	let hasRenewals = $derived(months.some((month) => month.renewals > 0));
	let hasRequired = $derived(months.some((month) => month.required > 0));
	// The highlighted segment sits on top in both modes; the rest is the remainder.
	let topOf = $derived((month: MonthProjection) =>
		split === 'cadence' ? month.renewals : month.required
	);
	let topColor = $derived(split === 'cadence' ? RENEWAL : REQUIRED);
	const height = (value: number, max: number) => `${Math.max(0, (value / max) * 100)}%`;
</script>

<Card.Root class="p-7 max-sm:p-4">
	<Card.Header>
		<div class="flex items-start justify-between gap-4 max-sm:flex-col">
			<div>
				<h2 class="font-serif text-2xl">What each month actually costs</h2>
				<p class="text-muted-foreground mt-2 max-w-lg text-sm">
					Charges landed on the calendar rather than smoothed. Annual renewals make some months far
					heavier than the {money(average)} average.
				</p>
			</div>
			<div class="flex shrink-0 items-center gap-2">
				<div class="flex rounded-lg border p-0.5" role="group" aria-label="Split each month by">
					{#each [['cadence', 'By cadence'], ['necessity', 'By necessity']] as const as [value, label] (value)}
						<button
							type="button"
							class="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
							class:bg-ink={split === value}
							class:text-white={split === value}
							class:text-muted-foreground={split !== value}
							aria-pressed={split === value}
							onclick={() => (split = value)}>{label}</button
						>
					{/each}
				</div>
				<Button variant="outline" size="sm" onclick={() => (showTable = !showTable)}>
					<Table2 class="size-3.5" />{showTable ? 'Hide table' : 'View as table'}
				</Button>
			</div>
		</div>
	</Card.Header>

	<Card.Content>
		<div class="mb-5 flex flex-wrap items-center gap-4 text-xs text-[#66706b]">
			{#if split === 'cadence'}
				{#if hasRenewals}
					<span class="flex items-center gap-2"
						><i class="size-2.5 rounded-full" style:background={RECURRING}></i>Monthly charges</span
					>
					<span class="flex items-center gap-2"
						><i class="size-2.5 rounded-full" style:background={RENEWAL}></i>Annual renewals</span
					>
				{/if}
			{:else}
				<span class="flex items-center gap-2"
					><i class="size-2.5 rounded-full" style:background={REQUIRED}></i>Required</span
				>
				<span class="flex items-center gap-2"
					><i class="size-2.5 rounded-full" style:background={RECURRING}></i>Optional</span
				>
				{#if !hasRequired}
					<span class="text-[#929995]">— nothing is marked required yet</span>
				{/if}
			{/if}
			<span class="flex items-center gap-2"
				><i class="h-0 w-5 border-t-2 border-dashed border-[#8b948f]"></i>12-month average</span
			>
		</div>

		<div class="relative pl-16 max-sm:pl-12">
			<div
				class="absolute top-0 left-0 flex h-[260px] flex-col justify-between text-[10px] text-[#929995] tabular-nums max-sm:h-[200px]"
			>
				<span>{money(scaleMax)}</span><span>{money(scaleMax / 2)}</span><span>£0</span>
			</div>

			<div class="relative h-[260px] max-sm:h-[200px]">
				<div class="pointer-events-none absolute inset-0" aria-hidden="true">
					<div class="absolute top-0 right-0 left-0 border-t border-[#e8e5de]"></div>
					<div class="absolute top-1/2 right-0 left-0 border-t border-[#e8e5de]"></div>
					<div class="absolute right-0 bottom-0 left-0 border-t border-[#dedbd2]"></div>
					<div
						class="absolute right-0 left-0 border-t-2 border-dashed border-[#8b948f]"
						style:bottom={height(average, scaleMax)}
					>
						<span
							class="absolute -top-4 left-0 rounded bg-white pr-1 text-[10px] font-semibold text-[#66706b] tabular-nums"
							>avg {money(average)}</span
						>
					</div>
				</div>

				<div class="relative flex h-full items-end gap-1">
					{#each months as month, index (month.key)}
						{@const dimmed = hovered !== null && hovered !== index}
						<button
							type="button"
							class="relative h-full flex-1 cursor-default rounded-sm focus-visible:outline-none"
							onmouseenter={() => (hovered = index)}
							onmouseleave={() => (hovered = null)}
							onfocus={() => (hovered = index)}
							onblur={() => (hovered = null)}
							aria-label="{month.label} {month.year}: {money(
								month.total
							)} across {month.count} charges, {money(month.required)} of it required"
						>
							{#if month.total > 0}
								{@const top = topOf(month)}
								<!-- The stack takes an explicit share of the column so its segments
								     have a definite height to size their own percentages against. -->
								<div
									class="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-6 flex-col justify-end gap-[2px]"
									style:height={height(month.total, scaleMax)}
								>
									{#if top > 0}
										<div
											class="shrink-0 rounded-t-[4px] transition-opacity"
											style:height={`${(top / month.total) * 100}%`}
											style:background={topColor}
											style:opacity={dimmed ? 0.45 : 1}
										></div>
									{/if}
									<div
										class="min-h-0 flex-1 transition-opacity"
										class:rounded-t-[4px]={top === 0}
										style:background={RECURRING}
										style:opacity={dimmed ? 0.45 : 1}
									></div>
								</div>
								{#if month === peak}
									<span
										class="absolute inset-x-0 text-center text-[10px] font-bold text-[#4a534e] tabular-nums"
										style:bottom={`calc(${height(month.total, scaleMax)} + 6px)`}
										>{money(month.total)}</span
									>
								{/if}
							{/if}
						</button>
					{/each}
				</div>

				{#if hovered !== null}
					{@const month = months[hovered]}
					<Card.Root
						size="sm"
						class="pointer-events-none absolute -top-2 z-10 min-w-48 py-3 shadow-lg"
						style={`left: ${((hovered + 0.5) / months.length) * 100}%; transform: ${
							hovered > months.length - 4
								? 'translateX(-100%)'
								: hovered < 3
									? 'translateX(0)'
									: 'translateX(-50%)'
						};`}
					>
						<Card.Content>
							<p class="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
								{month.label}
								{month.year}
							</p>
							<strong class="mt-1 block font-serif text-xl">{money(month.total)}</strong>
							<p class="text-muted-foreground mt-1 text-xs">
								{month.count} charge{month.count === 1 ? '' : 's'}
								{#if month.renewals > 0}· {money(month.renewals)} in renewals{/if}
							</p>
							<p class="text-muted-foreground mt-1 text-xs">
								{#if month.required > 0}
									{money(month.required)} required · {money(month.total - month.required)} optional
								{:else}
									all of it optional
								{/if}
							</p>
							{#if month.elapsed > 0}
								<p class="mt-1 text-xs text-[#8b948f]">{money(month.elapsed)} already charged</p>
							{/if}
							<p
								class="mt-1 text-xs font-semibold"
								style:color={month.total > average ? RECURRING : '#4b8c7c'}
							>
								{month.total > average ? '+' : ''}{money(month.total - average)} vs average
							</p>
						</Card.Content>
					</Card.Root>
				{/if}
			</div>

			<!-- min-w-0 keeps each label the same width as its bar slot; on narrow
			     screens every other label is hidden rather than left to collide. -->
			<div class="mt-3 flex gap-1 text-[10px] text-[#929995]">
				{#each months as month, index (month.key)}
					<span class="min-w-0 flex-1 text-center {index % 2 ? 'max-sm:invisible' : ''}"
						>{month.label}</span
					>
				{/each}
			</div>
		</div>

		{#if showTable}
			<Table.Root class="mt-8">
				<Table.Header
					><Table.Row
						><Table.Head>Month</Table.Head><Table.Head class="text-right">Charges</Table.Head
						><Table.Head class="text-right">Renewals</Table.Head><Table.Head class="text-right"
							>Required</Table.Head
						><Table.Head class="text-right">Optional</Table.Head><Table.Head class="text-right"
							>Total</Table.Head
						><Table.Head class="text-right">vs average</Table.Head></Table.Row
					></Table.Header
				>
				<Table.Body>
					{#each months as month (month.key)}
						<Table.Row>
							<Table.Cell><b>{month.label} {month.year}</b></Table.Cell>
							<Table.Cell class="text-right tabular-nums">{month.count}</Table.Cell>
							<Table.Cell class="text-right tabular-nums"
								>{month.renewals ? money(month.renewals) : '—'}</Table.Cell
							>
							<Table.Cell class="text-right tabular-nums"
								>{month.required ? money(month.required) : '—'}</Table.Cell
							>
							<Table.Cell class="text-muted-foreground text-right tabular-nums"
								>{money(month.total - month.required)}</Table.Cell
							>
							<Table.Cell class="text-right font-semibold tabular-nums"
								>{money(month.total)}</Table.Cell
							>
							<Table.Cell class="text-muted-foreground text-right tabular-nums"
								>{month.total >= average ? '+' : ''}{money(month.total - average)}</Table.Cell
							>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		{/if}
	</Card.Content>

	<Card.Footer class="bg-paper mx-6 mb-6 grid grid-cols-3 gap-6 rounded-xl p-4 max-sm:grid-cols-1">
		{#each [['Heaviest month', peak ? `${peak.label} ${peak.year}` : '—', peak ? money(peak.total) : ''], ['Lightest month', trough ? `${trough.label} ${trough.year}` : '—', trough ? money(trough.total) : ''], ['Month-to-month swing', money(swing), total ? `${percent(swing / average)} of an average month` : '']] as item (item[0])}
			<div>
				<p class="text-[10px] font-bold tracking-wider text-[#8b948f] uppercase">{item[0]}</p>
				<b class="mt-1 block text-sm">{item[1]}</b>
				<p class="text-muted-foreground text-xs tabular-nums">{item[2]}</p>
			</div>
		{/each}
	</Card.Footer>
</Card.Root>
