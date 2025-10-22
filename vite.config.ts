/// <reference types="vitest" />
import { defineConfig } from "vite";
// import react from '@vitejs/plugin-react'
import react from "@preact/preset-vite";
import UnoCSS from 'unocss/vite';

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react({
			prerender: { enabled: true },
		}),
		UnoCSS(),
	],
	test: {
		// environment: 'jsdom',
		globals: true,
		setupFiles: "./src/tests/setup.ts",
	},
});
