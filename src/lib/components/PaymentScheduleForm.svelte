<script lang="ts">
	import type { AppSettings, PaymentCycleType } from '$lib/types';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import * as InputGroup from '$lib/components/ui/input-group';
	import * as Select from '$lib/components/ui/select';

	let { settings }: { settings: AppSettings } = $props();
	let cycleType: PaymentCycleType = $derived(settings.cycle_type);
	let cycleLabel = $derived(
		cycleType === 'four_week'
			? 'Every four weeks'
			: cycleType === 'monthly'
				? 'Monthly'
				: 'Last Friday monthly'
	);
</script>

<Field.Group class="grid grid-cols-3 gap-4 max-md:grid-cols-1">
	<Field.Field>
		<Field.Label for="payment-amount">Payment amount</Field.Label>
		<InputGroup.Root>
			<InputGroup.Addon><InputGroup.Text>£</InputGroup.Text></InputGroup.Addon>
			<InputGroup.Input
				id="payment-amount"
				name="payment_amount"
				type="number"
				min="0.01"
				step="0.01"
				value={(settings.payment_amount_pence / 100).toFixed(2)}
				required
			/>
		</InputGroup.Root>
	</Field.Field>

	<Field.Field>
		<Field.Label for="cycle-type">Payment schedule</Field.Label>
		<input type="hidden" name="cycle_type" value={cycleType} />
		<Select.Root type="single" bind:value={cycleType}>
			<Select.Trigger id="cycle-type" class="w-full">{cycleLabel}</Select.Trigger>
			<Select.Content>
				<Select.Item value="four_week">Every four weeks</Select.Item>
				<Select.Item value="monthly">Monthly</Select.Item>
				<Select.Item value="last_friday">Last Friday of each month</Select.Item>
			</Select.Content>
		</Select.Root>
	</Field.Field>

	{#if cycleType === 'last_friday'}
		<input type="hidden" name="payday_anchor_date" value={settings.payday_anchor_date} />
		<div
			class="border-border bg-muted/45 text-muted-foreground flex min-h-16 items-center rounded-md border px-4 text-sm"
		>
			Paydays are calculated automatically from the final Friday in each calendar month.
		</div>
	{:else}
		<Field.Field>
			<Field.Label for="payday-anchor">
				{cycleType === 'four_week' ? 'Known payday' : 'Payday date'}
			</Field.Label>
			<Input
				id="payday-anchor"
				name="payday_anchor_date"
				type="date"
				value={settings.payday_anchor_date}
				required
			/>
		</Field.Field>
	{/if}
</Field.Group>
