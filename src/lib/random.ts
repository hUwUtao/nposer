import type { RNG } from "./types";

export function mulberry32(seed: number): RNG {
	let t = seed >>> 0;
	return () => {
		t += 0x6d2b79f5;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export const rngBetween = (rng: RNG, a: number, b: number) =>
	a + (b - a) * rng();
export const rngPick = <T>(rng: RNG, arr: T[]) =>
	arr[Math.floor(rng() * arr.length)];
