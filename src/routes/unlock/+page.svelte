<script lang="ts">
	import { Lock } from '@lucide/svelte';
	import PasscodeInput from '$lib/components/PasscodeInput.svelte';
	import ProfileAvatar from '$lib/components/ProfileAvatar.svelte';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Locked · Ledgerly</title>
	<meta name="theme-color" content="#141414" />
</svelte:head>

<main
	class="grid min-h-screen place-items-center bg-[#141414] px-6 py-10 text-white sm:px-10 sm:py-14"
>
	<section class="flex w-full max-w-sm flex-col items-center">
		<ProfileAvatar
			name={data.profile.name}
			color={data.profile.avatar_color}
			class="size-20 rounded-md after:rounded-md [&_[data-slot=avatar-fallback]]:rounded-md [&_[data-slot=avatar-fallback]]:text-3xl"
		/>
		<h1 class="mt-6 text-center font-serif text-3xl font-medium tracking-[-0.035em]">
			{data.profile.name} is locked
		</h1>
		<p class="mt-3 mb-8 text-center text-sm leading-relaxed text-[#a3a3a3]">
			Enter the 4-digit passcode to decrypt this profile’s expenses.
		</p>

		{#if form?.message}
			<Alert variant="destructive" class="mb-6 bg-white text-[#151515]">
				<AlertDescription>{form.message}</AlertDescription>
			</Alert>
		{:else if data.waitFor}
			<Alert variant="destructive" class="mb-6 bg-white text-[#151515]">
				<AlertDescription>Too many attempts. Try again in {data.waitFor}s.</AlertDescription>
			</Alert>
		{/if}

		<form method="POST" class="flex w-full flex-col gap-4">
			<label class="sr-only" for="unlock-passcode">Passcode</label>
			<PasscodeInput
				id="unlock-passcode"
				name="passcode"
				focus
				class="border-[#3a3a3a] bg-[#1f1f1f] text-white placeholder:text-[#5c5c5c]"
			/>
			<Button type="submit" size="lg" class="w-full"><Lock size={16} /> Unlock</Button>
		</form>

		<p class="mt-8 text-center text-xs leading-relaxed text-[#8c8c8c]">
			There is no reset. Ledgerly stores no copy of this code, so if it is forgotten this profile’s
			expenses cannot be recovered by anyone.
		</p>
		<a href="/profiles" class="mt-6 text-sm text-[#a3a3a3] underline-offset-4 hover:text-white">
			Use a different profile
		</a>
	</section>
</main>
