import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import { color } from "../theme.js";

interface EditorialItem<T> {
	label: string;
	value: T;
	key?: string;
}

interface EditorialSelectProps<T> {
	items: EditorialItem<T>[];
	onSelect: (item: EditorialItem<T>) => void;
	initialIndex?: number;
}

const brandColor = color.brand;

/** Geometric pointer (figures.pointer equivalent) in the brand amber. */
const EditorialIndicator = ({ isSelected = false }: { isSelected?: boolean }) => (
	<Box marginRight={1}>
		<Text color={isSelected ? brandColor : undefined}>{isSelected ? "❯" : " "}</Text>
	</Box>
);

/** Selected row: brand amber + bold; unselected: default ink. */
const EditorialItem = ({ isSelected = false, label }: { isSelected?: boolean; label: string }) => (
	<Text color={isSelected ? brandColor : undefined} bold={isSelected}>
		{label}
	</Text>
);

/**
 * Theme-aware wrapper over ink-select-input. ink-select-input v5 themes via
 * `itemComponent`/`indicatorComponent` (the old `focusColor` prop is gone), so
 * we supply editorial equivalents that speak the locked palette.
 */
export const EditorialSelectInput = <T,>({
	items,
	onSelect,
	initialIndex,
}: EditorialSelectProps<T>) => (
	<SelectInput
		items={items}
		onSelect={onSelect}
		initialIndex={initialIndex}
		indicatorComponent={EditorialIndicator}
		itemComponent={EditorialItem}
	/>
);
