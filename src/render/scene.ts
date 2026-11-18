// The app's 3D view on maker-kit's viewer (its renderer, light, orbit
// camera, grid, fit and the sheet's inset): the parts' roles and materials,
// a lifted part's offset, the captions over the canvas that follow the
// camera (placed after each frame, `onFrame`), the warnings' spots, x-ray,
// the idle turn (idleTurn.ts), and the smoke's projection. Frames are drawn
// on demand. Takes finished buffers from the core and knows nothing about
// how they were made; the core is z-up, the viewer's `model` turns it y-up.
// Kept thin: vitest never loads it, the smoke does.

import * as THREE from 'three';
import type { IndexedMesh, SurfaceMesh } from 'maker-kit/3d/mesh';
import { createViewer } from 'maker-kit/3d/viewer';
import { placeCaptions } from './captions';
import type { CaptionPoint, CaptionRect } from './captions';
import { idleTurn } from './idleTurn';

export type PartRole = 'body' | 'lid' | 'screw' | 'clamp' | 'cap' | 'hinge' | 'board' | 'port' | 'glass' | 'hardware';

export interface ScenePart {
  role: PartRole;
  mesh: SurfaceMesh;
  /** offset applied on display (a lifted lid), mm, z-up */
  offset?: [number, number, number];
}

/** A caption over a point of the model (a board's port): text, where (mm, z-up), dimmed or not. */
export interface SceneCaption {
  key: string;
  text: string;
  at: [number, number, number];
  dim: boolean;
  /** a warning's badge: red (a note's grey), placed before every port caption; open, it shows the whole message */
  warn?: { open: boolean; info: boolean };
}

/** A warning's place: red boxes drawn through the case, brighter when its badge or line is picked. */
export interface SceneSpot {
  mesh: SurfaceMesh;
  offset: [number, number, number];
  hot: boolean;
}

export interface SceneHandle {
  setParts(parts: ScenePart[]): void;
  /** Captions drawn over the canvas, following the camera: port captions give way, warnings' badges never (captions.ts). */
  setCaptions(captions: SceneCaption[]): void;
  /** The warnings' places, drawn apart from the parts (a hover redraws only them). */
  setSpots(spots: SceneSpot[]): void;
  /** The key of the caption shown at a canvas point (CSS px from its top-left), or null. */
  captionAt(x: number, y: number): string | null;
  /** The captions shown now and where — for the smoke. */
  shownCaptions(): { key: string; x: number; y: number }[];
  setXray(on: boolean): void;
  /**
   * Pixels at the bottom of the canvas hidden by something on top (the
   * mobile settings sheet): the model is fitted in what is left.
   */
  setBottomInset(px: number): void;
  /** Where model points (mm, z-up) land on the canvas, CSS pixels from its top-left — for the smoke. */
  project(points: readonly [number, number, number][]): [number, number][];
  /** Puts the camera on a direction from the model (screen frame, y up), fitted — for scripts/snap.mjs --camera. */
  lookFrom(direction: readonly [number, number, number]): void;
  dispose(): void;
}

const COLORS: Record<PartRole, number> = {
  body: 0x8fa3b8,
  lid: 0xb8c6d4,
  screw: 0xd4dde6,
  clamp: 0xa9b8c8,
  cap: 0xe2e8ee,
  hinge: 0x7d91a6,
  board: 0x3fae6a,
  port: 0xd9b45a,
  glass: 0x1e2a36,
  hardware: 0x9aa3ad,
};
const WARN_COLOR = 0xe5484d;

