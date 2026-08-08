"use client";

import { useEffect, useRef } from "react";

/**
 * Three.js hero background — a slow-rotating 8-point sheriff-star wireframe
 * inside a drifting shell of particles. Colors are read live from the CSS
 * token layer (--primary / --foreground) so it follows the Dispatch palette
 * and theme switches. Cheap by design: no post-processing, DPR clamped,
 * paused when hidden, static when reduced motion is preferred.
 */
export function HeroCanvas() {
	const mountRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let disposed = false;
		let cleanup: (() => void) | undefined;

		const init = async () => {
			const THREE = await import("three");
			const mount = mountRef.current;
			if (!mount || disposed) return;

			const scene = new THREE.Scene();
			const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
			camera.position.z = 6;

			const renderer = new THREE.WebGLRenderer({
				alpha: true,
				antialias: true,
				powerPreference: "high-performance",
			});
			renderer.setClearColor(0x000000, 0);
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
			mount.appendChild(renderer.domElement);

			const cssVar = (name: string) =>
				getComputedStyle(document.documentElement)
					.getPropertyValue(name)
					.trim();

			// 8-point star (sheriff badge) as a wireframe loop.
			const shape = new THREE.Shape();
			const OUTER = 1.05;
			const INNER = 0.44;
			for (let i = 0; i < 16; i++) {
				const r = i % 2 === 0 ? OUTER : INNER;
				const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
				const x = Math.cos(a) * r;
				const y = Math.sin(a) * r;
				if (i === 0) shape.moveTo(x, y);
				else shape.lineTo(x, y);
			}
			shape.closePath();

			const starGeo = new THREE.BufferGeometry().setFromPoints(
				shape.getPoints(96),
			);
			const starMat = new THREE.LineBasicMaterial({
				color: 0x3ecf8e,
				transparent: true,
				opacity: 0.75,
			});
			const star = new THREE.LineLoop(starGeo, starMat);
			scene.add(star);

			// Drifting particle shell.
			const COUNT = 170;
			const positions = new Float32Array(COUNT * 3);
			for (let i = 0; i < COUNT; i++) {
				const r = 2.4 + Math.random() * 2.4;
				const theta = Math.random() * Math.PI * 2;
				const phi = Math.acos(2 * Math.random() - 1);
				positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
				positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
				positions[i * 3 + 2] = r * Math.cos(phi);
			}
			const pGeo = new THREE.BufferGeometry();
			pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
			const pMat = new THREE.PointsMaterial({
				color: 0xe8ecea,
				size: 0.028,
				transparent: true,
				opacity: 0.55,
				sizeAttenuation: true,
			});
			const particles = new THREE.Points(pGeo, pMat);
			scene.add(particles);

			const applyColors = () => {
				starMat.color.set(cssVar("--primary") || "#3ecf8e");
				pMat.color.set(cssVar("--foreground") || "#e8ecea");
			};
			applyColors();
			const observer = new MutationObserver(applyColors);
			observer.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ["class"],
			});

			const reduceMotion = window.matchMedia(
				"(prefers-reduced-motion: reduce)",
			).matches;

			const onResize = () => {
				const w = mount.clientWidth;
				const h = mount.clientHeight;
				if (!w || !h) return;
				renderer.setSize(w, h, false);
				camera.aspect = w / h;
				camera.updateProjectionMatrix();
				// Keep the static frame correct under reduced motion.
				if (reduceMotion) renderer.render(scene, camera);
			};
			onResize();
			window.addEventListener("resize", onResize, { passive: true });

			let mouseX = 0;
			let mouseY = 0;
			const onMouse = (e: MouseEvent) => {
				mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
				mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
			};
			window.addEventListener("mousemove", onMouse, { passive: true });

			let raf = 0;
			const tick = () => {
				const t = performance.now() / 1000;
				star.rotation.z = t * 0.16;
				star.rotation.x = Math.sin(t * 0.22) * 0.18;
				particles.rotation.y = t * 0.035;
				camera.position.x += (mouseX * 0.45 - camera.position.x) * 0.04;
				camera.position.y += (-mouseY * 0.3 - camera.position.y) * 0.04;
				camera.lookAt(0, 0, 0);
				renderer.render(scene, camera);
				raf = requestAnimationFrame(tick);
			};

			const onVisibility = () => {
				if (document.hidden) cancelAnimationFrame(raf);
				else tick();
			};

			if (reduceMotion) {
				renderer.render(scene, camera);
			} else {
				tick();
				document.addEventListener("visibilitychange", onVisibility);
			}

			cleanup = () => {
				disposed = true;
				cancelAnimationFrame(raf);
				observer.disconnect();
				window.removeEventListener("resize", onResize);
				window.removeEventListener("mousemove", onMouse);
				document.removeEventListener("visibilitychange", onVisibility);
				starGeo.dispose();
				starMat.dispose();
				pGeo.dispose();
				pMat.dispose();
				renderer.dispose();
				if (renderer.domElement.parentElement === mount) {
					mount.removeChild(renderer.domElement);
				}
			};
		};

		void init();

		return () => {
			disposed = true;
			cleanup?.();
		};
	}, []);

	return <div ref={mountRef} aria-hidden="true" className="absolute inset-0" />;
}
