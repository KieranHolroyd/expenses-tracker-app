<script lang="ts">
	import { FileDown } from '@lucide/svelte';
	import { buttonVariants } from '$lib/components/ui/button';
</script>

<a
	class={buttonVariants({ variant: 'outline', size: 'lg' })}
	href="/expenses/export"
	download
	data-sveltekit-reload><FileDown size={18} /> Export CSV</a
>
