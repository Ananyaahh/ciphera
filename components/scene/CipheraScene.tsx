"use client";

import { useEffect, useRef } from "react";
import { Renderer, Camera, Transform, Triangle, Geometry, Program, Mesh } from "ogl";
import { useTheme, usePrefersReducedMotion } from "@/lib/useTheme";
import { scenePalette, lerpPalette, type ScenePalette } from "@/lib/scenePalette";
import type { Theme } from "@/lib/theme";

/**
 * CIPHERA's fixed, full-viewport cinematic backdrop.
 *
 * A single lightweight WebGL context (via `ogl`, the same renderer the
 * existing LightRays effect uses) draws two layers every frame:
 *   1. a liquid, metallic wave field — the reference's atmosphere,
 *      recoloured into CIPHERA's teal/indigo/violet identity, evolving with
 *      scroll and breathing on its own;
 *   2. a fine field of drifting "digital dust" with real depth, parallaxing
 *      to the cursor and quickening with scroll velocity.
 *
 * Every colour is theme-aware and cross-fades when the user flips the
 * existing light/dark toggle, so the whole environment recolours as one.
 * Guards: DPR cap, responsive particle budget, pauses when hidden/off-screen,
 * static single frame under reduced-motion, and full GL teardown on unmount.
 */
export default function CipheraScene({
  intensity = 1,
  className = "",
}: {
  /** 0..1 multiplier to calm the backdrop behind busy pages (e.g. camera). */
  intensity?: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const reduced = usePrefersReducedMotion();

  // Live refs the render loop reads without re-initialising WebGL.
  const themeRef = useRef<Theme>(theme);
  const intensityRef = useRef(intensity);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);
  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        alpha: true,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, 1.75),
        powerPreference: "high-performance",
      });
    } catch {
      return; // No WebGL — the CSS body background stays as a graceful fallback.
    }

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    const canvas = gl.canvas;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    host.appendChild(canvas);

    try {

    const camera = new Camera(gl, { fov: 45 });
    camera.position.set(0, 0, 5);

    const isMobile = Math.min(window.innerWidth, window.innerHeight) < 720;

    // ---- Layer 1: liquid wave field (fullscreen triangle) ----
    const bgProgram = new Program(gl, {
      depthTest: false,
      depthWrite: false,
      vertex: /* glsl */ `
        attribute vec2 uv;
        attribute vec2 position;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 0.0, 1.0);
        }
      `,
      fragment: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform float uTime;
        uniform vec2  uResolution;
        uniform vec2  uMouse;
        uniform float uScroll;
        uniform float uIntensity;
        uniform vec3  uShadow;
        uniform vec3  uWaveA1;
        uniform vec3  uWaveA2;
        uniform vec3  uCrestA;
        uniform vec3  uWaveB1;
        uniform vec3  uWaveB2;
        uniform vec3  uCrestB;
        uniform float uExposure;
        uniform float uCrestGain;
        uniform float uVignette;

        void main() {
          vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
          float aspect = uResolution.x / uResolution.y;

          float time = uTime * 0.08;      // calm, breathing cadence
          float scroll = uScroll;

          float angle1 = 0.6, angle2 = -0.7, angle3 = 1.2;
          float freq1 = 2.4, freq2 = 3.2, freq3 = 4.0;

          vec2 w = uv;
          float d = scroll * 5.0;
          w.x += sin(uv.y * 2.5 + time * 0.2 + d) * 0.35;
          w.y += cos(uv.x * 2.5 - time * 0.15 - d * 0.8) * 0.35;
          w.x += sin(uv.y * 1.2 - time * 0.1 - d * 1.5) * 0.25;
          w.y += cos(uv.x * 1.2 + time * 0.18 + d * 1.2) * 0.25;
          w += vec2(scroll * 0.04, -scroll * 0.02);
          w += vec2(uMouse.x * aspect * 0.05, uMouse.y * 0.05);

          vec2 dir1 = vec2(cos(angle1), sin(angle1));
          vec2 dir2 = vec2(cos(angle2), sin(angle2));
          vec2 dir3 = vec2(cos(angle3), sin(angle3));

          float f1 = sin(dot(w, dir1) * freq1 + time * 1.0);
          float f2 = cos(dot(w, dir2) * freq2 - time * 1.4 + f1 * 0.4);
          float f3 = sin(dot(w, dir3) * freq3 + time * 1.8 + f2 * 0.5);
          float field = f1 * 0.50 + f2 * 0.35 + f3 * 0.15;

          float wide = pow(max(0.0, 1.0 - abs(field - 0.1)), 2.5);
          float crisp = pow(max(0.0, 1.0 - abs(field - 0.15)), 8.0);
          float crest = wide * 0.5 + crisp * 0.9;

          float t = smoothstep(0.0, 1.0, scroll);
          vec3 colShadow = mix(uShadow, uShadow, t);
          vec3 colWave1  = mix(uWaveA1, uWaveB1, t);
          vec3 colWave2  = mix(uWaveA2, uWaveB2, t);
          vec3 colCrest  = mix(uCrestA, uCrestB, t);

          vec3 color = colShadow;
          color = mix(color, colWave2, smoothstep(-0.6, 0.2, field));
          color = mix(color, colWave1, smoothstep(0.0, 0.8, field));
          color += colCrest * crest * uCrestGain * (0.6 + 0.4 * uIntensity);

          float vignette = 1.0 - dot(uv, uv) * uVignette;
          color *= vignette * uExposure;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: [1, 1] },
        uMouse: { value: [0, 0] },
        uScroll: { value: 0 },
        uIntensity: { value: intensity },
        uShadow: { value: [0, 0, 0] },
        uWaveA1: { value: [0, 0, 0] },
        uWaveA2: { value: [0, 0, 0] },
        uCrestA: { value: [0, 0, 0] },
        uWaveB1: { value: [0, 0, 0] },
        uWaveB2: { value: [0, 0, 0] },
        uCrestB: { value: [0, 0, 0] },
        uExposure: { value: 1 },
        uCrestGain: { value: 1 },
        uVignette: { value: 0.1 },
      },
    });
    const bgMesh = new Mesh(gl, { geometry: new Triangle(gl), program: bgProgram });

    // ---- Layer 2: drifting digital-dust particles (with depth) ----
    let count = isMobile ? 120 : 340;
    if (reduced) count = Math.min(count, 90);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const mixv = new Float32Array(count);
    const RANGE = 6.0;
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = (Math.random() - 0.5) * RANGE * 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5 - 1.5;
      seeds[i] = Math.random();
      mixv[i] = Math.random();
    }
    const particleGeo = new Geometry(gl, {
      position: { size: 3, data: positions },
      aSeed: { size: 1, data: seeds },
      aMix: { size: 1, data: mixv },
    });
    const particleProgram = new Program(gl, {
      depthTest: false,
      depthWrite: false,
      transparent: true,
      vertex: /* glsl */ `
        attribute vec3 position;
        attribute float aSeed;
        attribute float aMix;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        uniform float uTime;
        uniform float uScroll;
        uniform float uScrollVel;
        uniform float uDpr;
        uniform float uSize;
        varying float vMix;
        varying float vAlpha;
        void main() {
          vMix = aMix;
          vec3 p = position;
          float sp = 0.35 + aSeed * 0.5;
          p.y = mod(p.y + uTime * sp * (1.0 + uScrollVel * 6.0) + 6.0, 12.0) - 6.0;
          p.x += sin(uTime * 0.3 + aSeed * 6.2831) * (0.15 + uScrollVel * 0.8);
          p.z += cos(uTime * 0.25 + aSeed * 6.2831) * 0.15;
          p.y += uScroll * 0.6;
          p.x += (aSeed - 0.5) * uScroll * 0.15;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float size = uSize * (0.5 + aSeed) * (1.0 + uScrollVel * 3.0);
          gl_PointSize = size * uDpr / max(-mv.z, 0.1);
          vAlpha = smoothstep(9.0, 2.0, -mv.z);
        }
      `,
      fragment: /* glsl */ `
        precision highp float;
        uniform vec3 uWarm;
        uniform vec3 uCool;
        uniform float uOpacity;
        varying float vMix;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d);
          vec3 col = mix(uWarm, uCool, vMix);
          gl_FragColor = vec4(col, a * a * vAlpha * uOpacity);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uScrollVel: { value: 0 },
        uDpr: { value: Math.min(window.devicePixelRatio || 1, 1.75) },
        uSize: { value: isMobile ? 26 : 34 },
        uWarm: { value: [1, 1, 1] },
        uCool: { value: [1, 1, 1] },
        uOpacity: { value: 0.5 },
      },
    });
    const particleScene = new Transform();
    const particleMesh = new Mesh(gl, {
      geometry: particleGeo,
      program: particleProgram,
      mode: gl.POINTS,
    });
    particleMesh.setParent(particleScene);

    // ---- Palette state (smoothly cross-faded on theme change) ----
    let current: ScenePalette = scenePalette(themeRef.current);
    let fadeFrom: ScenePalette = current;
    let fadeTo: ScenePalette = current;
    let fadeT = 1;
    let lastTheme: Theme = themeRef.current;

    function applyPalette(p: ScenePalette) {
      const u = bgProgram.uniforms;
      u.uShadow.value = p.shadow;
      u.uWaveA1.value = p.waveA1;
      u.uWaveA2.value = p.waveA2;
      u.uCrestA.value = p.crestA;
      u.uWaveB1.value = p.waveB1;
      u.uWaveB2.value = p.waveB2;
      u.uCrestB.value = p.crestB;
      u.uExposure.value = p.exposure;
      u.uCrestGain.value = p.crestGain;
      u.uVignette.value = p.vignette;
      particleProgram.uniforms.uWarm.value = p.sparkWarm;
      particleProgram.uniforms.uCool.value = p.sparkCool;
    }
    applyPalette(current);

    // ---- Interaction / scroll state ----
    let mx = 0, my = 0, tmx = 0, tmy = 0;
    let curScroll = 0, targetScroll = 0, scrollVel = 0;

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
      const w = host!.clientWidth || window.innerWidth;
      const h = host!.clientHeight || window.innerHeight;
      renderer.setSize(w, h);
      camera.perspective({ aspect: w / h });
      bgProgram.uniforms.uResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight];
    }
    resize();
    readScroll();

    window.addEventListener("resize", resize);
    window.addEventListener("scroll", readScroll, { passive: true });
    window.addEventListener("mousemove", onMouse, { passive: true });

    // Pause when the tab is hidden or the host scrolls fully out of view.
    let visible = true;
    const io = new IntersectionObserver(
      (es) => { visible = es[0]?.isIntersecting ?? true; },
      { threshold: 0 }
    );
    io.observe(host);
    const onVisibility = () => { if (document.visibilityState === "visible") { readScroll(); } };
    document.addEventListener("visibilitychange", onVisibility);

    let raf = 0;
    const start = performance.now();

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (!visible || document.visibilityState === "hidden") return;

      const time = (now - start) * 0.001;

      // Theme cross-fade
      if (themeRef.current !== lastTheme) {
        fadeFrom = current;
        fadeTo = scenePalette(themeRef.current);
        fadeT = 0;
        lastTheme = themeRef.current;
      }
      if (fadeT < 1) {
        fadeT = Math.min(1, fadeT + 0.04);
        current = lerpPalette(fadeFrom, fadeTo, fadeT);
        applyPalette(current);
      }

      // Smooth scroll + velocity
      const prev = curScroll;
      curScroll += (targetScroll - curScroll) * 0.06;
      scrollVel = scrollVel * 0.85 + Math.abs(curScroll - prev) * 0.15;

      // Smooth mouse
      mx += (tmx - mx) * 0.05;
      my += (tmy - my) * 0.05;

      const inten = intensityRef.current;

      // bg uniforms
      const bu = bgProgram.uniforms;
      bu.uTime.value = time;
      bu.uMouse.value = [mx, -my];
      bu.uScroll.value = curScroll;
      bu.uIntensity.value = inten;

      // particles: whole field parallax-tilts to the cursor
      particleScene.rotation.y = mx * 0.25;
      particleScene.rotation.x = my * 0.15;
      const pu = particleProgram.uniforms;
      pu.uTime.value = time * 0.5;
      pu.uScroll.value = curScroll;
      pu.uScrollVel.value = Math.min(scrollVel * 30, 1.2);
      pu.uOpacity.value = (themeRef.current === "light" ? 0.32 : 0.55) * inten;

      // Two-pass draw: wave field (clears), dust over the top.
      renderer.autoClear = true;
      renderer.render({ scene: bgMesh });
      renderer.autoClear = false;
      renderer.render({ scene: particleScene, camera });
    }

    if (reduced) {
      // One static, composed frame — no animation loop.
      resize();
      const bu = bgProgram.uniforms;
      bu.uTime.value = 12;
      bu.uScroll.value = 0;
      renderer.autoClear = true;
      renderer.render({ scene: bgMesh });
      renderer.autoClear = false;
      renderer.render({ scene: particleScene, camera });
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", readScroll);
      window.removeEventListener("mousemove", onMouse);
      document.removeEventListener("visibilitychange", onVisibility);
      io.disconnect();
      try {
        const ext = gl.getExtension("WEBGL_lose_context");
        ext?.loseContext();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      } catch {
        /* ignore teardown errors */
      }
    };
    // Re-init only when reduced-motion changes (theme is handled live).
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

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={`fixed inset-0 z-0 pointer-events-none ${className}`}
    />
  );
}
