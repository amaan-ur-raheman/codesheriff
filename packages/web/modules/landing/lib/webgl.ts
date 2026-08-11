"use client";

import { useState } from "react";
import { useReducedMotion } from "motion/react";

/**
 * WebGL capability check for the landing's optional 3D surfaces.
 *
 * The hero wireframe and pipeline point field are progressive enhancement:
 * if WebGL is unavailable (old GPU, headless, aggressive privacy settings)
 * the page must render the exact same static content, so every 3D surface
 * checks this before mounting a <Canvas>.
 */
export function supportsWebGL(): boolean {
	if (typeof window === "undefined") return false;

	try {
		const canvas = document.createElement("canvas");
		const gl =
			canvas.getContext("webgl2") || canvas.getContext("webgl");
		if (!gl) return false;
		gl.getExtension("WEBGL_lose_context")?.loseContext();
		return true;
	} catch {
		return false;
	}
}

/**
 * Shared gate for every landing 3D surface: render only when WebGL exists
 * AND the user has not asked for reduced motion. The hook value lags the
 * first render, so a synchronous matchMedia check seeds the initial state
 * (no flash of a 3D scene before useReducedMotion reports).
 */
export function useCanRender3D(): boolean {
	const [syncReduced] = useState(
		() =>
			typeof window !== "undefined" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches,
	);
	const [webgl] = useState(() => supportsWebGL());
	const reduced = useReducedMotion();
	return !(reduced ?? syncReduced) && webgl;
}
