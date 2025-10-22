import { type FC, useMemo, useState, useEffect } from "react";
import { mulberry32, rngPick } from "./lib/random";
import { parseOutfitFile, type Entry } from "./lib/parser";
import { pickOutfit } from "./lib/outfitter";
import {
	norm360,
	baseIdle,
	walking,
	sit,
	stareDown,
	stareUp,
	holdUpright,
	holdDown,
	wave,
	point,
	addPose,
	overridePose,
} from "./lib/poses";
import type { RNG } from "./lib/types";
import { SKULLS } from "./lib/skull";

import { MATERIAL_MAP, COLOR_MAP } from "./lib/constants";

function detectToken(tok: string) {
	const low = tok.toLowerCase().replace(/[^a-z0-9]/g, "");
	if (MATERIAL_MAP[low]) return { mat: low } as any;
	if (COLOR_MAP[low] !== undefined) return { color: low } as any;
	return {} as any;
}

function itemIdFor(piece: "chest" | "legs" | "boots", mat?: string) {
	const base = MATERIAL_MAP[mat || "iron"] || "iron";
	const suffix =
		piece === "chest" ? "chestplate" : piece === "legs" ? "leggings" : "boots";
	if (base === "leather") return `minecraft:leather_${suffix}`;
	if (base === "chainmail") return `minecraft:chainmail_${suffix}`;
	return `minecraft:${base}_${suffix}`;
}
function armorNBT(
	slot: "head" | "chest" | "legs" | "boots",
	id: string,
	count = 1,
	components: Record<string, any> = {},
) {
	return {
		[slot]: {
			id,
			count,
			components,
		},
	};
}

// Trim patterns and materials
const TRIM_PATTERNS = [
	"minecraft:bolt",
	"minecraft:rib",
	"minecraft:coast",
	"minecraft:wild",
	"minecraft:ward",
	"minecraft:vex",
	"minecraft:snout",
	"minecraft:eye",
];
const TRIM_MATERIALS = [
	"minecraft:iron",
	"minecraft:gold",
	"minecraft:diamond",
	"minecraft:netherite",
	"minecraft:redstone",
	"minecraft:copper",
	"minecraft:emerald",
	"minecraft:lapis",
	"minecraft:amethyst",
	"minecraft:quartz",
];

function _buildItem(
	entry: Entry,
	piece: "chest" | "legs" | "boots",
	rng: RNG,
	matchVars: Record<string, string>,
) {
	const rawOpt = entry.options.length ? rngPick(rng, entry.options) : "";
	const tokens = rawOpt.split(/\s+/).filter(Boolean);
	const resolved = tokens.map((tok) => {
		if (tok.includes(",")) {
			const choices = tok.split(",");
			return rngPick(rng, choices).trim();
		}
		return tok;
	});

	let mat: string | null = null;
	let color: string | null = null;
	let trimPattern = null;
	let trimMaterial = null;

	// Parse tokens for material and color
	for (const tok of resolved) {
		if (/^[A-Za-z]:/.test(tok)) continue;
		const d = detectToken(tok) as any;
		if (!mat && d.mat) mat = d.mat;
		if (!color && d.color) color = d.color;
	}

	// For items from the dataset table:
	// Look for trim pattern in entry name/key
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

	// Look for trim material in options
	for (const material of TRIM_MATERIALS) {
		const matName = material.replace("minecraft:", "");
		if (resolved.some((tok) => tok.toLowerCase().includes(matName))) {
			trimMaterial = material;
			break;
		}
	}

	// Process templates and variables
	for (const varName of Object.keys(entry.templates)) {
		const vals = entry.templates[varName];
		const chosen = matchVars[entry.key];
		if (chosen) {
			if (!mat && MATERIAL_MAP[chosen]) mat = chosen;
			if (!color && COLOR_MAP[chosen] !== undefined) color = chosen;
		} else if (vals?.length) {
			const pick = rngPick(rng, vals);
			if (!mat && MATERIAL_MAP[pick]) mat = pick;
			if (!color && COLOR_MAP[pick] !== undefined) color = pick;
		}
	}

	const components: Record<string, any> = {};

	// If this is a table entry and has trim specs, add trim
	if (trimPattern && trimMaterial) {
		components["minecraft:trim"] = {
			material: trimMaterial,
			pattern: trimPattern,
		};
	}

	// Determine final material and color
	const optStr = rawOpt.toLowerCase();
	const isLeatherOrDye =
		!mat && (optStr.includes("alldye") || optStr.includes("dye"));

	if (isLeatherOrDye || mat === "leather" || !mat) {
		// For leather items (either explicit or default), MUST have color
		mat = "leather";
		const finalColor = color
			? COLOR_MAP[color]
			: COLOR_MAP[rngPick(rng, Object.keys(COLOR_MAP))];
		components["minecraft:dyed_color"] = finalColor;
	}

	const id = itemIdFor(piece, mat);
	return armorNBT(piece, id, 1, components);
}

