"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useTheme } from "next-themes";
import { useCanRender3D } from "../lib/webgl";

// ─── Seeded deterministic pseudo-random ────────────────────────────────────
function mulberry32(seed: number) {
	let s = seed;
	return function () {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), s | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// ─── Types ─────────────────────────────────────────────────────────────────
interface NodeData {
	pos: THREE.Vector3;
	velocity: THREE.Vector3;
	weight: number; // 0–1, drives visual size
}

interface EdgeData {
	a: number;
	b: number;
}

interface Particle {
	edgeIndex: number;
	t: number;   // 0→1 progress along edge
	speed: number;
}

// ─── Build graph data (runs once per viewport size) ────────────────────────
// `spreadX` / `spreadY` are separate so the vertical layout can clamp to a
// square core on portrait canvases (see ReviewGraphScene).
function buildGraph(
	rand: () => number,
	spreadX: number,
	spreadY: number,
	nodeCount: number,
	maxEdgeDist: number,
): { nodes: NodeData[]; edges: EdgeData[] } {
	const nodes: NodeData[] = [];
	for (let i = 0; i < nodeCount; i++) {
		nodes.push({
			pos: new THREE.Vector3(
				(rand() - 0.5) * spreadX * 0.86,
				(rand() - 0.5) * spreadY * 0.82,
				(rand() - 0.5) * 1.4,
			),
			velocity: new THREE.Vector3(
				(rand() - 0.5) * 0.0038,
				(rand() - 0.5) * 0.0038,
				(rand() - 0.5) * 0.0018,
			),
			weight: 0.3 + rand() * 0.7,
		});
	}
	const edges: EdgeData[] = [];
	for (let i = 0; i < nodes.length; i++) {
		for (let j = i + 1; j < nodes.length; j++) {
			if (nodes[i].pos.distanceTo(nodes[j].pos) < maxEdgeDist) {
				edges.push({ a: i, b: j });
			}
		}
	}
	return { nodes, edges };
}

function buildParticles(
	rand: () => number,
	edges: EdgeData[],
	count: number,
): Particle[] {
	if (edges.length === 0) return [];
	return Array.from({ length: count }, () => ({
		edgeIndex: Math.floor(rand() * edges.length),
		t: rand(),
		speed: 0.003 + rand() * 0.007,
	}));
}

// ─── Main Three.js scene ───────────────────────────────────────────────────
function ReviewGraphScene({ ink, accent }: { ink: string; accent: string }) {
	const { viewport } = useThree();
	const w = viewport.width;
	const h = viewport.height;

	// Square composition core. R3F keeps the viewport HEIGHT fixed (~5 world
	// units at this camera) while width collapses on portrait canvases, so
	// deriving the vertical layout from `h` alone stretches the graph into a
	// tall streak on mobile (nodes span the whole hero, rings shrink to
	// min(w,h), the scan beam sweeps the full height). Every composition
	// dimension clamps to the min side so the graph reads as one balanced
	// cluster on any aspect ratio; the background grid stays full-bleed.
	const size = Math.min(w, h);

	const groupRef   = useRef<THREE.Group>(null);
	const scanRef    = useRef<THREE.Mesh>(null);
	const haloRef    = useRef<THREE.Mesh>(null);
	const gridRef    = useRef<THREE.LineSegments>(null);
	const nodesRef   = useRef<THREE.Points>(null);
	const edgesRef   = useRef<THREE.LineSegments>(null);
	const partRef    = useRef<THREE.Points>(null);

	const elapsed = useRef(0);
	const pointer = useRef({ x: 0, y: 0 });

	// Material refs — mutated on theme change without triggering a re-render
	const edgeMatRef     = useRef<THREE.LineBasicMaterial | null>(null);
	const nodeMatRef     = useRef<THREE.PointsMaterial | null>(null);
	const particleMatRef = useRef<THREE.PointsMaterial | null>(null);
	const scanMatRef     = useRef<THREE.MeshBasicMaterial | null>(null);
	const haloMatRef     = useRef<THREE.MeshBasicMaterial | null>(null);
	const gridMatRef     = useRef<THREE.LineBasicMaterial | null>(null);
	const ring1MatRef    = useRef<THREE.MeshBasicMaterial | null>(null);
	const ring2MatRef    = useRef<THREE.MeshBasicMaterial | null>(null);

	// Seeded random — stable seed = identical layout on every mount
	const rand = useMemo(() => mulberry32(0xdeadbeef), []);

	const NODE_COUNT    = 26;
	const MAX_EDGE_DIST = Math.min(w, h) * 0.46;

	const { nodes, edges } = useMemo(
		() => buildGraph(rand, w, size, NODE_COUNT, MAX_EDGE_DIST),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[w, h],
	);

	const particles = useMemo(
		() => buildParticles(rand, edges, 38),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[edges],
	);

	// ── Mutable typed arrays (written each frame, uploaded to GPU) ──────────
	const nodePositions = useMemo(() => {
		const arr = new Float32Array(nodes.length * 3);
		nodes.forEach((n, i) => n.pos.toArray(arr, i * 3));
		return arr;
	}, [nodes]);

	const edgePositions     = useMemo(() => new Float32Array(edges.length    * 6), [edges]);
	const particlePositions = useMemo(() => new Float32Array(particles.length * 3), [particles]);

	// ── Imperative geometries (consistent with point-field.tsx) ─────────────
	const nodeGeo = useMemo(() => {
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.BufferAttribute(nodePositions, 3));
		geo.setAttribute("size", new THREE.BufferAttribute(
			new Float32Array(nodes.map((n) => n.weight)),
			1,
		));
		return geo;
	}, [nodes, nodePositions]);

	const edgeGeo = useMemo(() => {
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.BufferAttribute(edgePositions, 3));
		return geo;
	}, [edgePositions]);

	const particleGeo = useMemo(() => {
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
		return geo;
	}, [particlePositions]);

	// ── Background grid (fully static, never rebuilt) ───────────────────────
	const gridGeo = useMemo(() => {
		const step = Math.min(w, h) * 0.13;
		const cols = Math.ceil(w / step) + 1;
		const rows = Math.ceil(h / step) + 1;
		const verts: number[] = [];
		for (let r = 0; r <= rows; r++) {
			const y = -h * 0.5 + r * step;
			verts.push(-w * 0.55, y, -1.4, w * 0.55, y, -1.4);
		}
		for (let c = 0; c <= cols; c++) {
			const x = -w * 0.55 + c * step;
			verts.push(x, -h * 0.5, -1.4, x, h * 0.5, -1.4);
		}
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
		return geo;
	}, [w, h]);

	// ── Orbit ring geometries (pipeline stage indicators) ───────────────────
	const ring1Geo = useMemo(
		() => new THREE.TorusGeometry(Math.min(w, h) * 0.37, 0.013, 3, 80),
		[w, h],
	);
	const ring2Geo = useMemo(
		() => new THREE.TorusGeometry(Math.min(w, h) * 0.52, 0.009, 3, 80),
		[w, h],
	);

	// Dispose imperative geometries on change / unmount
	useEffect(
		() => () => {
			nodeGeo.dispose();
			edgeGeo.dispose();
			particleGeo.dispose();
			gridGeo.dispose();
			ring1Geo.dispose();
			ring2Geo.dispose();
		},
		[nodeGeo, edgeGeo, particleGeo, gridGeo, ring1Geo, ring2Geo],
	);

	// Pointer tracking for parallax
	useEffect(() => {
		const onMove = (e: PointerEvent) => {
			pointer.current.x =  (e.clientX / window.innerWidth)  * 2 - 1;
			pointer.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
		};
		window.addEventListener("pointermove", onMove, { passive: true });
		return () => window.removeEventListener("pointermove", onMove);
	}, []);

	// Apply live theme colors to Three.js materials without a React re-render
	useEffect(() => {
		edgeMatRef.current?.color.set(ink);
		nodeMatRef.current?.color.set(accent);
		particleMatRef.current?.color.set(accent);
		scanMatRef.current?.color.set(accent);
		haloMatRef.current?.color.set(accent);
		gridMatRef.current?.color.set(ink);
		ring1MatRef.current?.color.set(ink);
		ring2MatRef.current?.color.set(ink);
	}, [ink, accent]);

	// ── Per-frame animation ─────────────────────────────────────────────────
	useFrame((_, delta) => {
		if (!groupRef.current) return;
		elapsed.current += delta;
		const t = elapsed.current;

		// Drift graph nodes within bounded region
		for (let i = 0; i < nodes.length; i++) {
			const n = nodes[i];
			n.pos.addScaledVector(n.velocity, 1);
			if (Math.abs(n.pos.x) > w * 0.43) n.velocity.x *= -1;
			if (Math.abs(n.pos.y) > size * 0.41) n.velocity.y *= -1;
			if (Math.abs(n.pos.z) > 0.7)       n.velocity.z *= -1;
			n.pos.toArray(nodePositions, i * 3);
		}

		// Rebuild edge positions from updated node positions
		for (let e = 0; e < edges.length; e++) {
			const { a, b } = edges[e];
			edgePositions[e * 6 + 0] = nodes[a].pos.x;
			edgePositions[e * 6 + 1] = nodes[a].pos.y;
			edgePositions[e * 6 + 2] = nodes[a].pos.z;
			edgePositions[e * 6 + 3] = nodes[b].pos.x;
			edgePositions[e * 6 + 4] = nodes[b].pos.y;
			edgePositions[e * 6 + 5] = nodes[b].pos.z;
		}

		// Advance particles along their current edge
		for (let p = 0; p < particles.length; p++) {
			const part = particles[p];
			part.t += part.speed;
			if (part.t > 1) {
				part.t = 0;
				part.edgeIndex = Math.floor(Math.random() * edges.length);
			}
			const { a, b } = edges[part.edgeIndex];
			const pa = nodes[a].pos;
			const pb = nodes[b].pos;
			particlePositions[p * 3]     = pa.x + (pb.x - pa.x) * part.t;
			particlePositions[p * 3 + 1] = pa.y + (pb.y - pa.y) * part.t;
			particlePositions[p * 3 + 2] = pa.z + (pb.z - pa.z) * part.t + 0.05;
		}

		// Upload position data to GPU
		if (nodesRef.current) {
			const attr = nodesRef.current.geometry.attributes.position as THREE.BufferAttribute;
			attr.needsUpdate = true;
		}
		if (edgesRef.current) {
			const attr = edgesRef.current.geometry.attributes.position as THREE.BufferAttribute;
			attr.needsUpdate = true;
		}
		if (partRef.current) {
			const attr = partRef.current.geometry.attributes.position as THREE.BufferAttribute;
			attr.needsUpdate = true;
		}

		// Scan beam sweeps vertically within the square core with a sine wave
		const sweepY = (Math.sin(t * 0.72) * size) / 2.15;
		if (scanRef.current) scanRef.current.position.y = sweepY;
		if (haloRef.current) haloRef.current.position.y = sweepY;

		// Grid drifts subtly with the pointer for depth
		if (gridRef.current) {
			const gx = pointer.current.x * 0.22;
			const gy = pointer.current.y * 0.14;
			gridRef.current.position.x += (gx - gridRef.current.position.x) * Math.min(delta * 2, 1);
			gridRef.current.position.y += (gy - gridRef.current.position.y) * Math.min(delta * 2, 1);
		}

		// Whole group mouse parallax + slow idle float
		const targetRotX = pointer.current.y * 0.055;
		const targetRotY = pointer.current.x * 0.075;
		groupRef.current.rotation.x += (targetRotX - groupRef.current.rotation.x) * Math.min(delta * 3.2, 1);
		groupRef.current.rotation.y += (targetRotY - groupRef.current.rotation.y) * Math.min(delta * 3.2, 1);
		groupRef.current.position.y  = Math.sin(t * 0.52) * 0.05;
	});

	return (
		<group ref={groupRef}>

			{/* ── Background architectural grid ─────────────────────────────── */}
			<lineSegments ref={gridRef} geometry={gridGeo}>
				<lineBasicMaterial
					ref={gridMatRef}
					color={ink}
					transparent
					opacity={0.065}
					depthWrite={false}
				/>
			</lineSegments>

			{/* ── Outer orbit ring — PR review pipeline loop ───────────────── */}
			<mesh geometry={ring1Geo} rotation={[Math.PI * 0.13, 0.05, Math.PI * 0.04]}>
				<meshBasicMaterial
					ref={ring1MatRef}
					color={ink}
					transparent
					opacity={0.16}
					depthWrite={false}
				/>
			</mesh>

			{/* ── Inner orbit ring — RAG context retrieval loop ────────────── */}
			<mesh geometry={ring2Geo} rotation={[Math.PI * 0.07, Math.PI * 0.05, -Math.PI * 0.025]}>
				<meshBasicMaterial
					ref={ring2MatRef}
					color={ink}
					transparent
					opacity={0.10}
					depthWrite={false}
				/>
			</mesh>

			{/* ── Graph edges (codebase knowledge graph connections) ───────── */}
			<lineSegments ref={edgesRef} geometry={edgeGeo}>
				<lineBasicMaterial
					ref={edgeMatRef}
					color={ink}
					transparent
					opacity={0.20}
					depthWrite={false}
				/>
			</lineSegments>

			{/* ── Graph nodes (indexed files and code symbols) ─────────────── */}
			<points ref={nodesRef} geometry={nodeGeo}>
				<pointsMaterial
					ref={nodeMatRef}
					color={accent}
					size={0.15}
					sizeAttenuation
					transparent
					opacity={0.72}
					depthWrite={false}
				/>
			</points>

			{/* ── Flowing particles (RAG query traversal along graph edges) ── */}
			<points ref={partRef} geometry={particleGeo}>
				<pointsMaterial
					ref={particleMatRef}
					color={accent}
					size={0.09}
					sizeAttenuation
					transparent
					opacity={1.0}
					depthWrite={false}
				/>
			</points>

			{/* ── Scan beam core line ──────────────────────────────────────── */}
			<mesh ref={scanRef}>
				<planeGeometry args={[w * 0.94, 0.022]} />
				<meshBasicMaterial
					ref={scanMatRef}
					color={accent}
					transparent
					opacity={0.60}
					depthWrite={false}
				/>
			</mesh>

			{/* ── Scan beam soft glow halo ──────────────────────────────────── */}
			<mesh ref={haloRef} position={[0, 0, -0.02]}>
				<planeGeometry args={[w * 0.94, 0.22]} />
				<meshBasicMaterial
					ref={haloMatRef}
					color={accent}
					transparent
					opacity={0.07}
					depthWrite={false}
				/>
			</mesh>

		</group>
	);
}

