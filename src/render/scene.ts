// The Three.js layer: scene, lights, orbit camera, materials. Takes finished
// buffers from the core and knows nothing about how they were made. The core
// is z-up (printing convention); a group turns it y-up for display. Kept thin:
// vitest never loads it, the smoke does.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SurfaceMesh } from '../geo/surface';

export type PartRole = 'body' | 'lid' | 'screw' | 'clamp' | 'board' | 'port';

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
}

export interface SceneHandle {
  setParts(parts: ScenePart[]): void;
  /** Captions drawn over the canvas, following the camera; those that would overlap give way to the nearer ones. */
  setCaptions(captions: SceneCaption[]): void;
  /** The key of the caption shown at a canvas point (CSS px from its top-left), or null. */
  captionAt(x: number, y: number): string | null;
  /** The captions shown now and where — for the smoke. */
  shownCaptions(): { key: string; x: number; y: number }[];
  setXray(on: boolean): void;
  /**
   * Pixels at the bottom of the canvas hidden by something on top (the
   * mobile settings sheet): the picture is centred in what is left.
   */
  setBottomInset(px: number): void;
  /** Where model points (mm, z-up) land on the canvas, CSS pixels from its top-left — for the smoke. */
  project(points: readonly [number, number, number][]): [number, number][];
  /** Puts the camera on a direction from the target (screen frame, y up), at the same distance — for scripts/snap.mjs --camera. */
  lookFrom(direction: readonly [number, number, number]): void;
  dispose(): void;
}

const CLEAR_COLOR = 0x15181c;
const COLORS: Record<PartRole, number> = {
  body: 0x8fa3b8,
  lid: 0xb8c6d4,
  screw: 0xd4dde6,
  clamp: 0xa9b8c8,
  board: 0x3fae6a,
  port: 0xd9b45a,
};
/** Vertical field of view of the whole canvas, degrees. */
const FOV = 40;
/** How long the picture takes to follow the settings sheet, ms (the sheet's own transition). */
const INSET_EASE_MS = 250;
/** Faces meeting at a sharper angle than this get a hard edge; rounded corners stay smooth. */
const CREASE_ANGLE = (35 * Math.PI) / 180;

/** Room kept between two captions, and between a caption and its point, CSS px. */
const CAPTION_GAP = 2;
const CAPTION_LIFT = 4;

