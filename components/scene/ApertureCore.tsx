"use client";

import { useEffect, useRef } from "react";
import { Renderer, Camera, Transform, Geometry, Program, Mesh } from "ogl";
import { useTheme, usePrefersReducedMotion } from "@/lib/useTheme";
import { scenePalette, type RGB } from "@/lib/scenePalette";
import type { Theme } from "@/lib/theme";

/**
 * The landing hero's spatial centrepiece.
 *
 * Instead of importing an unrelated object, this is a piece of CIPHERA's own
 * language rendered in 3D: concentric rings of points that read at once as a
 * camera aperture and a fingerprint whorl — capture and identity, the two
 * things the product binds together. A scan sweep travels outward through the
 * rings; scroll turns and dollies the form; the cursor tilts it in space.
 * Colours are drawn from the theme palette and cross-fade with the toggle.
 */
export default function ApertureCore({ className = "" }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const reduced = usePrefersReducedMotion();
  const themeRef = useRef<Theme>(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        alpha: true,
        antialias: true,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    const canvas = gl.canvas;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    host.appendChild(canvas);

    try {

    const camera = new Camera(gl, { fov: 35 });
    camera.position.set(0, 0, 6.4);

    const isMobile = Math.min(window.innerWidth, window.innerHeight) < 720;

    // ---- Build the aperture / fingerprint point field ----
    const maxR = 2.15;
    const minR = 0.22;
    const ringStep = isMobile ? 0.11 : 0.078;
    const posArr: number[] = [];
    const radArr: number[] = [];
    const angArr: number[] = [];
    const seedArr: number[] = [];
    for (let r = minR; r <= maxR; r += ringStep) {
      const n = Math.max(12, Math.round(r * (isMobile ? 42 : 64)));
      const rn = (r - minR) / (maxR - minR); // 0 inner .. 1 outer
      const cx = (1 - rn) * 0.16; // whorl core offset
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const ridge = Math.sin(a * 3 + r * 4) * 0.03 + Math.sin(a * 7) * 0.015;
        const rr = r + ridge;
        posArr.push(
          Math.cos(a) * rr + cx,
          Math.sin(a) * rr,
          Math.sin(a * 2 + r * 6) * 0.05
        );
        radArr.push(rn);
        angArr.push(a);
        seedArr.push(Math.random());
      }
    }
    const geometry = new Geometry(gl, {
      position: { size: 3, data: new Float32Array(posArr) },
      aRadius: { size: 1, data: new Float32Array(radArr) },
      aAngle: { size: 1, data: new Float32Array(angArr) },
      aSeed: { size: 1, data: new Float32Array(seedArr) },
    });

    const program = new Program(gl, {
      depthTest: false,
      depthWrite: false,
      transparent: true,
      vertex: /* glsl */ `
        attribute vec3 position;
        attribute float aRadius;
        attribute float aAngle;
        attribute float aSeed;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        uniform float uTime;
        uniform float uScan;
        uniform float uDpr;
        varying float vRadius;
        varying float vScan;
        varying float vTwinkle;
        void main() {
          vRadius = aRadius;
          vec3 p = position;
          // gentle breathing in depth
          p.z += sin(uTime * 0.8 + aAngle * 3.0 + aRadius * 5.0) * 0.03;
          // scan ring sweeping outward through the fingerprint
          float band = smoothstep(0.09, 0.0, abs(aRadius - uScan));
          vScan = band;
          p.z += band * 0.14;
          vTwinkle = 0.6 + 0.4 * sin(uTime * 2.0 + aSeed * 6.2831);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float base = 5.5 + band * 9.0;
          gl_PointSize = base * uDpr / max(-mv.z, 0.1);
        }
      `,
      fragment: /* glsl */ `
        precision highp float;
        uniform vec3 uInner;
        uniform vec3 uMid;
        uniform vec3 uOuter;
        uniform vec3 uScanColor;
        uniform float uOpacity;
        varying float vRadius;
        varying float vScan;
        varying float vTwinkle;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d);
          vec3 col = vRadius < 0.5
            ? mix(uInner, uMid, vRadius * 2.0)
            : mix(uMid, uOuter, (vRadius - 0.5) * 2.0);
          col = mix(col, uScanColor, vScan * 0.85);
          float alpha = a * uOpacity * (0.55 + 0.45 * vTwinkle) + vScan * 0.25;
          gl_FragColor = vec4(col * (1.0 + vScan * 0.6), alpha);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uScan: { value: 0 },
        uDpr: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uInner: { value: [1, 1, 1] as RGB },
        uMid: { value: [1, 1, 1] as RGB },
        uOuter: { value: [1, 1, 1] as RGB },
        uScanColor: { value: [1, 1, 1] as RGB },
        uOpacity: { value: 0.9 },
      },
    });

    const world = new Transform();
    const mesh = new Mesh(gl, { geometry, program, mode: gl.POINTS });
    mesh.setParent(world);
    world.rotation.x = -0.35;

    // Theme palette (cross-faded)
    function applyTheme(th: Theme, k = 1) {
      const p = scenePalette(th);
      const u = program.uniforms;
      const lerp3 = (from: RGB, to: RGB): RGB => [
        from[0] + (to[0] - from[0]) * k,
        from[1] + (to[1] - from[1]) * k,
        from[2] + (to[2] - from[2]) * k,
      ];
      u.uInner.value = lerp3(u.uInner.value as RGB, p.ringInner);
      u.uMid.value = lerp3(u.uMid.value as RGB, p.ringMid);
      u.uOuter.value = lerp3(u.uOuter.value as RGB, p.ringOuter);
      u.uScanColor.value = th === "light" ? [0.1, 0.5, 0.46] : [0.85, 0.98, 0.95];
      u.uOpacity.value = th === "light" ? 0.85 : 0.95;
    }
    applyTheme(themeRef.current, 1);
    let lastTheme = themeRef.current;

    // Interaction
    let mx = 0, my = 0, tmx = 0, tmy = 0;
    let curScroll = 0, targetScroll = 0;
    function readScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const top = window.scrollY || window.pageYOffset || 0;
      targetScroll = max > 0 ? Math.min(1, top / max) : 0;
    }
    function onMouse(e: MouseEvent) {
      tmx = (e.clientX / window.innerWidth) * 2 - 1;
      tmy = (e.clientY / window.innerHeight) * 2 - 1;
    }
    function resize() {
      const w = host!.clientWidth || 1;
      const h = host!.clientHeight || 1;
      renderer.setSize(w, h);
      camera.perspective({ aspect: w / h });
    }
    resize();
    readScroll();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", readScroll, { passive: true });
    window.addEventListener("mousemove", onMouse, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(
      (es) => { visible = es[0]?.isIntersecting ?? true; },
      { threshold: 0 }
    );
    io.observe(host);

    let raf = 0;
    const start = performance.now();
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (!visible || document.visibilityState === "hidden") return;
      const time = (now - start) * 0.001;

      if (themeRef.current !== lastTheme) lastTheme = themeRef.current;
      applyTheme(themeRef.current, 0.05); // continuous ease toward current theme

      curScroll += (targetScroll - curScroll) * 0.06;
      mx += (tmx - mx) * 0.05;
      my += (tmy - my) * 0.05;

      // scroll turns the whorl and dollies the camera; mouse tilts it
      world.rotation.z = curScroll * Math.PI * 1.3 + time * 0.04;
      world.rotation.y = mx * 0.5 + curScroll * 0.4;
      world.rotation.x = -0.35 + my * 0.3 - curScroll * 0.25;
      camera.position.z = 6.4 - Math.sin(curScroll * Math.PI) * 1.1;

      program.uniforms.uTime.value = time;
      program.uniforms.uScan.value = (time * 0.12) % 1.0;
      renderer.render({ scene: world, camera });
    }

    if (reduced) {
      resize();
      program.uniforms.uTime.value = 1.0;
      program.uniforms.uScan.value = 0.5;
      renderer.render({ scene: world, camera });
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", readScroll);
      window.removeEventListener("mousemove", onMouse);
      io.disconnect();
      try {
        const ext = gl.getExtension("WEBGL_lose_context");
        ext?.loseContext();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      } catch {
        /* ignore */
      }
    };
    } catch (err) {
      console.warn("WebGL scene init failed; falling back:", err);
      try {
        const ext = gl.getExtension("WEBGL_lose_context");
        ext?.loseContext();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      } catch {
        /* ignore */
      }
      return () => {};
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return <div ref={hostRef} aria-hidden="true" className={className} />;
}
