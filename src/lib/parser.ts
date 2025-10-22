import { COLOR_MAP, MATERIAL_MAP } from "./constants";
import type { Entry, Sections } from "./types";

export type { Entry };

export function parseOutfitFile(text: string): Sections {
	const sections: Sections = {};
	let currentSection: string | null = null;

	for (const raw of text.split(/\r?\n/)) {
		// Remove comments and trim
		const line = raw.replace(/#.*/, "").replace(/;.*/, "").trim();
		if (!line) continue;

		// Check for section header
		const headerMatch = line.match(/^(?:---\s*)?(\w+)(?:\s*---)?$/i);
		if (headerMatch) {
			currentSection = headerMatch[1].toLowerCase();
			sections[currentSection] = [];
			continue;
		}

		if (!currentSection) continue;

		// Parse entry line
		const lineMatch = line.match(/^(\S+)\s+(.+)$/);
		if (!lineMatch) continue;

		const [, key, rest] = lineMatch;
		const nameMatch = rest.trim().match(/^(\S+)\s*(.*)$/);
		const name = nameMatch ? nameMatch[1] : rest.trim();
		const materialsRaw = nameMatch ? nameMatch[2].trim() : "";

		// Parse options and templates
		const options = materialsRaw
			? materialsRaw
					.split(/\s*,\s*/)
					.map((s) => s.trim())
					.filter(Boolean)
			: [""];

		const templates: Record<string, string[]> = {};
		const templateRegex = /([A-Za-z]):([^\s,;]+)/g;
		let templateMatch: RegExpExecArray;

		while ((templateMatch = templateRegex.exec(materialsRaw)) !== null) {
			const [, key, values] = templateMatch;
			templates[key] = values
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean);
		}

		sections[currentSection].push({
			key,
			name,
			raw: line,
			options,
			templates,
		});
	}

	return sections;
}

export function detectToken(token: string): { mat?: string; color?: string } {
	const normalized = token.toLowerCase().replace(/[^a-z0-9]/g, "");

	if (MATERIAL_MAP[normalized]) {
		return { mat: normalized };
	}

	if (normalized in COLOR_MAP) {
		return { color: normalized };
	}

	return {};
}
