<script lang="ts">
	import { Check } from '@lucide/svelte';
	import AnnualHeadline from '$lib/components/AnnualHeadline.svelte';
	import CategoryStats from '$lib/components/CategoryStats.svelte';
	import MonthlyProjection from '$lib/components/MonthlyProjection.svelte';
	import RenewalSchedule from '$lib/components/RenewalSchedule.svelte';
	import SpendDistribution from '$lib/components/SpendDistribution.svelte';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	let { data, form } = $props();
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

<AnnualHeadline stats={data.stats} />

<section class="mb-5">
	<MonthlyProjection stats={data.stats} />
</section>

<section class="mb-5 grid grid-cols-[minmax(0,1fr)_minmax(0,380px)] items-start gap-5 max-xl:grid-cols-1">
	<SpendDistribution stats={data.stats} />
	<RenewalSchedule stats={data.stats} />
</section>

<CategoryStats stats={data.stats} />
