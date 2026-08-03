<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import * as InputGroup from '$lib/components/ui/input-group';
	import * as Select from '$lib/components/ui/select';
	let { open = $bindable() }: { open: boolean } = $props();
	let category = $state('Software');
	let cadence = $state('Monthly');
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-xl">
		<Dialog.Header
			><p class="text-coral text-[11px] font-extrabold tracking-[.16em] uppercase">
				New recurring cost
			</p>
			<Dialog.Title class="font-serif text-2xl">Add an expense</Dialog.Title><Dialog.Description
				>Add a subscription, service, or recurring bill to your forecast.</Dialog.Description
			></Dialog.Header
		>
		<form method="POST" action="?/add">
			<Field.Group class="grid grid-cols-2 gap-5 max-sm:grid-cols-1">
				<Field.Field class="col-span-2 max-sm:col-span-1">
					<Field.Label for="expense-name">Name</Field.Label><Input
						id="expense-name"
						name="name"
						required
						placeholder="e.g. Spotify"
					/>
				</Field.Field>
				<Field.Field>
					<Field.Label for="expense-amount">Amount</Field.Label>
					<InputGroup.Root
						><InputGroup.Addon><InputGroup.Text>£</InputGroup.Text></InputGroup.Addon
						><InputGroup.Input
							id="expense-amount"
							name="amount"
							type="number"
							min="0.01"
							step="0.01"
							required
							placeholder="12.99"
						/></InputGroup.Root
					>
				</Field.Field>
				<Field.Field>
					<Field.Label>Category</Field.Label><Select.Root type="single" bind:value={category}
						><Select.Trigger class="w-full">{category}</Select.Trigger><Select.Content
							>{#each ['Software', 'Infrastructure', 'Entertainment', 'Lifestyle', 'Home', 'Other'] as item (item)}<Select.Item
									value={item}>{item}</Select.Item
								>{/each}</Select.Content
						></Select.Root
					><input type="hidden" name="category" value={category} />
				</Field.Field>
				<Field.Field>
					<Field.Label>Cadence</Field.Label><Select.Root type="single" bind:value={cadence}
						><Select.Trigger class="w-full">{cadence}</Select.Trigger><Select.Content
							><Select.Item value="Monthly">Monthly</Select.Item><Select.Item value="Yearly"
								>Yearly</Select.Item
							></Select.Content
						></Select.Root
					><input type="hidden" name="cadence" value={cadence} />
				</Field.Field>
				<Field.Field>
					<Field.Label for="next-charge">Next charge</Field.Label><Input
						id="next-charge"
						name="next_due_date"
						type="date"
						required
						value="2026-08-12"
					/>
				</Field.Field>
			</Field.Group>
			<Dialog.Footer class="col-span-2 border-t pt-5 max-sm:col-span-1"
				><Dialog.Close
					>{#snippet child({ props })}<Button variant="outline" {...props}>Cancel</Button
						>{/snippet}</Dialog.Close
				><Button type="submit"><Plus /> Add expense</Button></Dialog.Footer
			>
		</form>
	</Dialog.Content>
</Dialog.Root>
