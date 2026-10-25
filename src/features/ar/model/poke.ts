import * as THREE from 'three';
import { FOOD } from './palette';
import { type DishModel, deform, displace, instances, lathe, mat, mesh, mix, paint, part, randomQuat, weld } from './kit';
import { fbm, mulberry, noise3 } from './noise';

/** The rice fills the bowl to ~1.5 cm below the rim and meets the inner wall (r ≈ 6.95 at y = 4). */
const RICE_R = 6.9;
const RICE_EDGE = 4.0;
const RICE_TOP = 4.75;

/** Height of the rice cushion at distance r from the centre: a gentle dome. */
const riceY = (r: number) => RICE_EDGE + (RICE_TOP - RICE_EDGE) * Math.sqrt(Math.max(0, 1 - (r / RICE_R) ** 2));

function bowl(): THREE.Mesh {
  const g = weld(
    lathe(
      [
        [0, 0],
        [3.4, 0],
        [3.6, 0.45],
        [5.4, 1.3],
        [7.1, 3.4],
        [8.0, 5.7],
        [8.12, 6.0],
        [7.9, 6.08],
        [7.6, 5.6],
        [6.8, 3.6],
        [5.1, 1.9],
        [3.2, 1.05],
        [0, 0.98],
      ],
      128,
    ),
  );
  paint(g, (p, n) => {
    const r = Math.hypot(p.x, p.z);
    if (p.y > 5.5 && r > 7.5) return FOOD.bowlRim;
    const speck = noise3(p.x * 4, p.y * 4, p.z * 4, 81);
    return mix(FOOD.bowl, FOOD.slateEdge, speck * 0.35 + (n.y > 0.3 ? 0.1 : 0));
  });
  return mesh(g, mat({ roughness: 0.55, clearcoat: 0.15, clearcoatRoughness: 0.5, specular: 0.5 }), 'bowl');
}

function rice(rnd: () => number): THREE.Group {
  const dense = new THREE.RingGeometry(0.001, RICE_R, 96, 28);
  dense.rotateX(-Math.PI / 2);
  deform(dense, (p) => {
    p.y = riceY(Math.hypot(p.x, p.z));
  });
  const welded = weld(dense);
  displace(welded, (p) => (noise3(p.x * 4, p.y * 4, p.z * 4, 91) - 0.5) * 0.18);
  paint(welded, (p) => mix(FOOD.rice, FOOD.riceShadow, noise3(p.x * 6, p.y * 6, p.z * 6, 92) * 0.6));
  const grain = new THREE.SphereGeometry(1, 8, 6);
  grain.scale(0.18, 0.08, 0.08);
  const items = Array.from({ length: 420 }, () => {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * (RICE_R - 0.3);
    return { p: new THREE.Vector3(Math.cos(a) * r, riceY(r) + 0.05, Math.sin(a) * r), q: randomQuat(rnd), s: 0.8 + rnd() * 0.4, c: mix(FOOD.rice, FOOD.riceShadow, rnd() * 0.3) };
  });
  const grp = new THREE.Group();
  grp.add(mesh(welded, mat({ roughness: 0.6, sheen: 0.4, specular: 0.5 })), instances(grain, mat({ roughness: 0.4, sheen: 0.5, specular: 0.6 }), items));
  return grp;
}

/** Point on the rice in a sector [a0, a1] (radians) between radii. */
function onRice(rnd: () => number, a0: number, a1: number, r0: number, r1: number) {
  const a = a0 + rnd() * (a1 - a0);
  const r = r0 + rnd() * (r1 - r0);
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: riceY(r), a };
}

function salmonCubes(rnd: () => number): THREE.Group {
  const grp = new THREE.Group();
  for (let i = 0; i < 13; i++) {
    const s = 1.25 + rnd() * 0.3;
    const g = weld(new THREE.BoxGeometry(s, s * 0.85, s, 6, 6, 6));
    // Round the cut edges a little.
    deform(g, (p) => {
      const l = p.length();
      p.multiplyScalar(1 - Math.max(0, l - s * 0.55) * 0.25);
    });
    paint(g, (p) => {
      const stripe = Math.pow(Math.abs(Math.sin((p.x + p.y * 0.7) * 3.4 + i)), 12);
      return mix(mix(FOOD.salmon, FOOD.salmonDeep, fbm(p.x * 2, p.y * 2, p.z * 2, 2, i) * 0.6), FOOD.salmonFat, stripe * 0.8);
    });
    const m = mesh(g, mat({ roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.25, specular: 0.7 }));
    const p = onRice(rnd, -0.2, 1.15, 1.2, 5.6);
    m.position.set(p.x, p.y + s * 0.3, p.z);
    m.quaternion.copy(randomQuat(rnd)).slerp(new THREE.Quaternion(), 0.6);
    grp.add(m);
  }
  return grp;
}

