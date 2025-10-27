import {
	COLOR_MAP,
	MATERIAL_MAP,
	TRIM_MATERIALS,
	TRIM_PATTERNS,
} from "./constants";
import { detectToken } from "./parser";
import { rngPick } from "./random";
import type { ArmorComponent, Entry, OutfitResult, RNG } from "./types";

import DEFAULT_PALETTE from "../assets/palette.txt?raw";

const COLORS =
	DEFAULT_PALETTE.match(/.{6}/g)?.map((hex) => parseInt(hex, 16)) || [];

function itemIdFor(
	piece: "head" | "chest" | "legs" | "feet",
	material: string,
): string {
	const base = MATERIAL_MAP[material];
	const suffix =
		piece === "chest"
			? "chestplate"
			: piece === "legs"
				? "leggings"
				: piece === "head"
					? "helmet"
					: "boots";

	// Always get a valid material, defaulting to iron if not found
	return `minecraft:${base || "iron"}_${suffix}`;
}

function getMatchKey(entry: Entry): number | undefined {
	// Check if the key starts with a number
	const match = entry.key.match(/^(\d+)/);
	return match ? parseInt(match[1], 10) : undefined;
}

function findMatchingEntries(
	sections: Record<string, Entry[]>,
	matchKey: number,
): Record<string, Entry[]> {
	const result: Record<string, Entry[]> = {};

	for (const [section, entries] of Object.entries(sections)) {
		result[section] = entries.filter((e) => getMatchKey(e) === matchKey);
	}

	return result;
}

function buildArmorPiece(
	entry: Entry | null,
	piece: "head" | "chest" | "legs" | "feet",
	rng: RNG,
	matchVars: Record<string, string>,
): ArmorComponent {
	// For non-table entries or no entry, return dyed leather with guaranteed valid color
	if (!entry) {
		const validColors = Object.entries(COLOR_MAP)
			.filter(([_, val]) => val !== undefined && val !== 0)
			.map(([key, _]) => key);
		const randomColor = rngPick(rng, validColors);

		return {
			id: itemIdFor(piece, "leather"),
			count: 1,
			components: {
				"minecraft:dyed_color": COLOR_MAP[randomColor],
			},
		};
	}

	const rawOpt = entry.options.length ? rngPick(rng, entry.options) : "";
	const tokens = rawOpt.split(/\s+/).filter(Boolean);
	const resolved = tokens.map((tok) => {
		if (tok.includes(",")) {
			const choices = tok.split(",");
			return rngPick(rng, choices).trim();
		}
		return tok;
	});

	let material: string | null = null;
	let color: string | null = null;
	let trimPattern: string | null = null;
	let trimMaterial: string | null = null;

	// Parse basic tokens
	for (const token of resolved) {
		if (/^[A-Za-z]:/.test(token)) continue;
		const detected = detectToken(token);
		if (!material && detected.mat) material = detected.mat;
		if (!color && detected.color) color = detected.color;

		// Check if token is a trim pattern
		const tokenLower = token.toLowerCase();
		for (const pattern of TRIM_PATTERNS) {
			const patternName = pattern.replace("minecraft:", "");
			if (tokenLower === patternName) {
				trimPattern = pattern;
				break;
			}
		}
	}

	// If no trim pattern found in tokens, look in entry name/key
	if (!trimPattern) {
		for (const pattern of TRIM_PATTERNS) {
			const patternName = pattern.replace("minecraft:", "");
			if (
				entry.name.toLowerCase().includes(patternName) ||
				entry.key.toLowerCase().includes(patternName)
			) {
				trimPattern = pattern;
				break;
			}
		}
	}

	// Look for trim material in tokens
	for (const token of resolved) {
		const normalizedToken = token.toLowerCase();
		for (const material of TRIM_MATERIALS) {
			if (normalizedToken.includes(material.replace("minecraft:", ""))) {
				trimMaterial = material;
				break;
			}
		}
		if (trimMaterial) break;
	}

	// Process templates
	for (const [_templateKey, values] of Object.entries(entry.templates)) {
		const chosen = matchVars[entry.key];
		if (chosen) {
			if (!material && MATERIAL_MAP[chosen]) material = chosen;
			if (!color && COLOR_MAP[chosen]) color = chosen;
		} else if (values.length > 0) {
			const pick = rngPick(rng, values);
			if (!material && MATERIAL_MAP[pick]) material = pick;
			if (!color && COLOR_MAP[pick]) color = pick;
		}
	}

	// Build components
	const components: NonNullable<ArmorComponent["components"]> = {};

	// Default to leather if no valid material specified
	if (!material || !MATERIAL_MAP[material]) {
		material = "leather";
	}

	// If it's leather, ensure color
	if (material === "leather") {
		let finalColor: number;
		if (color && COLOR_MAP[color] !== undefined) {
			finalColor = COLOR_MAP[color] !== undefined ? COLOR_MAP[color] : 0xff00ff;
		} else {
			// Pick a random color, but ensure it's not undefined
			const validColors = [
				...Object.entries(COLOR_MAP).map(([_, val]) => val),
				...COLORS,
			];
			finalColor = rngPick(rng, validColors);
		}
		components["minecraft:dyed_color"] = finalColor;
	}

	// Add trim if specified
	if (trimPattern && trimMaterial) {
		components["minecraft:trim"] = {
			pattern: trimPattern,
			material: trimMaterial,
		};
	}

	return {
		id: itemIdFor(piece, material),
		count: 1,
		components: Object.keys(components).length > 0 ? components : undefined,
	};
}

