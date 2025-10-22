import { describe, it, expect } from "vitest";
import { parseOutfitFile } from "../lib/parser";
import { pickOutfit } from "../lib/outfitter";
import { mulberry32 } from "../lib/random";

const TEST_DATASET = await (await import("../assets/outfits.txt")).default;

describe("Outfit Parser", () => {
	it("should ensure matching pieces stay together", () => {
		const sections = parseOutfitFile(TEST_DATASET);
		const rng = mulberry32(12345); // Fixed seed for deterministic test

		// Run multiple times to ensure consistency
		for (let i = 0; i < 10; i++) {
			const result = pickOutfit(sections, rng);

			// Check if chest piece has match number 1
			const chestMatch =
				result.equipment.chest.id.toLowerCase().includes("black") &&
				result.equipment.chest.components?.["minecraft:trim"]?.pattern ===
					"minecraft:bolt";

			if (chestMatch) {
				// If match 1 chest was picked, pants and boots should also be match 1
				expect(result.equipment.legs.id).toContain("minecraft");
				expect(
					result.equipment.legs.components?.["minecraft:trim"]?.pattern,
				).toBe("minecraft:raiser");
				expect(result.equipment.feet.id).toContain("minecraft");
				expect(
					result.equipment.feet.components?.["minecraft:trim"]?.pattern,
				).toBe("minecraft:snout");
			}

			// Check if chest piece has match number 2
			const chestMatch2 =
				result.equipment.chest.id.toLowerCase().includes("white") &&
				!result.equipment.chest.components?.["minecraft:trim"];

			if (chestMatch2) {
				// If match 2 chest was picked, pants and boots should also be match 2
				expect(result.equipment.legs.id).toContain("minecraft");
				expect(result.equipment.legs.id.toLowerCase()).toContain("black");
				expect(
					result.equipment.legs.components?.["minecraft:trim"],
				).toBeUndefined();
				expect(result.equipment.feet.id).toContain("minecraft");
				expect(result.equipment.feet.id.toLowerCase()).toContain("black");
				expect(
					result.equipment.feet.components?.["minecraft:trim"],
				).toBeUndefined();
			}
		}
	});

	it("should handle pieces without match keys correctly", () => {
		const sections = parseOutfitFile(TEST_DATASET);
		const rng = mulberry32(54321); // Different seed

		const result = pickOutfit(sections, rng);

		// All pieces should still be valid minecraft items
		expect(result.equipment.chest.id).toContain("minecraft:");
		expect(result.equipment.legs.id).toContain("minecraft:");
		expect(result.equipment.feet.id).toContain("minecraft:");
	});

	it("should validate material and color combinations", () => {
		const sections = parseOutfitFile(TEST_DATASET);
		const rng = mulberry32(98765);

		const result = pickOutfit(sections, rng);

		// Check leather pieces always have color
		Object.values(result.equipment).forEach((piece) => {
			if (piece.id.includes("leather")) {
				expect(piece.components).toBeDefined();
				expect(piece.components?.["minecraft:dyed_color"]).toBeDefined();
				expect(piece.components?.["minecraft:dyed_color"]).not.toBe(0);
			}
		});
	});
});
