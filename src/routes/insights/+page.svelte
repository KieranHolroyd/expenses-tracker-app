<script lang="ts">
	import { Check } from '@lucide/svelte';
	import AnnualHeadline from '$lib/components/AnnualHeadline.svelte';
	import CategoryCompare from '$lib/components/CategoryCompare.svelte';
	import CategoryStats from '$lib/components/CategoryStats.svelte';
	import ChargeCalendar from '$lib/components/ChargeCalendar.svelte';
	import CutCandidates from '$lib/components/CutCandidates.svelte';
	import InsightsSection from '$lib/components/InsightsSection.svelte';
	import MonthlyProjection from '$lib/components/MonthlyProjection.svelte';
	import RenewalSchedule from '$lib/components/RenewalSchedule.svelte';
	import RequiredSplit from '$lib/components/RequiredSplit.svelte';
	import SpendDistribution from '$lib/components/SpendDistribution.svelte';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	let { data, form } = $props();

	const sections = [
		['overview', 'Overview'],
		['timing', 'The year ahead'],
		['categories', 'Where it goes'],
		['pressure', 'What to change']
	] as const;
</script>

<svelte:head><title>Insights · Ledgerly</title></svelte:head>
{#if form?.message}<Alert class="mb-6 border-[#cbded4] bg-[#e8f2ed] text-[#326b59]"
		><Check /><AlertDescription>{form.message}</AlertDescription></Alert
	>{/if}

<section class="mb-10 flex items-end justify-between gap-8 max-sm:flex-col max-sm:items-start">
	<div>
		<p class="text-coral mb-3 text-[11px] font-extrabold tracking-[.16em] uppercase">Insights</p>
		<h1
			class="m-0 font-serif text-[clamp(42px,5vw,66px)] leading-[.98] font-medium tracking-[-.045em]"
		>
			The whole year,<br /><em class="text-coral font-medium">in one number.</em>
		</h1>
		<p class="mt-5 max-w-xl text-base leading-relaxed text-[#66706b]">
			Every cadence normalised to a yearly figure, then broken back down by month, category and
			concentration.
		</p>
	</div>
	<Button href="/expenses" variant="outline" size="lg">Manage expenses</Button>
</section>

<!-- A long page, so it says up front what it contains and lets you skip ahead. -->
<nav
	class="border-line bg-paper/90 sticky top-[70px] z-20 -mx-1 mb-10 flex flex-wrap gap-1 border-y py-2 backdrop-blur-xl"
	aria-label="Insight sections"
>
	{#each sections as [id, label] (id)}
		<a
			class="text-muted-foreground hover:bg-accent hover:text-ink rounded-lg px-3 py-1.5 text-xs font-semibold no-underline transition-colors"
			href="#{id}">{label}</a
		>
	{/each}
</nav>

<InsightsSection
	id="overview"
	step="01 · Overview"
	title="What a year of this costs"
	description="Everything active, normalised to a yearly figure and set against your take-home pay."
>
	<AnnualHeadline stats={data.stats} />
</InsightsSection>

<InsightsSection
	id="timing"
	step="02 · The year ahead"
	title="When the money actually leaves"
	description="Charges landed on the calendar rather than smoothed, so the heavy months show up as heavy."
>
	<div class="mb-5"><MonthlyProjection stats={data.stats} /></div>
	<div class="grid grid-cols-[minmax(0,1fr)_minmax(0,420px)] items-start gap-5 max-xl:grid-cols-1">
		<ChargeCalendar stats={data.stats} />
		<RenewalSchedule stats={data.stats} />
	</div>
</InsightsSection>

<InsightsSection
	id="categories"
	step="03 · Where it goes"
	title="Category against category"
	description="Follow any category through to its own page for the line-by-line detail."
>
	<div class="mb-5"><CategoryCompare stats={data.stats} /></div>
	<CategoryStats stats={data.stats} />
</InsightsSection>

<InsightsSection
	id="pressure"
	step="04 · What to change"
	title="Where the weight sits"
	description="How lopsided the line-up is, and what dropping any part of it would actually save."
>
	<div class="mb-5"><RequiredSplit stats={data.stats} /></div>
	<div class="grid grid-cols-2 items-start gap-5 max-xl:grid-cols-1">
		<CutCandidates stats={data.stats} />
		<SpendDistribution stats={data.stats} />
	</div>
</InsightsSection>