const DEFAULT_OUTFITS = await fetch(
	new URL("./assets/outfits.txt", import.meta.url),
).then((res) => res.text());
const OUTFITS = parseOutfitFile(DEFAULT_OUTFITS);
console.log(DEFAULT_OUTFITS, OUTFITS);

// UI component
export const ArmorStandPoseUI: FC = () => {
	const [seed, setSeed] = useState<number>();
	useEffect(() => {
		const saved = localStorage.getItem("armorstand_seed");
		setSeed(
			saved ? parseInt(saved, 10) : Math.floor(Math.random() * 2 ** 32) >>> 0,
		);
	}, []);
	const [t, setT] = useState(0.25);
	const [action, setAction] = useState<"walking" | "sit" | "none">("walking");
	const [overrideSel, setOverrideSel] = useState<
		| "none"
		| "stare-down"
		| "stare-up"
		| "hold-up"
		| "hold-down"
		| "wave"
		| "point"
	>("none");
	const [clothingNBT, setClothingNBT] = useState("");
	const [autoPick, setAutoPick] = useState(true); // Set auto-pick to true by default
	const [autoSkull, setAutoSkull] = useState(true); // Set auto-skull to true by default

	// Initialize with an outfit when component mounts
	useEffect(() => {
		pick();
		// biome-ignore lint/correctness/useExhaustiveDependencies: SSR Friendly
	}, [pick]); // Run once when component mounts

	const profile = useMemo(
		() => ({
			rng: mulberry32(seed),
			walking: { ampLeg: 42, ampArm: 48, speed: 1 },
			sit: { swayY: 8 },
		}),
		[seed],
	);

	function pick(seedFor?: number) {
		const s = seedFor ?? seed;
		const rng = mulberry32(s);
		const o = pickOutfit(OUTFITS, rng);

		// If auto-skull is enabled, add a random skull
		if (autoSkull && SKULLS.length > 0) {
			const skullTexture = rngPick(rng, SKULLS);
			o.equipment.head = {
				id: "minecraft:player_head",
				count: 1,
				components: {
					"minecraft:profile": {
						properties: [
							{
								name: "textures",
								value: skullTexture,
							},
						],
					},
				},
			};
		}

		setClothingNBT(`equipment:${JSON.stringify(o.equipment, null, 2)}`);
	}

	const signedPose = useMemo(() => {
		const rng = profile.rng;
		let pose = baseIdle(rng);

		// Apply base actions
		if (action === "walking") pose = addPose(pose, walking(t, profile.walking));
		if (action === "sit")
			pose = addPose(pose, sit(t, profile.rng, profile.sit));

		// Apply overrides
		switch (overrideSel) {
			case "stare-down":
				pose = overridePose(pose, stareDown(profile.rng));
				break;
			case "stare-up":
				pose = overridePose(pose, stareUp(profile.rng));
				break;
			case "hold-up":
				pose = overridePose(pose, holdUpright());
				break;
			case "hold-down":
				pose = overridePose(pose, holdDown());
				break;
			case "wave":
				pose = overridePose(pose, wave());
				break;
			case "point":
				pose = overridePose(pose, point());
				break;
		}

		return pose;
	}, [t, action, overrideSel, profile]);

	const nbtPose = useMemo(
		() => ({
			Head: [
				norm360(signedPose.Head.x),
				norm360(signedPose.Head.y),
				norm360(signedPose.Head.z),
			],
			LeftArm: [
				norm360(signedPose.LeftArm.x),
				norm360(signedPose.LeftArm.y),
				norm360(signedPose.LeftArm.z),
			],
			RightArm: [
				norm360(signedPose.RightArm.x),
				norm360(signedPose.RightArm.y),
				norm360(signedPose.RightArm.z),
			],
			LeftLeg: [
				norm360(signedPose.LeftLeg.x),
				norm360(signedPose.LeftLeg.y),
				norm360(signedPose.LeftLeg.z),
			],
			RightLeg: [
				norm360(signedPose.RightLeg.x),
				norm360(signedPose.RightLeg.y),
				norm360(signedPose.RightLeg.z),
			],
		}),
		[signedPose],
	);
	const summon = useMemo(() => {
		const pr = (n: number[]) =>
			`[${n[0].toFixed(1)}f,${n[1].toFixed(1)}f,${n[2].toFixed(1)}f]`;
		let equipment = {};
		if (clothingNBT?.startsWith("equipment:")) {
			equipment = JSON.parse(clothingNBT.replace(/^equipment:/, ""));
		}
		return `/summon minecraft:armor_stand ~ ~ ~ {ShowArms:1b,NoBasePlate:1b,Rotation:[0.0f,0.0f],Pose:{Head:${pr(nbtPose.Head)},LeftArm:${pr(nbtPose.LeftArm)},RightArm:${pr(nbtPose.RightArm)},LeftLeg:${pr(nbtPose.LeftLeg)},RightLeg:${pr(nbtPose.RightLeg)}},equipment:${autoPick ? JSON.stringify(equipment) : "{}"}}`;
	}, [nbtPose, clothingNBT, autoPick]);

	function regen() {
		const newSeed = Math.floor(Math.random() * 2 ** 32) >>> 0;
		setSeed(newSeed);
		localStorage.setItem("armorstand_seed", newSeed.toString());
		// Always pick a new outfit when regenerating
		pick(newSeed);
	}
	function copy() {
		navigator.clipboard.writeText(summon).catch(() => {});
	}

	return (
		<div style={{ padding: 20, maxWidth: 1100, background: "#fff" }}>
			<div
				style={{
					display: "flex",
					gap: 12,
					alignItems: "center",
					flexWrap: "wrap",
				}}
			>
				<button type="button" onClick={regen}>
					Regen
				</button>
				<div>
					seed:{" "}
					<input
						type="number"
						onChange={(e) => setSeed(parseInt(e.target.value, 10))}
						value={seed}
					/>
				</div>
				<label>
					t (action intensity){" "}
					<input
						type="range"
						min={0}
						max={1}
						step={0.01}
						value={t}
						onChange={(e) => setT(Number(e.target.value))}
					/>
				</label>
				<label>
					<input
						type="checkbox"
						checked={autoPick}
						onChange={(e) => setAutoPick(e.target.checked)}
					/>{" "}
					auto-pick outfit on regen
				</label>
				<label>
					<input
						type="checkbox"
						checked={autoSkull}
						onChange={(e) => setAutoSkull(e.target.checked)}
					/>{" "}
					random skull
				</label>
				<select
					value={action}
					onChange={(e) => setAction(e.target.value as any)}
				>
					<option value="walking">walking</option>
					<option value="sit">sit</option>
					<option value="none">none</option>
				</select>
				<select
					value={overrideSel}
					onChange={(e) => setOverrideSel(e.target.value as any)}
				>
					<option value="none">none</option>
					<option value="stare-down">stare-down</option>
					<option value="stare-up">stare-up</option>
					<option value="hold-up">hold upright</option>
					<option value="hold-down">hold down</option>
					<option value="wave">wave</option>
					<option value="point">point</option>
				</select>
				{/* <button onClick={() => pick()}>Pick Outfit</button> */}
				<button type="button" onClick={copy}>
					Copy
				</button>
			</div>

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
					gap: 12,
					marginTop: 12,
				}}
			>
				<div>
					<div style={{ marginBottom: 8 }}>Signed pose</div>
					<pre style={{ fontFamily: "monospace", fontSize: 12 }}>
						{JSON.stringify(signedPose, null, 2)}
					</pre>
					<div style={{ marginTop: 8 }}>NBT pose</div>
					<pre style={{ fontFamily: "monospace", fontSize: 12 }}>
						{JSON.stringify(nbtPose, null, 2)}
					</pre>
				</div>
				<div>
					<div style={{ marginBottom: 8 }}>Command</div>
					<textarea
						readOnly
						value={summon}
						style={{ width: "100%", height: 120, fontFamily: "monospace" }}
					/>
					<div style={{ marginTop: 8 }}>Clothing NBT</div>
					<pre style={{ fontFamily: "monospace", fontSize: 12 }}>
						{clothingNBT || "none"}
					</pre>
				</div>
			</div>
		</div>
	);
};

export default ArmorStandPoseUI;