export function createScene(canvas: HTMLCanvasElement, captionLayer: HTMLElement): SceneHandle {
  // no WebGL: the app works on without its view (every call below is a no-op)
  const viewer = createViewer(canvas);
  const model = viewer?.model ?? new THREE.Group();

  const materials: Record<PartRole, THREE.MeshStandardMaterial> = {
    body: new THREE.MeshStandardMaterial({ color: COLORS.body, metalness: 0.05, roughness: 0.6, side: THREE.DoubleSide }),
    lid: new THREE.MeshStandardMaterial({ color: COLORS.lid, metalness: 0.05, roughness: 0.6, side: THREE.DoubleSide }),
    screw: new THREE.MeshStandardMaterial({ color: COLORS.screw, metalness: 0.05, roughness: 0.6, side: THREE.DoubleSide }),
    clamp: new THREE.MeshStandardMaterial({ color: COLORS.clamp, metalness: 0.05, roughness: 0.6, side: THREE.DoubleSide }),
    cap: new THREE.MeshStandardMaterial({ color: COLORS.cap, metalness: 0.05, roughness: 0.6, side: THREE.DoubleSide }),
    hinge: new THREE.MeshStandardMaterial({ color: COLORS.hinge, metalness: 0.05, roughness: 0.6, side: THREE.DoubleSide }),
    // Boards are drawn schematically and see-through, so they never read as
    // part of the case: the PCB green, its connectors and parts amber.
    board: new THREE.MeshStandardMaterial({
      color: COLORS.board,
      metalness: 0,
      roughness: 0.8,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    }),
    port: new THREE.MeshStandardMaterial({
      color: COLORS.port,
      metalness: 0.2,
      roughness: 0.6,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }),
    // through bolts and their nuts: bought steel, schematic like the boards
    hardware: new THREE.MeshStandardMaterial({
      color: COLORS.hardware,
      metalness: 0.6,
      roughness: 0.4,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    }),
    // a display's glass: dark, its window in the ports' amber over it
    glass: new THREE.MeshStandardMaterial({
      color: COLORS.glass,
      metalness: 0.3,
      roughness: 0.2,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    }),
  };

  // seen through the walls: no depth test, drawn last
  const spotMaterial = (opacity: number): THREE.MeshBasicMaterial =>
    new THREE.MeshBasicMaterial({
      color: WARN_COLOR,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
  const spotMaterials = { cold: spotMaterial(0.13), hot: spotMaterial(0.45) };
  const spotObjects: THREE.Mesh[] = [];

  /** The camera of the last frame drawn: the captions and the smoke's projection read it. */
  let lastCamera: THREE.PerspectiveCamera | null = null;

  interface Shown {
    caption: SceneCaption;
    el: HTMLElement;
    w: number;
    h: number;
    rect: CaptionRect | null;
  }
  let captions: Shown[] = [];

  /** Places the captions for this frame: projected, then placed (captions.ts). */
  function placeAll(camera: THREE.PerspectiveCamera): void {
    if (captions.length === 0) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const points = captions.map((shown): CaptionPoint => {
      const world = new THREE.Vector3(...shown.caption.at).applyMatrix4(model.matrixWorld);
      const v = world.clone().project(camera);
      return {
        x: ((v.x + 1) / 2) * w,
        y: ((1 - v.y) / 2) * h,
        w: shown.w,
        h: shown.h,
        depth: world.distanceTo(camera.position),
        behind: v.z > 1,
        warn: Boolean(shown.caption.warn),
      };
    });
    placeCaptions(points, w, h).forEach((rect, i) => {
      const shown = captions[i];
      if (!shown) return;
      shown.rect = rect;
      shown.el.hidden = rect === null;
      if (rect) shown.el.style.transform = `translate(${rect[0].toFixed(1)}px, ${rect[1].toFixed(1)}px)`;
    });
  }

  const stopFrames = viewer?.onFrame((camera) => {
    lastCamera = camera;
    placeAll(camera);
  });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const stopIdle = viewer
    ? idleTurn({
        turn: (radians) => viewer.turn(radians),
        now: () => performance.now(),
        requestFrame: (callback) => requestAnimationFrame(callback),
        cancelFrame: (id) => cancelAnimationFrame(id),
        setTimer: (callback, ms) => window.setTimeout(callback, ms),
        clearTimer: (id) => window.clearTimeout(id),
        target: window,
        reducedMotion: () => reducedMotion.matches,
      })
    : null;

  return {
    setParts(parts: ScenePart[]): void {
      viewer?.setMeshes(parts.map((part) => ({ mesh: shifted(part.mesh, part.offset), material: materials[part.role] })));
    },

    lookFrom(direction: readonly [number, number, number]): void {
      viewer?.look(direction);
    },

    setCaptions(list: SceneCaption[]): void {
      captionLayer.replaceChildren();
      captions = list.map((caption) => {
        const el = document.createElement('span');
        el.className = caption.warn
          ? `warn-badge${caption.warn.info ? ' info' : ''}${caption.warn.open ? ' open' : ''}`
          : caption.dim
            ? 'port-caption dim'
            : 'port-caption';
        el.textContent = caption.text;
        captionLayer.append(el);
        return { caption, el, w: 0, h: 0, rect: null };
      });
      // measured once: the frames only move them
      for (const shown of captions) {
        shown.w = shown.el.offsetWidth;
        shown.h = shown.el.offsetHeight;
      }
      // placed now with the last frame's camera (a click or a read may come before the next frame), and again by that frame
      if (lastCamera) {
        model.updateMatrixWorld(true);
        lastCamera.updateMatrixWorld();
        placeAll(lastCamera);
      }
      viewer?.render();
    },

    setSpots(spots: SceneSpot[]): void {
      for (const obj of spotObjects) {
        model.remove(obj);
        obj.geometry.dispose();
      }
      spotObjects.length = 0;
      for (const spot of spots) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(spot.mesh.positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(spot.mesh.indices, 1));
        const obj = new THREE.Mesh(geometry, spot.hot ? spotMaterials.hot : spotMaterials.cold);
        obj.position.set(...spot.offset);
        obj.renderOrder = 10;
        model.add(obj);
        spotObjects.push(obj);
      }
      viewer?.render();
    },

    captionAt(x: number, y: number): string | null {
      const hit = captions.find(({ rect }) => rect && x >= rect[0] && x <= rect[0] + rect[2] && y >= rect[1] && y <= rect[1] + rect[3]);
      return hit ? hit.caption.key : null;
    },

    shownCaptions(): { key: string; x: number; y: number }[] {
      return captions.flatMap(({ caption, rect }) =>
        rect ? [{ key: caption.key, x: rect[0] + rect[2] / 2, y: rect[1] + rect[3] / 2 }] : [],
      );
    },

    setXray(on: boolean): void {
      for (const material of [materials.body, materials.lid, materials.screw, materials.clamp]) {
        material.transparent = on;
        material.opacity = on ? 0.35 : 1;
        material.depthWrite = !on;
        material.needsUpdate = true;
      }
      viewer?.render();
    },

    setBottomInset(px: number): void {
      viewer?.setInset(px);
    },

    project(points: readonly [number, number, number][]): [number, number][] {
      if (!lastCamera) return [];
      const camera = lastCamera;
      model.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      return points.map(([x, y, z]) => {
        const v = new THREE.Vector3(x, y, z).applyMatrix4(model.matrixWorld).project(camera);
        return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
      });
    },

    dispose(): void {
      stopIdle?.();
      stopFrames?.();
      for (const obj of spotObjects) obj.geometry.dispose();
      viewer?.dispose();
      for (const material of [...Object.values(materials), ...Object.values(spotMaterials)]) material.dispose();
    },
  };
}

/** A part as the viewer takes it: lifted by its offset (a lid shown above its body). */
function shifted(mesh: SurfaceMesh, offset: readonly [number, number, number] = [0, 0, 0]): IndexedMesh {
  const [ox, oy, oz] = offset;
  if (ox === 0 && oy === 0 && oz === 0) return mesh;
  const positions = new Float32Array(mesh.positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = mesh.positions[i] + ox;
    positions[i + 1] = mesh.positions[i + 1] + oy;
    positions[i + 2] = mesh.positions[i + 2] + oz;
  }
  return { positions, indices: mesh.indices };
}
