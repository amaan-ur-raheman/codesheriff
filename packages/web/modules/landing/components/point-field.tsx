"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTheme } from "next-themes";
import { useCanRender3D } from "../lib/webgl";

/**
 * Editorial point field & node graph for the pipeline section: a sparse cloud of faint
 * ink nodes connected by hair-thin constellation lines, with brand accent dots
 * scattered through it. Follows Editorial Paper guidelines: quiet motion, no glow/bloom,
 * crisp hairline ink.
 *
 * Progressive enhancement: renders nothing when WebGL is unavailable or
 * reduced motion is preferred.
 */

/** Seeded PRNG (mulberry32) so the field is identical across remounts. */
function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const COUNT = 220;
const MAX_CONNECT_DIST = 2.4;

function PipelinePointField({ ink, brand }: { ink: string; brand: string }) {
	const pointsRef = useRef<THREE.Points>(null);
	const linesRef = useRef<THREE.LineSegments>(null);
	const groupRef = useRef<THREE.Group>(null);

	const pointer = useRef({ x: 0, y: 0 });
	const elapsed = useRef(0);

	const { pointsGeometry, linesGeometry } = useMemo(() => {
		const rnd = mulberry32(0xc05e);
		const positions = new Float32Array(COUNT * 3);
		const colors = new Float32Array(COUNT * 3);
		const inkColor = new THREE.Color(ink);
		const brandColor = new THREE.Color(brand);

		const coords: Array<[number, number, number]> = [];

		for (let i = 0; i < COUNT; i++) {
			const x = (rnd() - 0.5) * 16;
			const y = (rnd() - 0.5) * 10;
			const z = (rnd() - 0.5) * 6;

			positions[i * 3] = x;
			positions[i * 3 + 1] = y;
			positions[i * 3 + 2] = z;

			coords.push([x, y, z]);

			const isBrand = rnd() < 0.18;
			const c = isBrand ? brandColor : inkColor;
			colors[i * 3] = c.r;
			colors[i * 3 + 1] = c.g;
			colors[i * 3 + 2] = c.b;
		}

		// Calculate sparse hairline connections between nearby points
		const linePos: number[] = [];
		const lineColors: number[] = [];

		for (let i = 0; i < COUNT; i++) {
			for (let j = i + 1; j < COUNT; j++) {
				const dx = coords[i][0] - coords[j][0];
				const dy = coords[i][1] - coords[j][1];
				const dz = coords[i][2] - coords[j][2];
				const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

				if (dist < MAX_CONNECT_DIST) {
					linePos.push(...coords[i], ...coords[j]);

					// Use faint ink color for interconnecting hairlines
					lineColors.push(
						inkColor.r, inkColor.g, inkColor.b,
						inkColor.r, inkColor.g, inkColor.b,
					);
				}
			}
		}

		const pGeo = new THREE.BufferGeometry();
		pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		pGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

		const lGeo = new THREE.BufferGeometry();
		lGeo.setAttribute(
			"position",
			new THREE.BufferAttribute(new Float32Array(linePos), 3),
		);
		lGeo.setAttribute(
			"color",
			new THREE.BufferAttribute(new Float32Array(lineColors), 3),
		);

		return { pointsGeometry: pGeo, linesGeometry: lGeo };
	}, [ink, brand]);

	useEffect(() => {
		return () => {
			pointsGeometry.dispose();
			linesGeometry.dispose();
		};
	}, [pointsGeometry, linesGeometry]);

	// Mouse parallax tracking
	useEffect(() => {
		const onMove = (e: PointerEvent) => {
			pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
			pointer.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
		};
		window.addEventListener("pointermove", onMove, { passive: true });
		return () => window.removeEventListener("pointermove", onMove);
	}, []);

	useFrame((_, delta) => {
		if (!groupRef.current) return;
		elapsed.current += delta;

		// Slow continuous rotation & gentle drift
		groupRef.current.rotation.y += delta * 0.02;
		groupRef.current.position.y = Math.sin(elapsed.current * 0.25) * 0.2;

		// Quiet mouse parallax
		const targetX = pointer.current.y * 0.04;
		const targetY = pointer.current.x * 0.05;
		groupRef.current.rotation.x +=
			(targetX - groupRef.current.rotation.x) * Math.min(delta * 2, 1);
		groupRef.current.rotation.z +=
			(targetY - groupRef.current.rotation.z) * Math.min(delta * 2, 1);
	});

	return (
		<group ref={groupRef}>
			<points ref={pointsRef} geometry={pointsGeometry}>
				<pointsMaterial
					size={0.05}
					sizeAttenuation
					vertexColors
					transparent
					opacity={0.65}
					depthWrite={false}
				/>
			</points>
			<lineSegments ref={linesRef} geometry={linesGeometry}>
				<lineBasicMaterial
					vertexColors
					transparent
					opacity={0.16}
					depthWrite={false}
				/>
			</lineSegments>
		</group>
	);
}

export default function PointField() {
	const canRender = useCanRender3D();
	// resolvedTheme is kept only to satisfy the linter — the actual token
	// read happens inside the MutationObserver so the DOM class is already
	// applied before getComputedStyle is called.
	useTheme();
	const [ink, setInk] = useState("#231d15");
	const [brand, setBrand] = useState("#fc4c02");

	useEffect(() => {
		const readTokens = () => {
			const style = getComputedStyle(document.documentElement);
			const fg = style.getPropertyValue("--foreground").trim();
			const br = style.getPropertyValue("--brand").trim();
			if (fg) setInk(fg);
			if (br) setBrand(br);
		};

		// Read immediately for the initial render
		readTokens();

		// Re-read only after the class attribute on <html> has actually mutated
		// (next-themes sets resolvedTheme before the class is applied, so reading
		// inside a resolvedTheme effect gets stale CSS custom property values)
		const mo = new MutationObserver((mutations) => {
			if (mutations.some((m) => m.attributeName === "class")) {
				readTokens();
			}
		});
		mo.observe(document.documentElement, { attributes: true });
		return () => mo.disconnect();
	}, []);

	if (!canRender) return null;

	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
		>
			<Canvas
				dpr={[1, 1.5]}
				gl={{ antialias: false, alpha: true }}
				camera={{ position: [0, 0, 9], fov: 50 }}
				className="!absolute inset-0"
			>
				<PipelinePointField ink={ink} brand={brand} />
			</Canvas>
		</div>
	);
}

