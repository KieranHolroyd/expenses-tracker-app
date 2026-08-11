<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ChartPie, LayoutDashboard, ReceiptText, TrendingUp } from '@lucide/svelte';
	import PasscodeDialog from '$lib/components/PasscodeDialog.svelte';
	import ProfileAvatar from '$lib/components/ProfileAvatar.svelte';
	import * as Tabs from '$lib/components/ui/tabs';
	let active = $derived(
		page.url.pathname.startsWith('/usage')
			? 'usage'
			: page.url.pathname.startsWith('/insights')
				? 'insights'
				: 'expenses'
	);
	let profile = $derived(page.data.profile);
</script>

<header
	class="border-line/80 bg-paper/90 sticky top-0 z-30 grid h-[70px] grid-cols-[1fr_auto_1fr] items-center border-b px-6 backdrop-blur-xl lg:px-[5vw]"
>
	<a
		class="text-ink flex items-center gap-2.5 font-serif text-xl font-bold no-underline"
		href="/expenses"
		aria-label="Ledgerly expenses"
		><span class="bg-ink grid size-9 -rotate-3 place-items-center rounded-[10px] text-white"
			><ReceiptText size={20} /></span
		>Ledgerly</a
	>
	<Tabs.Root value={active} onValueChange={(value) => goto(`/${value}`)}
		><Tabs.List class="bg-[#ebe8df]" aria-label="Main navigation"
			><Tabs.Trigger value="expenses" aria-label="Expenses"
				><LayoutDashboard size={17} /> <span class="max-sm:hidden">Expenses</span></Tabs.Trigger
			><Tabs.Trigger value="insights" aria-label="Insights"
				><ChartPie size={17} /> <span class="max-sm:hidden">Insights</span></Tabs.Trigger
			><Tabs.Trigger value="usage" aria-label="Usage"
				><TrendingUp size={17} /> <span class="max-sm:hidden">Usage</span></Tabs.Trigger
			></Tabs.List
		></Tabs.Root
	>
	<div class="ml-auto flex items-center gap-1">
		{#if profile}
			<PasscodeDialog hasPasscode={profile.has_passcode} />
		{/if}
		<a
			href="/profiles"
			class="hover:text-ink flex items-center gap-2.5 rounded-lg p-1.5 text-sm font-semibold text-[#59635e] no-underline transition-colors hover:bg-[#ebe8df]"
			aria-label="Switch profile"
		>
			<span class="hidden sm:inline">{profile?.name}</span>
			{#if profile}
				<ProfileAvatar
					name={profile.name}
					color={profile.avatar_color}
					class="size-9 rounded-md after:rounded-md [&_[data-slot=avatar-fallback]]:rounded-md"
				/>
			{/if}
		</a>
	</div>
</header>
