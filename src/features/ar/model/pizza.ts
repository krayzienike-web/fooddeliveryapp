import * as THREE from 'three';
import { FOOD } from './palette';
import { type DishModel, deform, displace, inDisc, instances, lathe, mat, mesh, mix, paint, part, randomQuat, weld } from './kit';
import { fbm, mulberry, noise3, spots } from './noise';

/** Wooden serving board, a bit wider than the pizza. */
function board(R: number): THREE.Mesh {
  const r = R + 2.2;
  const g = weld(
    lathe(
      [
        [0, 0],
        [r - 0.4, 0],
        [r, 0.4],
        [r, 1.1],
        [r - 0.4, 1.5],
        [0, 1.5],
      ],
      128,
    ),
  );
  paint(g, (p, n) => {
    if (Math.abs(n.y) < 0.6) return mix(FOOD.woodEdge, FOOD.woodDeep, fbm(p.x, p.y * 4, p.z, 3, 4));
    // Grain runs along x: stretched noise + fine rings.
    const grain = fbm(p.x * 0.08, 0, p.z * 1.3, 4, 8);
    const rings = 0.5 + 0.5 * Math.sin(p.z * 3.1 + grain * 9);
    return mix(FOOD.wood, FOOD.woodDeep, grain * 0.6 + rings * 0.18);
  });
  return mesh(g, mat({ roughness: 0.62, clearcoat: 0.15, clearcoatRoughness: 0.5 }), 'board');
}

function dough(R: number, seed: number): THREE.Mesh {
  const prof: Array<[number, number]> = [
    [0, 0],
    [R - 0.4, 0],
    [R - 0.05, 0.3],
    [R + 0.05, 0.8],
    [R - 0.25, 1.35],
    [R - 0.9, 1.6],
    [R - 1.6, 1.25],
    [R - 2.0, 0.62],
    [R - 2.4, 0.5],
    [0, 0.48],
  ];
  const g = weld(lathe(prof, 192));
  // Cornicione bubbles: blistered puffs on the rim only.
  displace(g, (p) => {
    const r = Math.hypot(p.x, p.z);
    const rim = Math.max(0, Math.min(1, (r - (R - 2.2)) / 1.2));
    const puff = Math.pow(fbm(p.x * 0.45, p.y * 0.45, p.z * 0.45, 4, seed), 1.6) * 0.9;
    return rim * (puff - 0.12) + (noise3(p.x * 2.5, p.y * 2.5, p.z * 2.5, seed + 1) - 0.5) * 0.04;
  });
  paint(g, (p, n) => {
    const r = Math.hypot(p.x, p.z);
    if (n.y < -0.5) {
      // Underside: floured, with oven-floor char spots.
      return mix(mix(FOOD.dough, FOOD.crust, 0.5), FOOD.char, spots(p.x, 0, p.z, 0.6, 0.64, seed + 5) * 0.8);
    }
    const rimTop = Math.min(1, Math.max(0, Math.min(1, (r - (R - 2.0)) / 1.4)) * Math.max(0, p.y - 0.5) * 1.6);
    let c = mix(FOOD.dough, FOOD.crust, Math.min(1, rimTop * 1.4));
    c = mix(c, FOOD.crustDeep, fbm(p.x * 0.7, p.y * 0.7, p.z * 0.7, 3, seed + 2) * rimTop);
    // Leopard spotting: small dark char blisters, the signature of a 400 °C oven.
    return mix(c, FOOD.char, spots(p.x, p.y, p.z, 1.15, 0.7, seed + 9) * Math.min(1, rimTop * 2));
  });
  return mesh(g, mat({ roughness: 0.82, sheen: 0.35 }), 'dough');
}

