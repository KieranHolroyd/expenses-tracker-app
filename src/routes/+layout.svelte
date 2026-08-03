<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import AppHeader from '$lib/components/AppHeader.svelte';
	let { children } = $props();
	let choosingProfile = $derived(page.url.pathname === '/profiles');
</script>

<svelte:head>
	<title>Ledgerly — Recurring expense tracker</title>
	<meta
		name="description"
		content="Track recurring expenses and see how subscriptions accumulate between paydays."
	/>
	<meta name="theme-color" content="#f5f2ea" />
</svelte:head>

{#if choosingProfile}
	{@render children()}
{:else}
	<div class="bg-paper text-ink min-h-screen">
		<AppHeader />
		<main class="mx-auto max-w-[1440px] px-5 py-12 lg:px-[5vw] lg:py-16">
			{@render children()}
		</main>
	</div>
{/if}
