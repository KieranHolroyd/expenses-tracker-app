<script lang="ts">
	import {
		createTable,
		getCoreRowModel,
		getPaginationRowModel,
		getSortedRowModel,
		type ColumnDef,
		type PaginationState,
		type SortingState,
		type Updater
	} from '@tanstack/table-core';
	import { goto } from '$app/navigation';
	import {
		ArrowUpDown,
		ChartLine,
		CirclePause,
		Ellipsis,
		Lock,
		LockOpen,
		Pencil,
		Search,
		Trash2
	} from '@lucide/svelte';
	import AddExpenseDialog from '$lib/components/AddExpenseDialog.svelte';
	import { categoryColor, categorySlug, money, monthlyCost, shortDate } from '$lib/format';
	import type { Expense } from '$lib/types';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as InputGroup from '$lib/components/ui/input-group';
	import * as Select from '$lib/components/ui/select';
	import * as Table from '$lib/components/ui/table';

	let { expenses, categories = [] }: { expenses: Expense[]; categories?: string[] } = $props();
	let query = $state('');
	let category = $state('All categories');
	let cadence = $state('All cadences');
	let necessity = $state('Required & optional');
	let sorting = $state<SortingState>([]);
	let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 10 });
	let rows = $state<any[]>([]);
	let pageCount = $state(0);
	let canPreviousPage = $state(false);
	let canNextPage = $state(false);
	let editingExpense = $state<Expense | null>(null);
	let showEdit = $state(false);
	let filterOptions = $derived([
		'All categories',
		...new Set(expenses.map((expense) => expense.category))
	]);
	let filtered = $derived(
		expenses.filter(
			(expense) =>
				(expense.name.toLowerCase().includes(query.toLowerCase()) ||
					expense.category.toLowerCase().includes(query.toLowerCase())) &&
				(category === 'All categories' || expense.category === category) &&
				(cadence === 'All cadences' || expense.cadence === cadence) &&
				(necessity === 'Required & optional' ||
					(necessity === 'Required') === Boolean(expense.required))
		)
	);

	const columns: ColumnDef<Expense>[] = [
		{ accessorKey: 'name', header: 'Expense' },
		{ accessorKey: 'category', header: 'Category' },
		{ accessorKey: 'next_due_date', header: 'Next charge' },
		{ accessorKey: 'cadence', header: 'Cadence' },
		{ accessorKey: 'amount_pence', header: 'Amount' },
		{ id: 'actions' }
	];
	const headers = [
		{ id: 'name', label: 'Expense' },
		{ id: 'category', label: 'Category' },
		{ id: 'next_due_date', label: 'Next charge' },
		{ id: 'cadence', label: 'Cadence' },
		{ id: 'amount_pence', label: 'Amount' },
		{ id: 'actions', label: '' }
	];
	const table = createTable<Expense>({
		data: [] as Expense[],
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		state: { sorting: [] as SortingState, pagination: { pageIndex: 0, pageSize: 10 } },
		onSortingChange: (updater: Updater<SortingState>) =>
			(sorting = typeof updater === 'function' ? updater(sorting) : updater),
		onPaginationChange: (updater: Updater<PaginationState>) =>
			(pagination = typeof updater === 'function' ? updater(pagination) : updater),
		onStateChange: () => undefined,
		renderFallbackValue: null
	});
	$effect(() => {
		table.setOptions((current) => ({ ...current, data: filtered, state: { sorting, pagination } }));
		rows = table.getRowModel().rows;
		pageCount = table.getPageCount();
		canPreviousPage = table.getCanPreviousPage();
		canNextPage = table.getCanNextPage();
	});

	function submit(action: 'toggle' | 'toggleRequired' | 'delete', id: number) {
		(document.getElementById(`${action}-${id}`) as HTMLFormElement | null)?.requestSubmit();
	}

	function edit(expense: Expense) {
		editingExpense = expense;
		showEdit = true;
	}
</script>