function sauce(R: number, seed: number): THREE.Mesh {
  const r = R - 1.75;
  const g = new THREE.CircleGeometry(r, 160, 0, Math.PI * 2);
  g.rotateX(-Math.PI / 2);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const d = Math.hypot(x, z);
    const k = d > r * 0.85 ? 1 + (fbm(x * 0.4, 0, z * 0.4, 3, seed) - 0.5) * 0.12 : 1;
    pos.setXYZ(i, x * k, (fbm(x * 0.5, 0, z * 0.5, 3, seed + 2) - 0.5) * 0.08, z * k);
  }
  g.computeVertexNormals();
  paint(g, (p) => mix(FOOD.tomato, FOOD.tomatoDeep, fbm(p.x * 0.7, 0, p.z * 0.7, 3, seed + 3) * 0.6));
  return mesh(g, mat({ roughness: 0.5, clearcoat: 0.1, clearcoatRoughness: 0.5, specular: 0.25 }), 'sauce');
}

function cheese(R: number, seed: number): THREE.Mesh {
  const r = R - 2.05;
  // A finely subdivided disc so the melted surface can pool and blister.
  const dense = new THREE.RingGeometry(0.001, r, 200, 48);
  dense.rotateX(-Math.PI / 2);
  const pos = dense.getAttribute('position');
  const heights: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const d = Math.hypot(x, z);
    const pools = fbm(x * 0.32, 0, z * 0.32, 4, seed);
    const edgeFall = Math.max(0, (d - r * 0.82) / (r * 0.18));
    const h = Math.max(0, 0.06 + (pools - 0.3) * 0.9 - edgeFall * 0.3);
    heights.push(h);
    const k = 1 + (fbm(x * 0.35, 1, z * 0.35, 3, seed + 4) - 0.5) * 0.14 * Math.min(1, edgeFall * 2);
    pos.setXYZ(i, x * k, h, z * k);
  }
  dense.computeVertexNormals();
  let i = 0;
  paint(dense, (p) => {
    const h = heights[i++] ?? 0;
    // Thin cheese lets the sauce show through; thick pools brown into blisters.
    // Sharp transition: red sauce patches through cream cheese, never a pink blend.
    const cover = Math.min(1, Math.max(0, (h - 0.03) / 0.03));
    let c = mix(mix(FOOD.tomato, FOOD.tomatoDeep, 0.3), FOOD.mozzarella, cover);
    c = mix(c, FOOD.mozzBrown, spots(p.x, 0, p.z, 0.9, 0.66, seed + 6) * Math.min(1, h / 0.2) * 0.8);
    return c;
  });
  return mesh(dense, mat({ roughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.5, sheen: 0.2, specular: 0.35 }), 'cheese');
}

function pepperoni(R: number, rnd: () => number): THREE.Group {
  const grp = new THREE.Group();
  const count = Math.round(((R * 2) / 35) ** 2 * 24);
  const maxR = R - 2.9;
  const placed: Array<{ x: number; z: number }> = [];
  for (let tries = 0; placed.length < count && tries < count * 60; tries++) {
    const p = inDisc(rnd, maxR);
    if (placed.every((q) => Math.hypot(q.x - p.x, q.z - p.z) > 3.3)) placed.push(p);
  }
  placed.forEach((p, i) => {
    const s = 0.9 + rnd() * 0.22;
    // Cupped slice: edges curl up in the oven and hold a little pool of orange oil.
    const g = weld(
      lathe(
        [
          [0, 0.08],
          [1.1, 0.1],
          [1.6, 0.18],
          [1.9, 0.42],
          [1.98, 0.6],
          [1.86, 0.66],
          [1.6, 0.42],
          [1.15, 0.24],
          [0, 0.2],
        ],
        64,
      ),
    );
    displace(g, (v) => (noise3(v.x * 1.4 + i, v.y, v.z * 1.4, 77) - 0.5) * 0.12);
    paint(g, (v, n) => {
      const r = Math.hypot(v.x, v.z);
      if (n.y > 0.4 && r < 1.4 && v.y > 0.15) return mix(FOOD.pepperoni, FOOD.pepperoniFat, 0.22 + rnd() * 0.08);
      let c = mix(FOOD.pepperoni, FOOD.pepperoniDeep, Math.max(0, (r - 1.5) / 0.5));
      c = mix(c, FOOD.pepperoniFat, spots(v.x + i, v.y, v.z, 2.4, 0.68, 31) * 0.5);
      return c;
    });
    const m = mesh(g, mat({ roughness: 0.46, clearcoat: 0.25, clearcoatRoughness: 0.35, specular: 0.45 }));
    m.scale.setScalar(s);
    m.position.set(p.x, 0.3 + rnd() * 0.06, p.z);
    m.rotation.set((rnd() - 0.5) * 0.18, rnd() * Math.PI, (rnd() - 0.5) * 0.18);
    grp.add(m);
  });
  return grp;
}

