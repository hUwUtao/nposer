import { describe, expect, it } from "vitest";
import { pickOutfit } from "../lib/outfitter";
import { parseOutfitFile } from "../lib/parser";
import { mulberry32 } from "../lib/random";

const TEST_DATASET = await (await import("../assets/outfits.txt")).default;

describe("Outfit Parser", () => {
	it("should parse dataset sections correctly", () => {
		const sections = parseOutfitFile(TEST_DATASET);

		expect(sections).toHaveProperty("chestplate");
		expect(sections).toHaveProperty("pants");
		expect(sections).toHaveProperty("boots");
	});

	it("should generate consistent outfits for same seed", () => {
		const sections = parseOutfitFile(TEST_DATASET);
		const seed = 12345;
		const rng = mulberry32(seed);

		const result1 = pickOutfit(sections, rng);
		const rng2 = mulberry32(seed);
		const result2 = pickOutfit(sections, rng2);

		expect(result1.equipment).toEqual(result2.equipment);
	});

	it("should generate different outfits for different seeds", () => {
		const sections = parseOutfitFile(TEST_DATASET);
		const rng1 = mulberry32(12345);
		const rng2 = mulberry32(54321);

		const result1 = pickOutfit(sections, rng1);
		const result2 = pickOutfit(sections, rng2);

		expect(result1.equipment).not.toEqual(result2.equipment);
	});

	it("should always include color for leather items", () => {
		const sections = parseOutfitFile(TEST_DATASET);
		const rng = mulberry32(12345);

		const result = pickOutfit(sections, rng);

		Object.values(result.equipment).forEach((piece) => {
			if (piece?.id.includes("leather")) {
				expect(piece.components).toHaveProperty("dyed_color");
				expect(typeof piece.components?.["dyed_color"]).toBe("number");
			}
		});
	});

	it("should only use boots from boots table", () => {
		const sections = parseOutfitFile(TEST_DATASET);
		const rng = mulberry32(12345);

		const result = pickOutfit(sections, rng);

		if (result.equipment.legs && result.equipment.legs.id !== "air") {
			const isFromTable = sections.boots.some((entry) => {
				const resolved = entry.options[0].split(/\s+/).some((token) => {
					return result.equipment.legs?.id.includes(token.toLowerCase());
				});
				return resolved;
			});

			expect(isFromTable).toBe(true);
		}
	});

	it("should maintain consistent template variables", () => {
		const sections = parseOutfitFile(TEST_DATASET);
		const rng = mulberry32(12345);

		const result = pickOutfit(sections, rng);

		// If pieces share a key, their template variables should match
		const pieces = Object.values(result.equipment).filter(
			(p) => p && p.id !== "air",
		);
		const matchVars = result.matchVars;

		for (const key of Object.keys(matchVars)) {
			const _value = matchVars[key];
			const piecesWithKey = pieces.filter((p) =>
				p?.id.includes(key.toLowerCase()),
			);
			piecesWithKey.forEach((piece) => {
				if (piece?.components?.["trim"]) {
					expect(piece?.components["trim"].pattern.toLowerCase()).toContain(
						key.toLowerCase(),
					);
				}
			});
		}
	});
});