<Card.Root class="gap-0 overflow-hidden py-0">
	<div
		class="flex items-center justify-between gap-5 border-b p-5 max-lg:flex-col max-lg:items-start"
	>
		<div class="flex items-baseline gap-2">
			<h2 class="font-serif text-2xl">Your expenses</h2>
			<span class="text-muted-foreground text-xs">{filtered.length} of {expenses.length}</span>
		</div>
		<div class="flex gap-2 max-lg:w-full max-sm:grid max-sm:grid-cols-2">
			<InputGroup.Root class="max-lg:flex-1 max-sm:col-span-2"
				><InputGroup.Addon><Search /></InputGroup.Addon><InputGroup.Input
					bind:value={query}
					placeholder="Search expenses"
					aria-label="Search expenses"
				/></InputGroup.Root
			>
			<Select.Root type="single" bind:value={category}
				><Select.Trigger class="min-w-36">{category}</Select.Trigger><Select.Content
					>{#each filterOptions as item (item)}<Select.Item value={item}>{item}</Select.Item
						>{/each}</Select.Content
				></Select.Root
			>
			<Select.Root type="single" bind:value={cadence}
				><Select.Trigger class="min-w-32">{cadence}</Select.Trigger><Select.Content
					><Select.Item value="All cadences">All cadences</Select.Item><Select.Item value="Monthly"
						>Monthly</Select.Item
					><Select.Item value="Yearly">Yearly</Select.Item></Select.Content
				></Select.Root
			>
			<Select.Root type="single" bind:value={necessity}
				><Select.Trigger class="min-w-40">{necessity}</Select.Trigger><Select.Content
					><Select.Item value="Required & optional">Required &amp; optional</Select.Item
					><Select.Item value="Required">Required</Select.Item><Select.Item value="Optional"
						>Optional</Select.Item
					></Select.Content
				></Select.Root
			>
		</div>
	</div>
	<Table.Root>
		<Table.Header
			><Table.Row>
				{#each headers as header (header.id)}
					<Table.Head class={header.id === 'amount_pence' ? 'text-right' : ''}>
						{#if header.id !== 'actions'}<Button
								variant="ghost"
								size="sm"
								class="-ml-2 h-7 text-[10px] tracking-wider uppercase"
								onclick={() => table.getColumn(header.id)?.toggleSorting()}
								>{header.label}<ArrowUpDown class="size-3" /></Button
							>{/if}
					</Table.Head>
				{/each}
			</Table.Row></Table.Header
		>
		<Table.Body
			>{#each rows as row (row.id)}
				{@const expense = row.original}
				<Table.Row class={expense.active ? '' : 'opacity-50'}>
					<Table.Cell
						><a
							class="text-ink flex items-center gap-2.5 no-underline"
							href="/insights/expenses/{expense.id}"
						>
							<span
								class="grid size-8 place-items-center rounded-lg font-extrabold"
								style:color={categoryColor(expense.category)}
								style:background={`color-mix(in srgb, ${categoryColor(expense.category)} 15%, white)`}
								>{expense.name.slice(0, 1)}</span
							>
							<div>
								<span class="flex items-center gap-1.5"
									><b class="text-[13px] hover:underline">{expense.name}</b
									>{#if expense.required}<Badge
											variant="outline"
											class="h-4 gap-1 px-1.5 text-[9px] font-bold tracking-wider uppercase"
											><Lock class="size-2.5" />Required</Badge
										>{/if}</span
								>{#if !expense.active}<small class="text-muted-foreground">Paused</small>{/if}
							</div>
						</a></Table.Cell
					>
					<Table.Cell
						><a href="/insights/categories/{categorySlug(expense.category)}" class="no-underline"
							><Badge variant="secondary" class="hover:bg-accent">{expense.category}</Badge></a
						></Table.Cell
					>
					<Table.Cell>{shortDate(expense.next_due_date)}</Table.Cell>
					<Table.Cell>{expense.cadence}</Table.Cell>
					<Table.Cell class="text-right"
						><b>{money(expense.amount_pence)}</b>{#if expense.cadence === 'Yearly'}<small
								class="text-muted-foreground block">{money(monthlyCost(expense))}/mo</small
							>{/if}</Table.Cell
					>
					<Table.Cell class="w-12"
						><DropdownMenu.Root
							><DropdownMenu.Trigger
								class="hover:bg-muted grid size-8 place-items-center rounded-md"
								aria-label="Actions for {expense.name}"><Ellipsis size={18} /></DropdownMenu.Trigger
							><DropdownMenu.Content align="end"
								><DropdownMenu.Item onclick={() => goto(`/insights/expenses/${expense.id}`)}
									><ChartLine />Deep dive</DropdownMenu.Item
								><DropdownMenu.Item onclick={() => edit(expense)}><Pencil />Edit</DropdownMenu.Item
								><DropdownMenu.Item onclick={() => submit('toggleRequired', expense.id)}
									>{#if expense.required}<LockOpen />Mark optional{:else}<Lock />Mark required{/if}</DropdownMenu.Item
								><DropdownMenu.Item onclick={() => submit('toggle', expense.id)}
									><CirclePause />{expense.active ? 'Pause' : 'Resume'}</DropdownMenu.Item
								><DropdownMenu.Item
									variant="destructive"
									onclick={() => submit('delete', expense.id)}><Trash2 />Delete</DropdownMenu.Item
								></DropdownMenu.Content
							></DropdownMenu.Root
						>
						<form id="toggle-{expense.id}" method="POST" action="?/toggle">
							<input type="hidden" name="id" value={expense.id} />
						</form>
						<form id="toggleRequired-{expense.id}" method="POST" action="?/toggleRequired">
							<input type="hidden" name="id" value={expense.id} />
						</form>
						<form id="delete-{expense.id}" method="POST" action="?/delete">
							<input type="hidden" name="id" value={expense.id} />
						</form></Table.Cell
					>
				</Table.Row>
			{:else}<Table.Row
					><Table.Cell colspan={6} class="text-muted-foreground h-28 text-center"
						>No expenses match those filters.</Table.Cell
					></Table.Row
				>{/each}</Table.Body
		>
	</Table.Root>
	<div class="text-muted-foreground flex items-center justify-between border-t px-5 py-3 text-xs">
		<span>Page {pagination.pageIndex + 1} of {pageCount}</span>
		<div class="flex gap-2">
			<Button
				variant="outline"
				size="sm"
				disabled={!canPreviousPage}
				onclick={() => table.previousPage()}>Previous</Button
			><Button variant="outline" size="sm" disabled={!canNextPage} onclick={() => table.nextPage()}
				>Next</Button
			>
		</div>
	</div>
</Card.Root>

{#if editingExpense}
	{#key editingExpense.id}
		<AddExpenseDialog bind:open={showEdit} expense={editingExpense} {categories} />
	{/key}
{/if}
