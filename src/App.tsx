import { type FC, useEffect, useMemo, useState } from "react";
import { pickOutfit } from "./lib/outfitter";
import { parseOutfitFile } from "./lib/parser";
import {
	addPose,
	baseIdle,
	holdDown,
	holdUpright,
	norm360,
	overridePose,
	point,
	sit,
	stareDown,
	stareUp,
	walking,
	wave,
} from "./lib/poses";
import { mulberry32, rngPick } from "./lib/random";
import { SKULLS } from "./lib/skull";

import DEFAULT_OUTFITS from "./assets/outfits.txt?raw";

const OUTFITS = parseOutfitFile(DEFAULT_OUTFITS);
if (typeof window !== "undefined") {
	console.log(DEFAULT_OUTFITS, OUTFITS);
}

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
	const [copyOnDone, setCopyOnDone] = useState(false);

	// Initialize with an outfit when component mounts
	useEffect(() => {
		pick();
		// biome-ignore lint/correctness/useExhaustiveDependencies: SSR Friendly
	}, [pick]); // Run once when component mounts

	const profile = useMemo(
		() => ({
			rng: mulberry32(seed),
			walking: {
				ampLeg: 42,
				ampArm: 48,
				rng: mulberry32(seed),
				armSwayMax: 15,
				legSwayMax: 5,
			},
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
				id: "player_head",
				count: 1,
				components: {
					profile: {
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

		setClothingNBT(
			`equipment:${JSON.stringify(
				{
					chest: o.equipment.chest,
					legs: o.equipment.legs,
					feet: o.equipment.feet,
					head: o.equipment.head,
				},
				null,
				2,
			)}`,
		);
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
		return `/summon armor_stand ~ ~ ~ {ShowArms:1b,NoBasePlate:1b,Rotation:[0.0f,0.0f],Pose:{Head:${pr(nbtPose.Head)},LeftArm:${pr(nbtPose.LeftArm)},RightArm:${pr(nbtPose.RightArm)},LeftLeg:${pr(nbtPose.LeftLeg)},RightLeg:${pr(nbtPose.RightLeg)}},equipment:${autoPick ? JSON.stringify(equipment).replace(/["=]/g, "") : "{}"}}`;
	}, [nbtPose, clothingNBT, autoPick]);

	// Copy to clipboard if copyOnDone is true
	useEffect(() => {
		if (copyOnDone && summon) {
			navigator.clipboard.writeText(summon).catch(() => {});
			setCopyOnDone(false); // Reset after copying
		}
	}, [copyOnDone, summon]);

	function regen(andCopy = false) {
		setCopyOnDone(andCopy); // Set whether to copy after generation
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
		<div className="p-5 max-w-7xl mx-auto bg-white rounded-lg">
			<div className="flex flex-wrap gap-3 items-center mb-4">
				<div className="flex items-center gap-2">
					<span className="text-gray-700">Seed:</span>
					<input
						type="number"
						onChange={(e) => setSeed(parseInt(e.target.value, 10))}
						value={seed}
						className="px-3 py-1 border rounded w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<label className="flex items-center gap-2">
					<span className="text-gray-700">Intensity:</span>
					<input
						type="range"
						min={0}
						max={1}
						step={0.01}
						value={t}
						onChange={(e) => setT(Number(e.target.value))}
						className="w-32"
					/>
				</label>

				<div className="flex gap-4">
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={autoPick}
							onChange={(e) => setAutoPick(e.target.checked)}
							className="w-4 h-4 rounded text-blue-500 focus:ring-2 focus:ring-blue-500"
						/>
						<span className="text-gray-700">Auto-outfit</span>
					</label>

					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={autoSkull}
							onChange={(e) => setAutoSkull(e.target.checked)}
							className="w-4 h-4 rounded text-blue-500 focus:ring-2 focus:ring-blue-500"
						/>
						<span className="text-gray-700">Random skull</span>
					</label>
				</div>

				<select
					value={action}
					onChange={(e) => setAction(e.target.value as any)}
					className="px-3 py-2 border rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					<option value="walking">walking</option>
					<option value="sit">sit</option>
					<option value="none">none</option>
				</select>

				<select
					value={overrideSel}
					onChange={(e) => setOverrideSel(e.target.value as any)}
					className="px-3 py-2 border rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					<option value="none">none</option>
					<option value="stare-down">stare-down</option>
					<option value="stare-up">stare-up</option>
					<option value="hold-up">hold upright</option>
					<option value="hold-down">hold down</option>
					<option value="wave">wave</option>
					<option value="point">point</option>
				</select>

				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => regen(false)}
						className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-200"
					>
						Regen
					</button>
					<button
						type="button"
						onClick={() => regen(true)}
						className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition duration-200"
					>
						Regen & Copy
					</button>
					<button
						type="button"
						onClick={copy}
						className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition duration-200"
					>
						Copy
					</button>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-4">
					<div>
						<div className="text-gray-700 font-medium mb-2">Signed pose</div>
						<pre className="font-mono text-xs bg-gray-50 p-4 rounded shadow-inner overflow-auto max-h-64">
							{JSON.stringify(signedPose, null, 2)}
						</pre>
					</div>
					<div>
						<div className="text-gray-700 font-medium mb-2">NBT pose</div>
						<pre className="font-mono text-xs bg-gray-50 p-4 rounded shadow-inner overflow-auto max-h-64">
							{JSON.stringify(nbtPose, null, 2)}
						</pre>
					</div>
				</div>
				<div className="space-y-4">
					<div>
						<div className="text-gray-700 font-medium mb-2">Command</div>
						<textarea
							readOnly
							value={summon}
							className="w-full h-32 font-mono text-sm p-4 bg-gray-50 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
						/>
					</div>
					<div>
						<div className="text-gray-700 font-medium mb-2">Clothing NBT</div>
						<pre className="font-mono text-xs bg-gray-50 p-4 rounded shadow-inner overflow-auto max-h-64 break-words">
							{clothingNBT || "none"}
						</pre>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ArmorStandPoseUI;
