import * as THREE from 'three';
import { FOOD } from './palette';
import { type DishModel, deform, displace, inDisc, instances, lathe, mat, mesh, mix, paint, part, plate, weld, yawQuat } from './kit';
import { fbm, mulberry, noise3, spots } from './noise';

/** Radius of a lathe profile at height y (profile must rise in y over the range used). */
function radiusAt(profile: Array<[number, number]>, y: number): number {
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1];
    const [r1, y1] = profile[i];
    if (y >= y0 && y <= y1) return r0 + ((r1 - r0) * (y - y0)) / Math.max(1e-6, y1 - y0);
  }
  return profile[profile.length - 1][0];
}

function crumb(p: THREE.Vector3) {
  const n = fbm(p.x * 2.2, p.y * 2.2, p.z * 2.2, 3, 5);
  const hole = spots(p.x, p.y, p.z, 2.6, 0.62, 9);
  return mix(mix(FOOD.crumb, FOOD.crumbHole, n * 0.5), FOOD.crumbHole, hole * 0.8);
}

function bottomBun(): THREE.Mesh {
  const prof: Array<[number, number]> = [
    [0, 0],
    [4.4, 0],
    [5.0, 0.2],
    [5.3, 0.65],
    [5.28, 1.15],
    [5.05, 1.5],
    [4.6, 1.62],
    [0, 1.64],
  ];
  const g = weld(lathe(prof, 112));
  displace(g, (p) => (fbm(p.x * 0.8, p.y * 0.8, p.z * 0.8, 3, 2) - 0.5) * 0.12);
  paint(g, (p, n) => {
    if (n.y > 0.7 && p.y > 1.45) return crumb(p);
    const t = Math.min(1, p.y / 1.4);
    const mottled = fbm(p.x * 1.4, p.y * 1.4, p.z * 1.4, 3, 3);
    return mix(mix(FOOD.bunPale, FOOD.bunGold, t), FOOD.bunDeep, mottled * 0.35);
  });
  return mesh(g, mat({ roughness: 0.55, sheen: 0.4 }), 'bun-bottom');
}

function topBun(rnd: () => number): THREE.Group {
  const prof: Array<[number, number]> = [
    [0, 0],
    [4.8, 0],
    [5.25, 0.3],
    [5.4, 0.9],
    [5.2, 1.9],
    [4.6, 2.9],
    [3.6, 3.7],
    [2.2, 4.2],
    [0.9, 4.45],
    [0, 4.5],
  ];
  const g = weld(lathe(prof, 128));
  displace(g, (p) => (fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5, 4, 11) - 0.5) * 0.35 + (noise3(p.x * 3.2, p.y * 3.2, p.z * 3.2, 12) - 0.5) * 0.05);
  paint(g, (p, n) => {
    if (n.y < -0.7 && p.y < 0.2) return crumb(p);
    const h = Math.min(1, Math.max(0, (p.y - 0.4) / 3.8));
    const blotch = fbm(p.x * 0.9, p.y * 0.9, p.z * 0.9, 4, 21);
    let c = mix(FOOD.bunGold, FOOD.bunTop, Math.pow(h, 0.8));
    c = mix(c, FOOD.bunDeep, blotch * 0.45 * h);
    // A paler «waist» where the bun rose in the oven.
    const waist = Math.exp(-Math.pow((p.y - 0.9) / 0.35, 2));
    return mix(c, FOOD.bunPale, waist * 0.55);
  });
  const bun = mesh(g, mat({ roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.45, sheen: 0.25 }), 'bun-top');

  // Sesame: seeds lie on the dome, tangent to the surface.
  const seed = new THREE.SphereGeometry(1, 10, 6);
  seed.scale(0.24, 0.07, 0.12);
  const items = Array.from({ length: 74 }, () => {
    const y = 1.6 + Math.pow(rnd(), 0.7) * 2.8;
    const r = radiusAt(prof, y) + 0.06;
    const a = rnd() * Math.PI * 2;
    const p = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    const normal = new THREE.Vector3(p.x, (y - 0.8) * 1.6, p.z).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal).multiply(yawQuat(rnd() * Math.PI));
    return { p, q, s: 0.85 + rnd() * 0.3, c: mix(FOOD.sesame, FOOD.sesameDark, rnd() * 0.5) };
  });
  const seeds = instances(seed, mat({ roughness: 0.4 }), items);
  const grp = new THREE.Group();
  grp.add(bun, seeds);
  return grp;
}

