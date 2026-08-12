<script lang="ts">
	import { enhance } from '$app/forms';
	import { Loader2, Sparkles } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';

	let pending = $state(false);
</script>

<form
	method="POST"
	action="?/categorise"
	use:enhance={() => {
		pending = true;
		return async ({ update }) => {
			await update();
			pending = false;
		};
	}}
>
	<Button type="submit" variant="outline" size="lg" disabled={pending}>
		{#if pending}<Loader2 size={18} class="animate-spin" /> Categorising…{:else}<Sparkles
				size={18}
			/> Auto-categorise{/if}
	</Button>
</form>
