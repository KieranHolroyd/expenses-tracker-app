<script lang="ts">
	import { Check } from '@lucide/svelte';
	import UsageForecast from '$lib/components/UsageForecast.svelte';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	let { data, form } = $props();
</script>

<svelte:head><title>Usage forecast · Ledgerly</title></svelte:head>
{#if form?.message}<Alert class="mb-6 border-[#cbded4] bg-[#e8f2ed] text-[#326b59]"
		><Check /><AlertDescription>{form.message}</AlertDescription></Alert
	>{/if}
<UsageForecast expenses={data.expenses} usage={data.usage} settings={data.settings} />