function patty(seed: number): THREE.Mesh {
  const prof: Array<[number, number]> = [
    [0, 0],
    [5.3, 0],
    [5.8, 0.25],
    [5.9, 0.5],
    [5.6, 0.8],
    [0, 0.9],
  ];
  const g = weld(lathe(prof, 160));
  // Smash patties get a lacy, torn rim: strong noise only near the edge.
  displace(g, (p) => {
    const r = Math.hypot(p.x, p.z);
    const edge = Math.max(0, (r - 4.6) / 1.3);
    const lace = (fbm(p.x * 0.6, 0, p.z * 0.6, 3, seed) - 0.5) * 0.75 * edge;
    const surface = (noise3(p.x * 3, p.y * 3, p.z * 3, seed + 3) - 0.5) * 0.08;
    return lace + surface;
  });
  paint(g, (p) => {
    const r = Math.hypot(p.x, p.z);
    const crust = fbm(p.x * 1.6, p.y * 1.6, p.z * 1.6, 4, seed + 7);
    let c = mix(FOOD.beef, FOOD.beefCrust, crust);
    c = mix(c, FOOD.beefChar, Math.max(0, (r - 5.2) / 0.8) * 0.55 + spots(p.x, p.y, p.z, 1.8, 0.7, seed) * 0.35);
    return c;
  });
  return mesh(g, mat({ roughness: 0.58, clearcoat: 0.25, clearcoatRoughness: 0.55 }), 'patty');
}

function cheese(seed: number, yaw: number): THREE.Mesh {
  const g = new THREE.BoxGeometry(9.6, 0.24, 9.6, 48, 1, 48);
  deform(g, (p) => {
    // Rotate the square so corners hang between the previous slice's corners.
    const x = p.x * Math.cos(yaw) - p.z * Math.sin(yaw);
    const z = p.x * Math.sin(yaw) + p.z * Math.cos(yaw);
    p.x = x;
    p.z = z;
    const r = Math.hypot(p.x, p.z);
    const over = Math.max(0, r - 4.9);
    // Melted droop: quadratic sag past the patty edge, wavy so it doesn't look stamped.
    const wave = 0.6 + 0.4 * noise3(p.x * 0.6, 0, p.z * 0.6, seed);
    p.y -= over * over * 0.55 * wave;
    p.x *= 1 - Math.min(0.12, over * 0.05);
    p.z *= 1 - Math.min(0.12, over * 0.05);
  });
  g.computeVertexNormals();
  paint(g, (p) => mix(FOOD.cheddar, FOOD.cheddarDeep, fbm(p.x * 0.8, p.y, p.z * 0.8, 3, seed) * 0.5));
  return mesh(g, mat({ roughness: 0.45, clearcoat: 0.12, clearcoatRoughness: 0.6, sheen: 0.15 }), 'cheese');
}

function sauce(seed: number, radius: number, color: THREE.Color): THREE.Mesh {
  const g = weld(
    lathe(
      [
        [0, 0],
        [radius, 0],
        [radius + 0.15, 0.12],
        [radius, 0.24],
        [0, 0.26],
      ],
      96,
    ),
  );
  displace(g, (p) => (Math.hypot(p.x, p.z) > radius * 0.7 ? (fbm(p.x * 0.7, 0, p.z * 0.7, 3, seed) - 0.5) * 1.4 : 0));
  paint(g, (p) => mix(color, FOOD.sauceDark, fbm(p.x, 0, p.z, 3, seed + 1) * 0.3));
  return mesh(g, mat({ roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 }), 'sauce');
}

