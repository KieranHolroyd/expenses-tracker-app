<script lang="ts">
	import { Lock, LockKeyhole, ShieldAlert, Unlock } from '@lucide/svelte';
	import PasscodeInput from '$lib/components/PasscodeInput.svelte';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Field from '$lib/components/ui/field';

	let { hasPasscode = false }: { hasPasscode?: boolean } = $props();
	let open = $state(false);
	let acknowledged = $state(false);
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger
		class="hover:text-ink flex items-center gap-2 rounded-lg p-1.5 text-sm font-semibold text-[#59635e] transition-colors hover:bg-[#ebe8df]"
		aria-label={hasPasscode ? 'Passcode settings' : 'Add a passcode'}
		title={hasPasscode ? 'Passcode settings' : 'Add a passcode'}
	>
		{#if hasPasscode}
			<Lock size={17} />
		{:else}
			<LockKeyhole size={17} />
		{/if}
		<span class="hidden lg:inline">{hasPasscode ? 'Passcode' : 'Add a passcode'}</span>
	</Dialog.Trigger>

	<Dialog.Content class="sm:max-w-md">
		{#if hasPasscode}
			<Dialog.Header>
				<Dialog.Title>Passcode</Dialog.Title>
				<Dialog.Description>
					This profile is encrypted. Locking it clears the key from the server until the code is
					entered again.
				</Dialog.Description>
			</Dialog.Header>

			<form method="POST" action="?/lock">
				<Button type="submit" variant="outline" class="w-full"><Lock size={16} /> Lock now</Button>
			</form>

			<Field.Separator />

			<form method="POST" action="?/removePasscode" class="space-y-4">
				<Field.Field>
					<Field.Label for="remove-passcode">Remove the passcode</Field.Label>
					<PasscodeInput id="remove-passcode" name="passcode" />
					<Field.Description>
						Enter the current code to decrypt this profile and store it in plain text again.
					</Field.Description>
				</Field.Field>
				<Dialog.Footer>
					<Dialog.Close><Button type="button" variant="outline">Cancel</Button></Dialog.Close>
					<Button type="submit" variant="destructive"><Unlock size={16} /> Remove passcode</Button>
				</Dialog.Footer>
			</form>
		{:else}
			<Dialog.Header>
				<Dialog.Title>Add a passcode</Dialog.Title>
				<Dialog.Description>
					A 4-digit code encrypts this profile’s expense names, categories, amounts and take-home
					pay. Due dates, billing periods and the profile name stay readable.
				</Dialog.Description>
			</Dialog.Header>

			<Alert variant="destructive">
				<ShieldAlert />
				<AlertDescription>
					<strong>Lose the code, lose the data.</strong> The code is never stored — not on the server,
					not in the database, nowhere. There is no reset link and no backup key, so nobody, including
					you, can recover these expenses without it. Export a CSV first if you want a readable copy.
				</AlertDescription>
			</Alert>

			<form method="POST" action="?/setPasscode" class="space-y-5">
				<Field.Field>
					<Field.Label for="new-passcode">4-digit passcode</Field.Label>
					<PasscodeInput id="new-passcode" name="passcode" />
				</Field.Field>
				<Field.Field>
					<Field.Label for="confirm-passcode">Confirm passcode</Field.Label>
					<PasscodeInput id="confirm-passcode" name="confirm" />
				</Field.Field>
				<label class="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed">
					<input
						type="checkbox"
						name="acknowledged"
						bind:checked={acknowledged}
						required
						class="border-input accent-coral mt-0.5 size-4 shrink-0 rounded-sm border"
					/>
					<span>I understand that if I forget this code, this profile’s data is lost for good.</span
					>
				</label>
				<Dialog.Footer>
					<Dialog.Close><Button type="button" variant="outline">Cancel</Button></Dialog.Close>
					<Button type="submit" disabled={!acknowledged}>
						<LockKeyhole size={16} /> Encrypt this profile
					</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