// ─── Public export ─────────────────────────────────────────────────────────
export default function HeroWireframe() {
	const canRender = useCanRender3D();
	const { resolvedTheme } = useTheme();
	const [ink,    setInk]    = useState("#231d15");
	const [accent, setAccent] = useState("#fc4c02");
	const [dims,   setDims]   = useState<{ width: number; height: number } | null>(null);

	// Read CSS design tokens and re-read whenever the theme class changes
	useEffect(() => {
		const read = () => {
			const s = getComputedStyle(document.documentElement);
			const fg    = s.getPropertyValue("--foreground").trim();
			const brand = s.getPropertyValue("--brand").trim();
			if (fg)    setInk(fg);
			if (brand) setAccent(brand);
		};
		read();
		const mo = new MutationObserver((ms) => {
			if (ms.some((m) => m.attributeName === "class")) read();
		});
		mo.observe(document.documentElement, { attributes: true });
		return () => mo.disconnect();
	}, [resolvedTheme]);

	// Pin canvas to the hero section's full bounding box
	useEffect(() => {
		const section = document.querySelector(".hero-root");
		if (!(section instanceof HTMLElement)) return;
		const update = () => {
			const r = section.getBoundingClientRect();
			if (r.width > 0 && r.height > 0) setDims({ width: r.width, height: r.height });
		};
		update();
		window.addEventListener("resize", update, { passive: true });
		const ro = new ResizeObserver(update);
		ro.observe(section);
		const timer = setTimeout(update, 800);
		return () => {
			clearTimeout(timer);
			window.removeEventListener("resize", update);
			ro.disconnect();
		};
	}, []);

	if (!canRender || !dims) return null;

	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 z-0 animate-in fade-in duration-700"
			style={{ width: dims.width, height: dims.height }}
		>
			<Canvas
				dpr={[1, 1.5]}
				gl={{ antialias: true, alpha: true }}
				camera={{ position: [0, 0, 6.2], fov: 44 }}
				className="!absolute inset-0"
			>
				<ReviewGraphScene ink={ink} accent={accent} />
			</Canvas>
		</div>
	);
}