function pickles(rnd: () => number): THREE.Group {
  const grp = new THREE.Group();
  const spots3: Array<[number, number]> = [
    [-1.9, -1.1],
    [1.8, -0.9],
    [0.1, 2.0],
  ];
  spots3.forEach(([x, z], i) => {
    const g = new THREE.CylinderGeometry(1.65, 1.65, 0.18, 48, 1);
    deform(g, (p) => {
      const a = Math.atan2(p.z, p.x);
      const r = Math.hypot(p.x, p.z);
      if (r > 1.4) {
        const k = 1 + 0.05 * Math.cos(a * 18);
        p.x *= k;
        p.z *= k;
      }
    });
    paint(g, (p) => {
      const r = Math.hypot(p.x, p.z);
      if (r > 1.45) return FOOD.pickleSkin;
      const seedsRing = Math.exp(-Math.pow((r - 0.75) / 0.18, 2));
      return mix(mix(FOOD.pickleFlesh, FOOD.pickleSkin, (1 - r / 1.45) * 0.15), FOOD.pickleSeed, seedsRing * 0.6);
    });
    const m = mesh(g, mat({ roughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.45 }));
    m.position.set(x, 0.1 + i * 0.03, z);
    m.rotation.set((rnd() - 0.5) * 0.25, rnd() * Math.PI, (rnd() - 0.5) * 0.25);
    grp.add(m);
  });
  return grp;
}

function onions(rnd: () => number): THREE.Group {
  const grp = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const g = new THREE.TorusGeometry(0.7 + rnd() * 0.7, 0.09, 8, 48, Math.PI * (1.2 + rnd() * 0.8));
    g.rotateX(Math.PI / 2);
    g.scale(1, 0.6, 1);
    paint(g, (p) => mix(FOOD.onion, FOOD.onionEdge, Math.max(0, p.y + 0.05) * 6));
    const m = mesh(g, mat({ roughness: 0.3, clearcoat: 0.6 }));
    const { x, z } = inDisc(rnd, 2.8);
    m.position.set(x, 0.12, z);
    m.rotation.y = rnd() * Math.PI * 2;
    grp.add(m);
  }
  return grp;
}

/** «Чизбургер Жар»: two smash patties, double cheddar, pickles, onion, sauce, glossy brioche. */
export function buildBurger(seed = 7): DishModel {
  const rnd = mulberry(seed);
  const group = new THREE.Group();
  const board = plate(10.5, FOOD.plate, FOOD.plateRim);
  group.add(board);

  const base = 0.45;
  const stack: Array<{ id: string; title: string; obj: THREE.Object3D; h: number; lift: number }> = [
    { id: 'bun-bottom', title: 'Булка бриошь', obj: bottomBun(), h: 1.62, lift: 0 },
    { id: 'sauce', title: 'Соус Жар', obj: sauce(4, 4.4, FOOD.sauceZhar), h: 0.2, lift: 1.2 },
    { id: 'patty-1', title: 'Говяжья котлета смэш', obj: patty(31), h: 0.85, lift: 2.4 },
    { id: 'cheese-1', title: 'Чеддер', obj: cheese(5, Math.PI / 4), h: 0.12, lift: 3.4 },
    { id: 'patty-2', title: 'Говяжья котлета смэш', obj: patty(47), h: 0.85, lift: 4.6 },
    { id: 'cheese-2', title: 'Чеддер', obj: cheese(9, 0.1), h: 0.12, lift: 5.6 },
    { id: 'pickles', title: 'Маринованные огурцы', obj: pickles(rnd), h: 0.25, lift: 6.8 },
    { id: 'onion', title: 'Лук', obj: onions(rnd), h: 0.2, lift: 7.8 },
    { id: 'bun-top', title: 'Булка бриошь', obj: topBun(rnd), h: 4.5, lift: 9.4 },
  ];
  let y = base;
  const parts = stack.map((s) => {
    s.obj.position.y = y;
    y += s.h;
    group.add(s.obj);
    return part(s.id, s.title, s.obj, [0, s.lift, 0]);
  });
  // The top bun sits a touch askew — a real burger is never perfectly stacked.
  stack[stack.length - 1].obj.rotation.set(0.04, 0.3, -0.03);
  return { group, parts, footprintCm: 21, heightCm: y };
}
