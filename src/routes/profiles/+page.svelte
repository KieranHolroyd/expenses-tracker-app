<script lang="ts">
	import { LogOut } from '@lucide/svelte';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import CreateProfileDialog from '$lib/components/CreateProfileDialog.svelte';
	import ProfileCard from '$lib/components/ProfileCard.svelte';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Choose a profile · Ledgerly</title>
	<meta name="theme-color" content="#141414" />
</svelte:head>

<main class="min-h-screen bg-[#141414] px-6 py-8 text-white sm:px-10 sm:py-10">
	<header class="mx-auto flex w-full max-w-7xl items-center">
		<a
			class="flex items-center gap-3 text-2xl font-bold tracking-tight text-white no-underline"
			href="/profiles"
		>
			<span class="bg-coral grid size-10 place-items-center rounded-md font-serif text-2xl">L</span>
			Ledgerly
		</a>
		<div class="ml-auto flex items-center gap-4 text-sm">
			<span class="hidden text-[#a3a3a3] sm:inline">{data.account.name}</span>
			<form method="POST" action="/auth/logout">
				<button
					type="submit"
					class="flex items-center gap-2 rounded-lg px-3 py-2 font-semibold text-[#a3a3a3] transition-colors hover:bg-[#1f1f1f] hover:text-white"
				>
					<LogOut size={16} /> Sign out
				</button>
			</form>
		</div>
	</header>

	<section
		class="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-6xl flex-col items-center justify-center py-16"
	>
		<p class="mb-3 text-sm font-semibold tracking-[0.18em] text-[#a3a3a3] uppercase">
			Personal spaces
		</p>
		<h1 class="text-center font-serif text-4xl font-medium tracking-[-0.035em] sm:text-6xl">
			Who’s using Ledgerly?
		</h1>
		<p class="mt-4 mb-12 max-w-lg text-center text-base leading-relaxed text-[#a3a3a3] sm:text-lg">
			Choose a profile to see its expenses and four-week forecast.
		</p>
		{#if form?.message}
			<Alert variant="destructive" class="mb-8 max-w-md bg-white text-[#151515]">
				<AlertDescription>{form.message}</AlertDescription>
			</Alert>
		{/if}
		<div class="flex flex-wrap justify-center gap-x-6 gap-y-10 sm:gap-x-9">
			{#each data.profiles as profile (profile.id)}
				<ProfileCard {profile} />
			{/each}
			<CreateProfileDialog disabled={data.profiles.length >= 8} />
		</div>
		{#if data.profiles.length >= 8}
			<p class="mt-10 text-sm text-[#8c8c8c]">Profile limit reached.</p>
		{/if}
	</section>
</main>
