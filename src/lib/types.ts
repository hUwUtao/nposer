// Core types for the outfit parser
export type RNG = () => number;

export type Vec3 = { x: number; y: number; z: number };

export type Pose = {
	Head: Vec3;
	LeftArm: Vec3;
	RightArm: Vec3;
	LeftLeg: Vec3;
	RightLeg: Vec3;
};

export type Entry = {
	key: string;
	name: string;
	raw: string;
	options: string[];
	templates: Record<string, string[]>;
};

export type Sections = Record<string, Entry[]>;

export type ArmorComponent = {
	id: string;
	count: number;
	components?: {
		dyed_color?: number;
		trim?: {
			material: string;
			pattern: string;
		};
		profile?: any;
	};
};

export type Equipment = {
	head?: ArmorComponent;
	chest?: ArmorComponent;
	legs?: ArmorComponent;
	feet?: ArmorComponent;
};

export type OutfitResult = {
	equipment: Equipment;
	matchVars: Record<string, string>;
};