export function pickOutfit(
	sections: Record<string, Entry[]>,
	rng: RNG,
): OutfitResult {
	// 80% chance for table entries, 20% for random leather
	const useTable = rng() < 0.8;

	// Step 1: Pick a chestplate first (with chance)
	const chestEntry =
		useTable && sections.chestplate?.length
			? rngPick(rng, sections.chestplate)
			: null;

	// Step 2: Determine if we use table for pants (separate 80/20 roll)
	const useTablePants = rng() < 0.2;
	let pantsEntry = null;
	let bootsEntry = null;

	// Step 3: If chest has a match key, try to find matching pieces
	// Only apply if we're using table entries
	const matchKey = useTable && chestEntry ? getMatchKey(chestEntry) : undefined;

	if (matchKey !== undefined) {
		// Find all pieces that share this match key
		const matchedPieces = findMatchingEntries(sections, matchKey);

		// Use matching pants if available
		if (matchedPieces.pants?.length > 0) {
			pantsEntry = rngPick(rng, matchedPieces.pants);
		}

		// Use matching boots if available
		if (matchedPieces.boots?.length > 0) {
			bootsEntry = rngPick(rng, matchedPieces.boots);
		}
	}

	// Fill in pants - respect the table chance unless we have a match
	if (!pantsEntry && useTablePants && sections.pants?.length) {
		pantsEntry = rngPick(rng, sections.pants);
	}

	// Always try to get boots from table if available
	if (!bootsEntry && sections.boots?.length) {
		bootsEntry = rngPick(rng, sections.boots);
	}

	// Match variables from valid entries only
	const entries = [chestEntry, pantsEntry, bootsEntry].filter(Boolean);
	const matchVars = unifyMatchVars(entries);

	// Build equipment ensuring valid colors for leather
	const equipment = {
		head: { id: "minecraft:air", count: 0 },
		chest: buildArmorPiece(chestEntry, "chest", rng, matchVars),
		legs: buildArmorPiece(pantsEntry, "legs", rng, matchVars),
		feet: sections.boots?.length
			? buildArmorPiece(bootsEntry, "feet", rng, matchVars)
			: { id: "minecraft:air", count: 0 },
	};

	// Log the table contents and generation result
	if (typeof window !== "undefined") {
		console.log("\nGeneration Settings:");
		console.log("Using Table (Chest):", useTable);
		console.log("Using Table (Pants):", useTablePants);
		console.log("\nClothing Table:", sections);
		console.log("\nSelected Entries:");
		console.log("Chest:", chestEntry || "Random Leather");
		console.log("Pants:", pantsEntry || "Random Leather");
		console.log("Boots:", bootsEntry);
		console.log("\nGenerated Equipment:");
		console.log(JSON.stringify(equipment, null, 2));
	}

	return { equipment, matchVars };
}

function unifyMatchVars(entries: Entry[]): Record<string, string> {
	const result: Record<string, string> = {};

	for (const entry of entries) {
		// Get match key from entry if it exists
		const matchKey = getMatchKey(entry);
		if (matchKey) {
			result[`match_${matchKey}`] = matchKey.toString();
		}

		// Include any template variables
		for (const [key, values] of Object.entries(entry.templates)) {
			if (values.length > 0) {
				result[key] = values[0]; // Use first value as default
			}
		}
	}

	return result;
}
