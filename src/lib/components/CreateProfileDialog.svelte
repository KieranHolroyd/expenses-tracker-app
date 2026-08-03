<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';

	let { disabled = false }: { disabled?: boolean } = $props();
</script>

<Dialog.Root>
	<Dialog.Trigger
		class="group flex w-32 flex-col items-center gap-4 border-0 bg-transparent p-0 text-[#8c8c8c] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-40"
		{disabled}
	>
		<span
			class="grid size-28 place-items-center rounded-md bg-[#2f2f2f] transition-transform duration-200 group-hover:scale-105 group-hover:ring-2 group-hover:ring-white sm:size-36"
		>
			<Plus class="size-14" strokeWidth={1.5} />
		</span>
		<span class="text-lg sm:text-xl">Add profile</span>
	</Dialog.Trigger>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Create a profile</Dialog.Title>
			<Dialog.Description>
				Each profile gets its own expenses, payment plan and forecast.
			</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/create" class="space-y-6">
			<Field.Field>
				<Field.Label for="profile-name">Name</Field.Label>
				<Input
					id="profile-name"
					name="name"
					placeholder="Profile name"
					maxlength={24}
					required
					autocomplete="off"
				/>
			</Field.Field>
			<Dialog.Footer>
				<Dialog.Close><Button type="button" variant="outline">Cancel</Button></Dialog.Close>
				<Button type="submit">Create profile</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
