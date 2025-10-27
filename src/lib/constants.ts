// Constants and mappings for armor generation
export const MATERIAL_MAP: Record<string, string> = {
	netherite: "netherite",
	diamond: "diamond",
	iron: "iron",
	gold: "golden", // Changed from 'golden' to match actual item IDs
	leather: "leather",
	chain: "chainmail",
};

export const COLOR_MAP: Record<string, number> = {
	white: 0xffffff,
	black: 0x1a1a1a, // Adjusted to be slightly off-black for visibility
	red: 0xff0000,
	cyan: 0x00ffff,
	purple: 0x800080,
	lime: 0x00ff00,
} as const;

export const TRIM_PATTERNS = [
	"bolt",
	"rib",
	"coast",
	"wild",
	"ward",
	"vex",
	"snout",
	"eye",
];

export const TRIM_MATERIALS = [
	"iron",
	"gold",
	"diamond",
	"netherite",
	"redstone",
	"copper",
	"emerald",
	"lapis",
	"amethyst",
	"quartz",
];

export const DEFAULT_MATERIALS = [
	"netherite",
	"diamond",
	"iron",
	"gold",
	"leather",
];