function oregano(R: number, rnd: () => number): THREE.InstancedMesh {
  const g = new THREE.BoxGeometry(0.22, 0.03, 0.12);
  const items = Array.from({ length: Math.round(R * 9) }, () => {
    const p = inDisc(rnd, R - 2.2);
    return { p: new THREE.Vector3(p.x, 0.5, p.z), q: randomQuat(rnd), s: 0.6 + rnd() * 0.8, c: mix(FOOD.herb, FOOD.pickleSkin, rnd()) };
  });
  return instances(g, mat({ roughness: 0.8 }), items);
}

function honey(R: number, rnd: () => number): THREE.Mesh {
  // A zig-zag drizzle across the pizza.
  // Hand-poured: a few loose passes with wobble, thicker where the spoon paused.
  const pts: THREE.Vector3[] = [];
  const passes = 4;
  for (let i = 0; i <= passes * 6; i++) {
    const t = i / (passes * 6);
    const z = (t - 0.5) * (R - 4) * 1.7;
    const half = Math.sqrt(Math.max(0, (R - 4) ** 2 - z * z));
    const x = Math.sin(t * Math.PI * passes) * half * 0.8 + (rnd() - 0.5) * 1.2;
    pts.push(new THREE.Vector3(x, 0.82 + rnd() * 0.08, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const g = new THREE.TubeGeometry(curve, 400, 0.13, 8, false);
  deform(g, (v) => {
    v.y -= 0.06;
  });
  paint(g, () => FOOD.honey);
  return mesh(g, mat({ roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 }), 'honey');
}

/** «Пепперони Жар» at a real diameter (25/30/35 cm): the AR size switch shows true scale on the table. */
export function buildPizza(sizeCm = 35, seed = 11): DishModel {
  const R = sizeCm / 2;
  const rnd = mulberry(seed + sizeCm);
  const group = new THREE.Group();
  group.add(board(R));
  const top = 1.5;
  const items: Array<{ id: string; title: string; obj: THREE.Object3D; y: number; lift: number }> = [
    { id: 'dough', title: 'Тесто на закваске', obj: dough(R, seed), y: top, lift: 0 },
    { id: 'sauce', title: 'Томатный соус', obj: sauce(R, seed), y: top + 0.52, lift: 2.5 },
    { id: 'cheese', title: 'Моцарелла', obj: cheese(R, seed), y: top + 0.56, lift: 5 },
    { id: 'pepperoni', title: 'Пепперони', obj: pepperoni(R, rnd), y: top + 0.62, lift: 7.5 },
    { id: 'oregano', title: 'Орегано', obj: oregano(R, rnd), y: top + 0.3, lift: 9.5 },
    { id: 'honey', title: 'Острый мёд', obj: honey(R, rnd), y: top, lift: 11.5 },
  ];
  const parts = items.map((it) => {
    it.obj.position.y = it.y;
    group.add(it.obj);
    return part(it.id, it.title, it.obj, [0, it.lift, 0]);
  });
  return { group, parts, footprintCm: sizeCm + 4.4, heightCm: top + 2.2, pitch: 0.82 };
}
