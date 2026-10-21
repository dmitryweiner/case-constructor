// The Three.js layer: scene, lights, orbit camera, materials. Takes finished
// buffers from the core and knows nothing about how they were made. The core
// is z-up (printing convention); a group turns it y-up for display. Kept thin:
// vitest never loads it, the smoke does.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SurfaceMesh } from '../geo/surface';

export type PartRole = 'body' | 'lid';

export interface ScenePart {
  role: PartRole;
  mesh: SurfaceMesh;
  /** offset applied on display (a lifted lid), mm, z-up */
  offset?: [number, number, number];
}

export interface SceneHandle {
  setParts(parts: ScenePart[]): void;
  setXray(on: boolean): void;
  dispose(): void;
}

const CLEAR_COLOR = 0x15181c;
const COLORS: Record<PartRole, number> = {
  body: 0x8fa3b8,
  lid: 0xb8c6d4,
};
/** Faces meeting at a sharper angle than this get a hard edge; rounded corners stay smooth. */
const CREASE_ANGLE = (35 * Math.PI) / 180;

export function createScene(canvas: HTMLCanvasElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(CLEAR_COLOR);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 8000);
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
  };

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  const objects: THREE.Mesh[] = [];
  let disposed = false;
  /** size of the model at the last camera fit — so a zoom set by the mouse survives edits */
  let fittedRadius = 0;

  function resize(): void {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  function frame(): void {
    if (disposed) return;
    resize();
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function fitDistance(radius: number): number {
    const vFov = (camera.fov * Math.PI) / 180;
    const aspect = camera.aspect > 0 ? camera.aspect : 1;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
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

    setXray(on: boolean): void {
      for (const material of Object.values(materials)) {
        material.transparent = on;
        material.opacity = on ? 0.35 : 1;
        material.depthWrite = !on;
        material.needsUpdate = true;
      }
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