export function createScene(canvas: HTMLCanvasElement, captionLayer: HTMLElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(CLEAR_COLOR);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 8000);
  // three-quarter view from the front-right, a little from above
  camera.position.set(140, 110, 170);

  scene.add(new THREE.HemisphereLight(0xe8eef5, 0x2a2f36, 1.0));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(2, 3, 2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xb0c0d0, 0.5);
  fill.position.set(-2, 1, -1.5);
  scene.add(fill);
  const head = new THREE.DirectionalLight(0xffffff, 0.35);
  head.position.set(0, 0, 1);
  camera.add(head);
  scene.add(camera);

  // z-up (model) → y-up (screen)
  const group = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  scene.add(group);

  const grid = new THREE.GridHelper(400, 40, 0x3a424c, 0x262b31);
  scene.add(grid);

  const materials: Record<PartRole, THREE.MeshStandardMaterial> = {
    body: new THREE.MeshStandardMaterial({ color: COLORS.body, metalness: 0.05, roughness: 0.6, side: THREE.DoubleSide }),
    lid: new THREE.MeshStandardMaterial({ color: COLORS.lid, metalness: 0.05, roughness: 0.6, side: THREE.DoubleSide }),
    screw: new THREE.MeshStandardMaterial({ color: COLORS.screw, metalness: 0.05, roughness: 0.6, side: THREE.DoubleSide }),
    clamp: new THREE.MeshStandardMaterial({ color: COLORS.clamp, metalness: 0.05, roughness: 0.6, side: THREE.DoubleSide }),
    // Boards are drawn schematically and see-through, so they never read as
    // part of the case: the PCB green, its connectors and parts amber.
    board: new THREE.MeshStandardMaterial({
      color: COLORS.board, metalness: 0, roughness: 0.8, transparent: true, opacity: 0.7, depthWrite: false,
    }),
    port: new THREE.MeshStandardMaterial({
      color: COLORS.port, metalness: 0.2, roughness: 0.6, transparent: true, opacity: 0.6, depthWrite: false,
    }),
  };

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  const objects: THREE.Mesh[] = [];
  let disposed = false;
  /** the inset applied now, and the one it eases towards */
  let bottomInset = 0;
  let inset = { from: 0, to: 0, start: 0 };
  /** size of the model at the last camera fit — so a zoom set by the mouse survives edits */
  let fittedRadius = 0;

  function resize(): void {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      renderer.setSize(w, h, false);
      applyInset(w, h);
    }
  }

  /**
   * A taller virtual frame whose lower part we show: its centre lands above
   * the inset. The frame keeps the canvas's angle per pixel — its aspect is
   * its own (w × (h + inset)) and its field of view grows with its height —
   * so the sheet only moves the picture: the scale and the proportions stay.
   * (With the canvas's aspect the picture was stretched by (h + inset) / h,
   * and round holes came out as ellipses.)
   */
  function applyInset(w: number, h: number): void {
    const px = Math.min(bottomInset, h * 0.8);
    if (px > 0) {
      const full = h + px;
      camera.aspect = w / full;
      camera.fov = (2 * Math.atan(Math.tan((FOV * Math.PI) / 360) * (full / h)) * 180) / Math.PI;
      camera.setViewOffset(w, full, 0, px, w, h);
    } else {
      camera.aspect = w / h;
      camera.fov = FOV;
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
  }

  /** Eases the applied inset towards its target, in step with the sheet. */
  function stepInset(now: number): void {
    if (bottomInset === inset.to) return;
    const k = Math.min(1, (now - inset.start) / INSET_EASE_MS);
    const eased = 1 - (1 - k) ** 3;
    bottomInset = k >= 1 ? inset.to : inset.from + (inset.to - inset.from) * eased;
    applyInset(canvas.clientWidth, canvas.clientHeight);
  }

  interface Shown { caption: SceneCaption; el: HTMLElement; w: number; h: number; rect: [number, number, number, number] | null }
  let captions: Shown[] = [];

  /** Places the captions for this frame: projected, nearest first, none over another. */
  function placeCaptions(): void {
    if (captions.length === 0) return;
    group.updateMatrixWorld(true);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const eye = camera.position;
    const placed = captions.map((shown) => {
      const world = new THREE.Vector3(...shown.caption.at).applyMatrix4(group.matrixWorld);
      const v = world.clone().project(camera);
      return { shown, x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, depth: world.distanceTo(eye), behind: v.z > 1 };
    }).sort((a, b) => a.depth - b.depth);
    const taken: [number, number, number, number][] = [];
    for (const { shown, x, y, behind } of placed) {
      const rect: [number, number, number, number] = [x - shown.w / 2, y - shown.h - CAPTION_LIFT, shown.w, shown.h];
      const clash = taken.some((r) => rect[0] < r[0] + r[2] + CAPTION_GAP && r[0] < rect[0] + rect[2] + CAPTION_GAP
        && rect[1] < r[1] + r[3] + CAPTION_GAP && r[1] < rect[1] + rect[3] + CAPTION_GAP);
      const off = behind || clash || x < 0 || x > w || y < 0 || y > h;
      shown.rect = off ? null : rect;
      shown.el.hidden = off;
      if (!off) {
        taken.push(rect);
        shown.el.style.transform = `translate(${rect[0].toFixed(1)}px, ${rect[1].toFixed(1)}px)`;
      }
    }
  }

  function frame(now: number): void {
    if (disposed) return;
    resize();
    stepInset(now);
    controls.update();
    renderer.render(scene, camera);
    placeCaptions();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /** Camera distance at which a sphere fits the part of the canvas the sheet leaves open. */
  function fitDistance(radius: number): number {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const open = h > 0 ? Math.max(0.2, 1 - Math.min(inset.to, h * 0.8) / h) : 1;
    const tanHalf = Math.tan((FOV * Math.PI) / 360);
    const vFov = 2 * Math.atan(tanHalf * open);
    const hFov = 2 * Math.atan(tanHalf * (h > 0 ? w / h : 1));
    return (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.1;
  }

  function clearObjects(): void {
    for (const obj of objects) {
      group.remove(obj);
      obj.geometry.dispose();
    }
    objects.length = 0;
  }

  return {
    setParts(parts: ScenePart[]): void {
      clearObjects();
      const bounds = new THREE.Box3();
      for (const part of parts) {
        const indexed = new THREE.BufferGeometry();
        indexed.setAttribute('position', new THREE.BufferAttribute(part.mesh.positions, 3));
        indexed.setIndex(new THREE.BufferAttribute(part.mesh.indices, 1));
        const geometry = toCreasedNormals(indexed, CREASE_ANGLE);
        indexed.dispose();
        geometry.computeBoundingBox();
        const obj = new THREE.Mesh(geometry, materials[part.role]);
        const [ox, oy, oz] = part.offset ?? [0, 0, 0];
        obj.position.set(ox, oy, oz);
        if (geometry.boundingBox) {
          bounds.union(geometry.boundingBox.clone().translate(obj.position));
        }
        group.add(obj);
        objects.push(obj);
      }
      if (bounds.isEmpty()) return;

      // centre the composition over the origin in x, y; the bed (z = 0) stays on the grid
      const center = new THREE.Vector3();
      bounds.getCenter(center);
      group.position.set(-center.x, 0, center.y);
      controls.target.set(0, center.z, 0);

      const size = new THREE.Vector3();
      bounds.getSize(size);
      const radius = size.length() / 2;
      const distance = fitDistance(radius);
      camera.near = Math.max(0.1, distance / 500);
      camera.far = distance * 20;
      camera.updateProjectionMatrix();
      if (Math.abs(radius - fittedRadius) > fittedRadius * 0.15) {
        const direction = camera.position.clone().sub(controls.target).normalize();
        camera.position.copy(controls.target).addScaledVector(direction, distance);
        fittedRadius = radius;
      }
    },

    lookFrom(direction: readonly [number, number, number]): void {
      const dir = new THREE.Vector3(...direction).normalize();
      const distance = camera.position.distanceTo(controls.target);
      camera.position.copy(controls.target).addScaledVector(dir, distance);
      camera.lookAt(controls.target);
      controls.update();
    },

    setCaptions(list: SceneCaption[]): void {
      captionLayer.replaceChildren();
      captions = list.map((caption) => {
        const el = document.createElement('span');
        el.className = caption.dim ? 'port-caption dim' : 'port-caption';
        el.textContent = caption.text;
        captionLayer.append(el);
        return { caption, el, w: 0, h: 0, rect: null };
      });
      // measured once: the frames only move them
      for (const shown of captions) {
        shown.w = shown.el.offsetWidth;
        shown.h = shown.el.offsetHeight;
      }
      placeCaptions();
    },

    captionAt(x: number, y: number): string | null {
      const hit = captions.find(({ rect }) => rect && x >= rect[0] && x <= rect[0] + rect[2] && y >= rect[1] && y <= rect[1] + rect[3]);
      return hit ? hit.caption.key : null;
    },

    shownCaptions(): { key: string; x: number; y: number }[] {
      return captions.flatMap(({ caption, rect }) => (rect ? [{ key: caption.key, x: rect[0] + rect[2] / 2, y: rect[1] + rect[3] / 2 }] : []));
    },

    setXray(on: boolean): void {
      for (const material of [materials.body, materials.lid, materials.screw, materials.clamp]) {
        material.transparent = on;
        material.opacity = on ? 0.35 : 1;
        material.depthWrite = !on;
        material.needsUpdate = true;
      }
    },

    setBottomInset(px: number): void {
      const to = Math.max(0, px);
      if (to === inset.to) return;
      inset = { from: bottomInset, to, start: performance.now() };
    },

    project(points: readonly [number, number, number][]): [number, number][] {
      group.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      return points.map(([x, y, z]) => {
        const v = new THREE.Vector3(x, y, z).applyMatrix4(group.matrixWorld).project(camera);
        return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
      });
    },

    dispose(): void {
      disposed = true;
      controls.dispose();
      clearObjects();
      for (const material of Object.values(materials)) material.dispose();
      renderer.dispose();
    },
  };
}
