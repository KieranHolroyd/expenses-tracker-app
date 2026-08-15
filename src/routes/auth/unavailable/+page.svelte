<script lang="ts">
	import { ShieldAlert } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Sign-in unavailable · Ledgerly</title>
	<meta name="theme-color" content="#141414" />
</svelte:head>

<main
	class="grid min-h-screen place-items-center bg-[#141414] px-6 py-10 text-white sm:px-10 sm:py-14"
>
	<section class="flex w-full max-w-md flex-col items-center">
		<span class="grid size-16 place-items-center rounded-2xl bg-[#1f1f1f] text-[#d9a441]">
			<ShieldAlert size={30} />
		</span>
		<h1 class="mt-6 text-center font-serif text-3xl font-medium tracking-[-0.035em]">
			Sign-in is unavailable
		</h1>
		<p class="mt-3 text-center text-sm leading-relaxed text-[#a3a3a3]">
			Ledgerly could not register itself with Holroyd ID, so there is nothing to sign in against
			yet. Nobody is locked out permanently — it retries every minute, and this page will start
			working on its own once the provider answers.
		</p>
		<p class="mt-6 text-center text-xs leading-relaxed text-[#8c8c8c]">
			If it persists, the server log explains why under <code class="text-[#a3a3a3]"
				>[registration]</code
			>. The usual causes are <code class="text-[#a3a3a3]">ORIGIN</code> being unset or pointing somewhere
			the auth service does not trust.
		</p>
		<a href="/" class="mt-8 text-sm text-[#a3a3a3] underline-offset-4 hover:text-white">
			Try again
		</a>
	</section>
</main>
