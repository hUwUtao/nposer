import { rngBetween } from "./random";
import type { Pose, RNG } from "./types";

export const norm360 = (d: number) => ((d % 360) + 360) % 360;
export const mirror = (d: number) => -d;

export function emptyPose(): Pose {
	return {
		Head: { x: 0, y: 0, z: 0 },
		LeftArm: { x: 0, y: 0, z: 0 },
		RightArm: { x: 0, y: 0, z: 0 },
		LeftLeg: { x: 0, y: 0, z: 0 },
		RightLeg: { x: 0, y: 0, z: 0 },
	};
}

export function clonePose(pose: Pose): Pose {
	return {
		Head: { ...pose.Head },
		LeftArm: { ...pose.LeftArm },
		RightArm: { ...pose.RightArm },
		LeftLeg: { ...pose.LeftLeg },
		RightLeg: { ...pose.RightLeg },
	};
}

export function addPose(base: Pose, delta: Partial<Pose>): Pose {
	const result = clonePose(base);

	for (const key of [
		"Head",
		"LeftArm",
		"RightArm",
		"LeftLeg",
		"RightLeg",
	] as const) {
		if (delta[key]) {
			result[key].x += delta[key]?.x ?? 0;
			result[key].y += delta[key]?.y ?? 0;
			result[key].z += delta[key]?.z ?? 0;
		}
	}

	return result;
}

export function overridePose(base: Pose, override: Partial<Pose>): Pose {
	const result = clonePose(base);

	for (const key of [
		"Head",
		"LeftArm",
		"RightArm",
		"LeftLeg",
		"RightLeg",
	] as const) {
		if (override[key]) {
			result[key].x = override[key]?.x ?? result[key].x;
			result[key].y = override[key]?.y ?? result[key].y;
			result[key].z = override[key]?.z ?? result[key].z;
		}
	}

	return result;
}

export function baseIdle(rng: RNG): Pose {
	const pose = emptyPose();

	for (const key of ["LeftArm", "RightArm", "LeftLeg", "RightLeg"] as const) {
		pose[key].x = rngBetween(rng, -5, 5);
		pose[key].y = rngBetween(rng, -5, 5);
		pose[key].z = rngBetween(rng, -5, 5);
	}

	return pose;
}

interface WalkingOptions {
	ampLeg?: number;
	ampArm?: number;
	speed?: number;
	rng?: RNG;
	armSwayMax?: number; // Max arm sway
	legSwayMax?: number; // Max leg sway
}

export function walking(
	t: number,
	options: WalkingOptions = {},
): Partial<Pose> {
	const {
		ampLeg = 40,
		ampArm = 45,
		speed = 1,
		rng = Math.random,
		armSwayMax = 15,
		legSwayMax = 5,
	} = options;

	// Convert 10 degrees to radians for minimum phase
	const MIN_PHASE = (10 * Math.PI) / 180; // 10 degrees in radians

	// Generate a random initial phase for left leg with minimum range
	const basePhase = rngBetween(rng, MIN_PHASE, Math.PI * 2 - MIN_PHASE);
	const w = 2 * Math.PI * speed;

	// Left leg is our primary constraint - everything else derives from this
	const leftLegX = ampLeg * Math.sin(w * t + basePhase);
	const leftLegY = legSwayMax * Math.sin(2 * w * t + basePhase); // Double frequency for natural sway

	// Mirror the legs exactly
	const rightLegX = mirror(leftLegX);
	const rightLegY = mirror(leftLegY);

	// Arms mirror their corresponding legs but with adjusted amplitude and phase offset
	const armFactor = ampArm / Math.max(1, ampLeg);
	const leftArmX = mirror(leftLegX) * armFactor;
	const rightArmX = mirror(rightLegX) * armFactor;

	// Arm sway follows leg motion but with their own amplitude
	const leftArmZ = armSwayMax * Math.sin(2 * w * t + basePhase + Math.PI / 2);
	const rightArmZ = mirror(leftArmZ);

	return {
		LeftLeg: {
			x: leftLegX,
			y: leftLegY,
			z: 0,
		},
		RightLeg: {
			x: rightLegX,
			y: rightLegY,
			z: 0,
		},
		LeftArm: {
			x: leftArmX,
			y: 0,
			z: leftArmZ,
		},
		RightArm: {
			x: rightArmX,
			y: 0,
			z: rightArmZ,
		},
	};
}

interface SitOptions {
	legXMin?: number;
	legXMax?: number;
	swayY?: number;
	speed?: number;
}

export function sit(
	t: number,
	rng: RNG,
	options: SitOptions = {},
): Partial<Pose> {
	const { legXMin = 270, legXMax = 360, swayY = 8, speed = 0.5 } = options;

	const legX = rngBetween(rng, legXMin, legXMax);
	const signed = legX >= 180 ? legX - 360 : legX;
	const s = Math.sin(2 * Math.PI * speed * t);
	const swayLeft = swayY * s;

	return {
		LeftLeg: { x: signed, y: swayLeft, z: 0 },
		RightLeg: { x: signed, y: mirror(swayLeft), z: 0 },
	};
}

export function stareDown(rng: RNG): Partial<Pose> {
	return {
		Head: { x: rngBetween(rng, 0, 12), y: 0, z: 0 },
	};
}

export function stareUp(rng: RNG): Partial<Pose> {
	const v = rngBetween(rng, 270, 360);
	const signed = v >= 180 ? v - 360 : v;

	return {
		Head: { x: signed, y: 0, z: 0 },
	};
}

export function holdUpright(): Partial<Pose> {
	return {
		LeftArm: { x: 274, y: 21, z: 0 },
		RightArm: { x: 277, y: 334, z: 0 },
	};
}

export function holdDown(): Partial<Pose> {
	return {
		LeftArm: { x: 305, y: 21, z: 0 },
		RightArm: { x: 305, y: 334, z: 0 },
	};
}

export function wave(): Partial<Pose> {
	return {
		LeftArm: { x: 0, y: 0, z: 210 },
	};
}

export function point(): Partial<Pose> {
	return {
		RightArm: { x: 270, y: 0, z: 0 },
	};
}
