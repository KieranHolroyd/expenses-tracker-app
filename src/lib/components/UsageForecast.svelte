<script lang="ts">
	import { area, bisector, curveStepAfter, line, scaleLinear, scaleTime } from 'd3';
	import { Check } from '@lucide/svelte';
	import { fullDate, money, monthlyCost } from '$lib/format';
	import type { AppSettings, Expense, UsageForecast as Forecast, UsagePoint } from '$lib/types';
	import PaymentScheduleForm from '$lib/components/PaymentScheduleForm.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';

	let {
		expenses,
		usage,
		settings
	}: { expenses: Expense[]; usage: Forecast; settings: AppSettings } = $props();
	let active = $derived(expenses.filter((item) => item.active));
	let annual = $derived(active.reduce((sum, item) => sum + monthlyCost(item) * 12, 0));
	let periodsPerYear = $derived(settings.cycle_type === 'four_week' ? 13 : 12);
	let typicalCycleCost = $derived(annual / periodsPerYear);
	let schedule = $derived(
		settings.cycle_type === 'four_week'
			? {
					name: 'Four-week',
					cadence: 'Every 28 days',
					description: `every 28 days from ${fullDate(settings.payday_anchor_date)} — 13 payments per year, with no calendar-month drift.`
				}
			: settings.cycle_type === 'monthly'
				? {
						name: 'Monthly',
						cadence: 'Same date monthly',
						description: `on day ${new Date(`${settings.payday_anchor_date}T00:00:00Z`).getUTCDate()} of each month, using the final day in shorter months.`
					}
				: {
						name: 'Last Friday',
						cadence: 'Last Friday monthly',
						description: 'on the final Friday of every calendar month, calculated automatically.'
					}
	);
	let peak = $derived(Math.max(0, ...usage.points.map((point) => point.total)));
	let chartMax = $derived(Math.max(20000, peak) * 1.08);
	let x = $derived(
		scaleTime()
			.domain([new Date(`${usage.start}T00:00:00Z`), new Date(`${usage.end}T00:00:00Z`)])
			.range([0, 900])
	);
	let y = $derived(scaleLinear().domain([0, chartMax]).range([300, 0]));
	let chartLine = $derived(
		line<UsagePoint>()
			.x((point) => x(new Date(`${point.date}T00:00:00Z`)))
			.y((point) => y(point.total))
			.curve(curveStepAfter)(usage.points) ?? ''
	);
	let chartArea = $derived(
		area<UsagePoint>()
			.x((point) => x(new Date(`${point.date}T00:00:00Z`)))
			.y0(300)
			.y1((point) => y(point.total))
			.curve(curveStepAfter)(usage.points) ?? ''
	);
	let hoverIndex = $state<number | null>(null);
	let hovered = $derived(hoverIndex === null ? null : usage.points[hoverIndex]);
	let hoverX = $derived(hovered ? x(new Date(`${hovered.date}T00:00:00Z`)) : 0);
	let hoverY = $derived(hovered ? y(hovered.total) : 0);

	function showNearestPoint(event: PointerEvent) {
		const bounds = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
		const date = x.invert(((event.clientX - bounds.left) / bounds.width) * 900);
		const nearest = bisector<UsagePoint, Date>(
			(point) => new Date(`${point.date}T00:00:00Z`)
		).center(usage.points, date);
		const nearestDate = usage.points[nearest]?.date;
		hoverIndex =
			usage.points
				.map((point, index) => ({ point, index }))
				.filter(({ point }) => point.date === nearestDate)
				.toSorted((a, b) => b.point.total - a.point.total)[0]?.index ?? nearest;
	}
</script>

<section class="mb-10 flex items-end justify-between gap-8 max-sm:flex-col max-sm:items-start">
	<div>
		<p class="text-coral mb-3 text-[11px] font-extrabold tracking-[.16em] uppercase">
			13-cycle forecast
		</p>
		<h1 class="font-serif text-[clamp(42px,5vw,66px)] leading-[.98] font-medium tracking-[-.045em]">
			Your spending,<br /><em class="text-coral font-medium">between paydays.</em>
		</h1>
		<p class="mt-5 max-w-xl text-base leading-relaxed text-[#66706b]">
			Recurring charges build against each {money(settings.payment_amount_pence)} payment, then reset
			on your {schedule.name.toLowerCase()} schedule.
		</p>
	</div>
	<Button href="/expenses" variant="outline" size="lg">Manage expenses</Button>
</section>

<Card.Root class="mb-5"
	><form method="POST" action="?/settings">
		<Card.Header>
			<p class="text-coral mb-1 text-[10px] font-extrabold tracking-[.14em] uppercase">
				{schedule.name} payment plan
			</p>
			<Card.Title class="font-serif text-xl">Forecast settings</Card.Title>
			<Card.Description>Choose how often the payment cycle resets.</Card.Description>
		</Card.Header>
		<Card.Content><PaymentScheduleForm {settings} /></Card.Content>
		<Card.Footer><Button type="submit">Update forecast</Button></Card.Footer>
	</form></Card.Root
