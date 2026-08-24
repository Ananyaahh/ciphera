"use client";

import CipheraScene from "@/components/scene/CipheraScene";
import GridOverlay from "@/components/scene/GridOverlay";

/**
 * Mounts CIPHERA's persistent cinematic layers once, at the app root, so a
 * single WebGL context and the grid/cursor survive route changes (no re-init
 * flash between pages). Every layer is theme-aware and sits behind the app UI.
 */
export default function SceneRoot() {
  return (
    <>
      <CipheraScene />
      <GridOverlay />
    </>
  );
}
