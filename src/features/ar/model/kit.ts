import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Toolkit for procedural food: every dish is built from these primitives, in centimetres,
 * with vertex colours (no texture files) so the same model renders on web and Android.
 */

/** One ingredient: what the guest sees in the «разобрать» mode, with where it flies to. */
export interface Part {
  id: string;
  title: string;
  object: THREE.Object3D;
  /** Offset applied at explode = 1. */
  explode: THREE.Vector3;
}

export interface DishModel {
  group: THREE.Group;
  parts: Part[];
  /** Diameter of the footprint on the table, cm (for real-scale AR). */
  footprintCm: number;
  heightCm: number;
  /** Preferred camera elevation, radians (flat dishes look best from above). */
  pitch?: number;
}

export type V3 = THREE.Vector3;

export const col = (hex: number) => new THREE.Color(hex);
export const mix = (a: THREE.Color, b: THREE.Color, t: number) => a.clone().lerp(b, Math.min(1, Math.max(0, t)));

/** Weld seams (drop uv/normals first) so displaced surfaces get smooth normals. */
export function weld(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const m = mergeVertices(g, 1e-4);
  m.computeVertexNormals();
  return m;
}

/** Push every vertex along its normal by f(position, normal) cm. */
export function displace(g: THREE.BufferGeometry, f: (p: V3, n: V3) => number): THREE.BufferGeometry {
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    const d = f(p, n);
    pos.setXYZ(i, p.x + n.x * d, p.y + n.y * d, p.z + n.z * d);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Arbitrary vertex deformation (droop, curl, squash). */
export function deform(g: THREE.BufferGeometry, f: (p: V3) => void): THREE.BufferGeometry {
  const pos = g.getAttribute('position');
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    f(p);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Per-vertex colour from position and normal. */
export function paint(g: THREE.BufferGeometry, f: (p: V3, n: V3) => THREE.Color): THREE.BufferGeometry {
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const colors = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    const c = f(p, n);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Surface of revolution from a [radius, y] profile (bottom → top). */
export function lathe(profile: Array<[number, number]>, segments = 96, step = 0.3): THREE.BufferGeometry {
  // Resample the profile every ~3 mm: vertex colours interpolate along each segment,
  // so a sparse profile would smear a thin rim colour over the whole wall.
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < profile.length; i++) {
    const [r, y] = profile[i];
    if (i > 0) {
      const [r0, y0] = profile[i - 1];
      const n = Math.max(1, Math.ceil(Math.hypot(r - r0, y - y0) / step));
      for (let k = 1; k < n; k++) pts.push(new THREE.Vector2(Math.max(0.0001, r0 + ((r - r0) * k) / n), y0 + ((y - y0) * k) / n));
    }
    pts.push(new THREE.Vector2(Math.max(0.0001, r), y));
  }
  return new THREE.LatheGeometry(pts, segments);
}

export interface FoodMat {
  roughness?: number;
  metalness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  sheen?: number;
  transmission?: number;
  color?: THREE.Color;
  side?: THREE.Side;
  /** 0..1, lower for flat wet layers that would otherwise mirror the sky at grazing angles. */
  specular?: number;
}

/** Physically based food material. Vertex colours carry the look; these knobs carry the feel (glossy sauce vs dry crust). */
export function mat(o: FoodMat = {}): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    vertexColors: !o.color,
    color: o.color ?? 0xffffff,
    roughness: o.roughness ?? 0.7,
    metalness: o.metalness ?? 0,
    clearcoat: o.clearcoat ?? 0,
    clearcoatRoughness: o.clearcoatRoughness ?? 0.2,
    sheen: o.sheen ?? 0,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0xffffff),
    side: o.side ?? THREE.FrontSide,
    specularIntensity: o.specular ?? 1,
  });
}

export function mesh(g: THREE.BufferGeometry, m: THREE.Material, name?: string): THREE.Mesh {
  const x = new THREE.Mesh(g, m);
  x.castShadow = true;
  x.receiveShadow = true;
  if (name) x.name = name;
  return x;
}

/** Scatter small instances (seeds, flecks, sesame) with per-instance transform and colour. */
export function instances(
  g: THREE.BufferGeometry,
  m: THREE.Material,
  items: Array<{ p: V3; q?: THREE.Quaternion; s?: V3 | number; c?: THREE.Color }>,
): THREE.InstancedMesh {
  // Instance colours multiply the vertex colour: give bare geometry a white one.
  if (!g.getAttribute('color')) paint(g, () => new THREE.Color(1, 1, 1));
  const im = new THREE.InstancedMesh(g, m, items.length);
  const mtx = new THREE.Matrix4();
  items.forEach((it, i) => {
    const s = typeof it.s === 'number' ? new THREE.Vector3(it.s, it.s, it.s) : it.s ?? new THREE.Vector3(1, 1, 1);
    mtx.compose(it.p, it.q ?? new THREE.Quaternion(), s);
    im.setMatrixAt(i, mtx);
    if (it.c) im.setColorAt(i, it.c);
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = true;
  return im;
}

export const randomQuat = (rnd: () => number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * Math.PI * 2, rnd() * Math.PI * 2, rnd() * Math.PI * 2));
export const yawQuat = (a: number, tilt = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, a, 0));

/** Point on a disc with sqrt distribution (uniform by area). */
export function inDisc(rnd: () => number, r: number): { x: number; z: number } {
  const a = rnd() * Math.PI * 2;
  const d = Math.sqrt(rnd()) * r;
  return { x: Math.cos(a) * d, z: Math.sin(a) * d };
}

export function part(id: string, title: string, object: THREE.Object3D, explode: [number, number, number]): Part {
  object.name = id;
  return { id, title, object, explode: new THREE.Vector3(...explode) };
}

/** A ceramic plate the dish sits on: anchors scale and catches the eye in AR. */
export function plate(radius: number, tone: THREE.Color, rim: THREE.Color): THREE.Mesh {
  const g = weld(
    lathe(
      [
        [0, 0],
        [radius * 0.62, 0],
        [radius * 0.66, 0.15],
        [radius * 0.72, 0.35],
        [radius * 0.9, 0.55],
        [radius, 0.75],
        [radius * 0.995, 0.85],
        [radius * 0.9, 0.7],
        [radius * 0.72, 0.5],
        [radius * 0.66, 0.42],
        [0, 0.42],
      ],
      128,
    ),
  );
  paint(g, (p) => (Math.hypot(p.x, p.z) > radius * 0.93 && p.y > 0.6 ? rim : tone));
  return mesh(g, mat({ roughness: 0.78, clearcoat: 0.08, clearcoatRoughness: 0.6 }), 'plate');
}
