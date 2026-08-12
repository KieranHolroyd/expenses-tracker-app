<script lang="ts">
	import { Pencil, Plus } from '@lucide/svelte';
	import { defaultCategories } from '$lib/format';
	import type { Expense } from '$lib/types';
	import CategoryOmnibox from '$lib/components/CategoryOmnibox.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import * as InputGroup from '$lib/components/ui/input-group';
	import * as Select from '$lib/components/ui/select';
	let {
		open = $bindable(),
		expense,
		categories = []
	}: { open: boolean; expense?: Expense; categories?: string[] } = $props();
	let category = $state('Software');
	let cadence = $state('Monthly');
	let required = $state(false);
	let editing = $derived(Boolean(expense));
	// The built-in six always appear, so a new profile has somewhere to start.
	let options = $derived([...new Set([...categories, ...defaultCategories])].sort());

	$effect(() => {
		if (open) {
			category = expense?.category ?? 'Software';
			cadence = expense?.cadence ?? 'Monthly';
			required = Boolean(expense?.required);
		}
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-xl">
		<Dialog.Header
			><p class="text-coral text-[11px] font-extrabold tracking-[.16em] uppercase">
				{editing ? 'Update recurring cost' : 'New recurring cost'}
			</p>
			<Dialog.Title class="font-serif text-2xl"
				>{editing ? 'Edit expense' : 'Add an expense'}</Dialog.Title
			><Dialog.Description
				>{editing
					? 'Update the details used in your recurring-cost forecast.'
					: 'Add a subscription, service, or recurring bill to your forecast.'}</Dialog.Description
			></Dialog.Header
		>
		<form method="POST" action={editing ? '?/edit' : '?/add'}>
			{#if expense}<input type="hidden" name="id" value={expense.id} />{/if}
			<Field.Group class="grid grid-cols-2 gap-5 max-sm:grid-cols-1">
				<Field.Field class="col-span-2 max-sm:col-span-1">
					<Field.Label for="expense-name">Name</Field.Label><Input
						id="expense-name"
						name="name"
						required
						placeholder="e.g. Spotify"
						value={expense?.name ?? ''}
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
							value={expense ? (expense.amount_pence / 100).toFixed(2) : ''}
						/></InputGroup.Root
					>
				</Field.Field>
				<Field.Field>
					<Field.Label for="expense-category">Category</Field.Label>
					<CategoryOmnibox bind:value={category} categories={options} />
					<Field.Description>Pick one, or type a name of your own.</Field.Description>
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
						value={expense?.next_due_date ?? new Date().toISOString().slice(0, 10)}
					/>
				</Field.Field>
				<Field.Field class="col-span-2 max-sm:col-span-1">
					<label
						class="hover:bg-accent/40 flex cursor-pointer items-start gap-3 rounded-xl border p-3.5"
					>
						<input
							type="checkbox"
							name="required"
							value="1"
							bind:checked={required}
							class="accent-coral mt-0.5 size-4 shrink-0"
						/>
						<span>
							<b class="block text-[13px]">This one is required</b>
							<small class="text-muted-foreground"
								>Rent, insurance, a bill you cannot drop. Everything is optional until you say
								otherwise, and required expenses are kept out of the cut list.</small
							>
						</span>
					</label>
				</Field.Field>
			</Field.Group>
			<Dialog.Footer class="col-span-2 border-t pt-5 max-sm:col-span-1"
				><Dialog.Close
					>{#snippet child({ props })}<Button variant="outline" {...props}>Cancel</Button
						>{/snippet}</Dialog.Close
				><Button type="submit"
					>{#if editing}<Pencil /> Save changes{:else}<Plus /> Add expense{/if}</Button
				></Dialog.Footer
			>
		</form>
	</Dialog.Content>
</Dialog.Root>