>

<section class="mb-5 grid grid-cols-3 gap-4 max-sm:grid-cols-1" aria-label="Payment cycle summary">
	{#each [['Payment', money(settings.payment_amount_pence), schedule.cadence], ['Typical cycle cost', money(typicalCycleCost), `${Math.round((typicalCycleCost / settings.payment_amount_pence) * 100)}% of payment`], ['Highest cycle', money(peak), `${money(settings.payment_amount_pence - peak)} remaining`]] as item (item[0])}
		<Card.Root class="border-ink bg-ink text-white"
			><Card.Header
				><Card.Description class="text-[#aebbb4]">{item[0]}</Card.Description><Card.Title
					class="font-serif text-4xl">{item[1]}</Card.Title
				></Card.Header
			><Card.Content class="text-xs text-[#9eaaa4]">{item[2]}</Card.Content></Card.Root
		>
	{/each}
</section>

<Card.Root class="p-7 max-sm:p-4">
	<Card.Header class="flex-row justify-between">
		<div>
			<p class="text-coral mb-3 text-[11px] font-extrabold tracking-[.16em] uppercase">
				Cumulative usage
			</p>
			<h2 class="font-serif text-2xl">How costs stack up</h2>
		</div>
		<div class="flex items-center gap-2 self-start text-xs text-[#7a827e]">
			<span class="bg-coral h-[3px] w-5 rounded"></span>D3 forecast
		</div>
	</Card.Header>
	<Card.Content
		><div class="relative my-3 pl-16 max-sm:pl-12">
			<div
				class="absolute top-[-7px] left-0 flex h-[310px] flex-col justify-between text-[10px] text-[#929995] max-sm:h-[240px]"
			>
				<span>{money(chartMax)}</span><span>{money(chartMax / 2)}</span><span>£0</span>
			</div>
			<svg
				class="block h-[300px] w-full touch-none overflow-visible max-sm:h-[230px]"
				viewBox="0 0 900 300"
				role="img"
				aria-label="D3 cumulative expense usage forecast"
				preserveAspectRatio="none"
				onpointermove={showNearestPoint}
				onpointerleave={() => (hoverIndex = null)}
				><defs
					><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"
						><stop offset="0" stop-color="#de735c" stop-opacity=".25" /><stop
							offset="1"
							stop-color="#de735c"
							stop-opacity=".02"
						/></linearGradient
					></defs
				><line x1="0" y1="0" x2="900" y2="0" stroke="#e8e5de" /><line
					x1="0"
					y1="150"
					x2="900"
					y2="150"
					stroke="#e8e5de"
				/><line x1="0" y1="299" x2="900" y2="299" stroke="#e8e5de" /><path
					d={chartArea}
					fill="url(#area)"
				/><path
					d={chartLine}
					fill="none"
					stroke="#de735c"
					stroke-width="3"
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
				{#if hovered}<line
						x1={hoverX}
						y1="0"
						x2={hoverX}
						y2="300"
						stroke="#172621"
						stroke-opacity=".25"
						stroke-dasharray="4 5"
						vector-effect="non-scaling-stroke"
					/><circle
						cx={hoverX}
						cy={hoverY}
						r="5"
						fill="#fff"
						stroke="#de735c"
						stroke-width="3"
						vector-effect="non-scaling-stroke"
					/>{/if}</svg
			>
			{#if hovered}<Card.Root
					size="sm"
					class="pointer-events-none absolute top-2 z-10 min-w-40 py-3 shadow-lg"
					style={`left: calc(${64 * (1 - hoverX / 900)}px + ${(hoverX / 900) * 100}%); transform: ${
						hoverX > 700 ? 'translateX(-100%)' : hoverX < 200 ? 'translateX(0)' : 'translateX(-50%)'
					};`}
					><Card.Content>
						<p class="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
							{fullDate(hovered.date)}
						</p>
						<p class="text-muted-foreground mt-1 text-xs">{hovered.event ?? 'Running total'}</p>
						<strong class="mt-1 block font-serif text-xl">{money(hovered.total)}</strong>
					</Card.Content></Card.Root
				>{/if}
			<div class="mt-3 flex justify-between text-[10px] text-[#929995]">
				<span>{fullDate(usage.start)}</span><span
					>{fullDate(usage.points[Math.floor(usage.points.length / 2)].date)}</span
				><span>{fullDate(usage.end)}</span>
			</div>
		</div></Card.Content
	>
	<Card.Footer class="bg-paper mx-6 mb-6 flex items-start gap-3 rounded-xl p-4">
		<span class="grid size-7 place-items-center rounded-full bg-[#dceae3] text-[#35715f]"
			><Check size={15} /></span
		>
		<div>
			<b class="text-xs">{schedule.name} payment cycle</b>
			<p class="mt-1 text-xs text-[#747d78]">
				The running total returns to zero {schedule.description}
			</p>
		</div>
	</Card.Footer>
</Card.Root>
