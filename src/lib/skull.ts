import SKULLFILE from "../assets/skulls.txt?raw";

export const SKULLS = SKULLFILE.split(/\r?\n/)
	.map((line) => line.trim())
	.filter(Boolean)
	.map((line) =>
		btoa(
			JSON.stringify({
				textures: {
					SKIN: {
						url: `https://textures.minecraft.net/texture/${line}`,
					},
				},
			}),
		),
	);
