<script lang="ts">
	import { FileUp } from '@lucide/svelte';
	import { buttonVariants } from '$lib/components/ui/button';
</script>

<form method="POST" action="?/import" enctype="multipart/form-data">
	<label class={buttonVariants({ variant: 'outline', size: 'lg', class: 'cursor-pointer' })}
		><FileUp size={18} /> Import CSV<input
			class="sr-only"
			type="file"
			name="csv"
			accept=".csv,text/csv"
			onchange={(event) => event.currentTarget.form?.requestSubmit()}
		/></label
	>
</form>