function avocadoFan(): THREE.Group {
  const grp = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    // Crescent cross-section extruded thin: a classic avocado slice.
    // A long crescent: outer edge (former skin side) and inner edge (pit side) as two arches.
    const s = new THREE.Shape();
    const N = 24;
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const x = (t - 0.5) * 6.4;
      const y = 1.55 * Math.sin(Math.PI * t);
      if (k === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    for (let k = N; k >= 0; k--) {
      const t = k / N;
      s.lineTo((t - 0.5) * 6.0, 0.55 * Math.sin(Math.PI * t));
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.36, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.07, bevelSegments: 3 });
    // Darker green along the skin side, buttery yellow-green towards the pit.
    paint(g, (p) => {
      const t = Math.min(1, Math.max(0, (p.x + 3.2) / 6.4));
      const outer = 1.55 * Math.sin(Math.PI * t);
      return mix(FOOD.avocado, FOOD.avocadoDeep, Math.min(1, Math.max(0, 1 - (outer - p.y) / 0.45)));
    });
    const m = mesh(g, mat({ roughness: 0.35, clearcoat: 0.25, specular: 0.6 }));
    // Overlapping fan lying on the rice: yaw first, then lay flat with a slight lean.
    const a = 1.55 + i * 0.09;
    const r = 3.3 + i * 0.12;
    m.rotation.order = 'YXZ';
    m.rotation.set(-Math.PI / 2 + 0.18, -a + Math.PI / 2 + i * 0.12, 0);
    m.position.set(Math.cos(a) * r, riceY(r) + 0.25 + i * 0.06, Math.sin(a) * r);
    m.scale.setScalar(0.8);
    grp.add(m);
  }
  return grp;
}

function scatter(rnd: () => number, n: number, a0: number, a1: number, geom: () => THREE.BufferGeometry, color: (t: number) => THREE.Color, m: THREE.Material, lift: number): THREE.Group {
  const grp = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const g = geom();
    const t = rnd();
    if (!g.getAttribute('color')) paint(g, (p) => mix(color(t), color(1 - t), noise3(p.x * 3, p.y * 3, p.z * 3, i) * 0.4));
    const x = mesh(g, m);
    const p = onRice(rnd, a0, a1, 1.0, 5.8);
    x.position.set(p.x, p.y + lift, p.z);
    x.quaternion.copy(randomQuat(rnd));
    grp.add(x);
  }
  return grp;
}

function sauce(rnd: () => number): THREE.Group {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const a = t * Math.PI * 3.2;
    const r = 1 + t * 4.8;
    pts.push(new THREE.Vector3(Math.cos(a) * r + (rnd() - 0.5) * 0.6, riceY(r) + 0.95 + rnd() * 0.2, Math.sin(a) * r + (rnd() - 0.5) * 0.6));
  }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 300, 0.07, 8, false);
  paint(g, () => FOOD.ponzu);
  const sesame = new THREE.SphereGeometry(1, 8, 5);
  sesame.scale(0.14, 0.05, 0.09);
  const seeds = instances(
    sesame,
    mat({ roughness: 0.4 }),
    Array.from({ length: 110 }, () => {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 6;
      return { p: new THREE.Vector3(Math.cos(a) * r, riceY(r) + 1.0 + rnd() * 0.6, Math.sin(a) * r), q: randomQuat(rnd), c: rnd() < 0.3 ? FOOD.nori : FOOD.sesame };
    }),
  );
  const grp = new THREE.Group();
  grp.add(mesh(g, mat({ roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 })), seeds);
  return grp;
}

/** «Поке с лососем»: salmon, avocado fan, edamame, mango, cucumber over rice, ponzu and sesame. */
export function buildPoke(seed = 37): DishModel {
  const rnd = mulberry(seed);
  const group = new THREE.Group();
  group.add(bowl());
  const veg = (s: number) => mat({ roughness: 0.32 + s, clearcoat: 0.35, specular: 0.6 });
  const items: Array<[string, string, THREE.Object3D, [number, number, number]]> = [
    ['rice', 'Рис', rice(rnd), [0, 0, 0]],
    ['salmon', 'Лосось', salmonCubes(rnd), [2.5, 5, 2]],
    ['avocado', 'Авокадо', avocadoFan(), [-1, 7, 3]],
    [
      'edamame',
      'Эдамаме',
      scatter(rnd, 26, 2.7, 3.7, () => weld(new THREE.SphereGeometry(0.4, 16, 12)).scale(1.35, 0.85, 1), (t) => mix(FOOD.edamame, FOOD.edamameLight, t), veg(0.05), 0.35),
      [-3, 6, 0],
    ],
    [
      'mango',
      'Манго',
      scatter(rnd, 11, 3.8, 4.7, () => weld(new THREE.BoxGeometry(1.05, 1.0, 1.05, 3, 3, 3)), (t) => mix(FOOD.mango, FOOD.mangoDeep, t), veg(0), 0.45),
      [-1.5, 8, -3],
    ],
    [
      'cucumber',
      'Огурец',
      scatter(
        rnd,
        9,
        4.8,
        5.95,
        () => {
          const g = new THREE.CylinderGeometry(0.9, 0.9, 0.25, 24, 1, false, 0, Math.PI);
          return paint(g, (p) => (Math.hypot(p.x, p.z) > 0.8 ? FOOD.cucumberSkin : FOOD.cucumber));
        },
        (t) => mix(FOOD.cucumber, FOOD.pickleSeed, t * 0.3),
        veg(0),
        0.3,
      ),
      [2, 6.5, -3],
    ],
    ['sauce', 'Соус понзу и кунжут', sauce(rnd), [0, 10, 0]],
  ];
  const parts = items.map(([id, title, obj, ex]) => {
    group.add(obj);
    return part(id, title, obj, ex);
  });
  return { group, parts, footprintCm: 17, heightCm: 6.5, pitch: 0.78 };
}
