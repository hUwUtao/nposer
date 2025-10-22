const SKULLFILE = await fetch(
	new URL("../assets/skulls.txt", import.meta.url),
).then((res) => res.text());
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
