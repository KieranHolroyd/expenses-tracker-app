<script lang="ts">
	import { Check, Plus } from '@lucide/svelte';
	import AddExpenseDialog from '$lib/components/AddExpenseDialog.svelte';
	import CategoryBreakdown from '$lib/components/CategoryBreakdown.svelte';
	import CsvExport from '$lib/components/CsvExport.svelte';
	import CsvImport from '$lib/components/CsvImport.svelte';
	import ExpenseTable from '$lib/components/ExpenseTable.svelte';
	import SummaryCards from '$lib/components/SummaryCards.svelte';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	let { data, form } = $props();
	let showAdd = $state(false);
</script>

<svelte:head><title>Recurring expenses · Ledgerly</title></svelte:head>
{#if form?.message}<Alert class="mb-6 border-[#cbded4] bg-[#e8f2ed] text-[#326b59]"
		><Check /><AlertDescription>{form.message}</AlertDescription></Alert
	>{/if}
<section class="mb-10 flex items-end justify-between gap-8 max-sm:flex-col max-sm:items-start">
	<div>
		<p class="text-coral mb-3 text-[11px] font-extrabold tracking-[.16em] uppercase">
			Recurring expenses
		</p>
		<h1
			class="m-0 font-serif text-[clamp(42px,5vw,66px)] leading-[.98] font-medium tracking-[-.045em]"
		>
			Keep an eye on the<br /><em class="text-coral font-medium">quiet costs.</em>
		</h1>
		<p class="mt-5 max-w-xl text-base leading-relaxed text-[#66706b]">
			Your subscriptions, services and recurring bills — gathered in one calm place.
		</p>
	</div>
	<div class="flex gap-2.5">
		<CsvExport /><CsvImport /><Button size="lg" onclick={() => (showAdd = true)}
			><Plus size={18} /> Add expense</Button
		>
	</div>
</section>
<SummaryCards stats={data.stats} />
<section class="grid grid-cols-[minmax(0,1fr)_310px] items-start gap-5 max-xl:grid-cols-1">
	<ExpenseTable expenses={data.expenses} /><CategoryBreakdown expenses={data.expenses} />
</section>
<AddExpenseDialog bind:open={showAdd} />
