<script lang="ts">
	import { Lock } from '@lucide/svelte';
	import type { Profile } from '$lib/types';
	import ProfileAvatar from './ProfileAvatar.svelte';

	let { profile }: { profile: Profile } = $props();
</script>

<form method="POST" action="?/select" class="group">
	<input type="hidden" name="id" value={profile.id} />
	<button
		type="submit"
		class="flex w-32 flex-col items-center gap-4 border-0 bg-transparent p-0 text-[#8c8c8c] transition-colors group-hover:text-white sm:w-40"
		aria-label={profile.has_passcode ? `Unlock ${profile.name}` : `Continue as ${profile.name}`}
	>
		<span class="relative">
			<ProfileAvatar
				name={profile.name}
				color={profile.avatar_color}
				class="size-28 rounded-md transition-transform duration-200 group-hover:scale-105 after:rounded-md group-hover:after:border-2 group-hover:after:border-white sm:size-36 [&_[data-slot=avatar-fallback]]:rounded-md [&_[data-slot=avatar-fallback]]:text-5xl sm:[&_[data-slot=avatar-fallback]]:text-6xl"
			/>
			{#if profile.has_passcode}
				<span
					class="absolute right-1.5 bottom-1.5 grid size-7 place-items-center rounded-full bg-[#141414]/85 text-white"
					title="Passcode protected"
				>
					<Lock size={14} />
				</span>
			{/if}
		</span>
		<span class="max-w-full truncate text-lg sm:text-xl">{profile.name}</span>
	</button>
</form>
