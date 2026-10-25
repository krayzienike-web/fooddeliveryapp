import * as THREE from 'three';
import { FOOD } from './palette';
import { type DishModel, deform, displace, instances, lathe, mat, mesh, mix, paint, part, weld } from './kit';
import { fbm, mulberry, noise3 } from './noise';

const H = 2.45;
const R_OUT = 1.86;
const R_RICE_IN = 1.14;
const R_NORI_IN = 1.04;

/** Rounded slate board. */
function slate(len: number, wid: number): THREE.Mesh {
  const s = new THREE.Shape();
  const r = 1.2;
  const x = -len / 2;
  const y = -wid / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + len - r, y);
  s.quadraticCurveTo(x + len, y, x + len, y + r);
  s.lineTo(x + len, y + wid - r);
  s.quadraticCurveTo(x + len, y + wid, x + len - r, y + wid);
  s.lineTo(x + r, y + wid);
  s.quadraticCurveTo(x, y + wid, x, y + wid - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.8, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15, bevelSegments: 3, curveSegments: 16 });
  g.rotateX(-Math.PI / 2);
  paint(g, (p, n) => {
    const m = fbm(p.x * 0.35, p.y, p.z * 0.35, 4, 61);
    return n.y > 0.8 ? mix(FOOD.slate, FOOD.slateEdge, m * 0.7) : mix(FOOD.slateEdge, FOOD.slate, m);
  });
  return mesh(g, mat({ roughness: 0.72, clearcoat: 0.1 }), 'slate');
}

/** Rice ring of one piece + loose grains on the cut. */
function rice(rnd: () => number, seed: number): THREE.Group {
  const g = weld(
    lathe(
      [
        [R_RICE_IN, 0],
        [R_OUT - 0.06, 0],
        [R_OUT - 0.04, H + 0.02],
        [R_RICE_IN, H + 0.06],
        [R_RICE_IN, 0],
      ],
      64,
    ),
  );
  displace(g, (p) => (noise3(p.x * 6, p.y * 6, p.z * 6, seed) - 0.5) * 0.08);
  paint(g, (p) => mix(FOOD.rice, FOOD.riceShadow, noise3(p.x * 8, p.y * 8, p.z * 8, seed + 1) * 0.5));
  const ring = mesh(g, mat({ roughness: 0.55, sheen: 0.4, specular: 0.5 }));
  const grain = new THREE.SphereGeometry(1, 8, 6);
  grain.scale(0.16, 0.07, 0.07);
  const items = Array.from({ length: 70 }, () => {
    const a = rnd() * Math.PI * 2;
    const r = R_RICE_IN + 0.05 + rnd() * (R_OUT - R_RICE_IN - 0.15);
    return {
      p: new THREE.Vector3(Math.cos(a) * r, H + 0.05 + rnd() * 0.04, Math.sin(a) * r),
      q: new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.6, rnd() * Math.PI, (rnd() - 0.5) * 0.6)),
      s: 0.8 + rnd() * 0.4,
      c: mix(FOOD.rice, FOOD.riceShadow, rnd() * 0.35),
    };
  });
  const grp = new THREE.Group();
  grp.add(ring, instances(grain, mat({ roughness: 0.4, sheen: 0.5, specular: 0.6 }), items));
  return grp;
}

function salmon(seed: number): THREE.Mesh {
  const g = new THREE.CylinderGeometry(R_OUT, R_OUT, H, 64, 8, true);
  g.translate(0, H / 2, 0);
  displace(g, (p) => (fbm(p.x * 0.9, p.y * 0.9, p.z * 0.9, 3, seed) - 0.5) * 0.18);
  deform(g, (p) => {
    // The slice hugs the rice and tucks under at the bottom.
    const k = 1 - Math.max(0, 0.25 - p.y) * 0.25;
    p.x *= k;
    p.z *= k;
  });
  paint(g, (p) => {
    const a = Math.atan2(p.z, p.x);
    // Fat lines run diagonally across the fillet.
    const stripe = Math.pow(Math.abs(Math.sin(p.y * 2.6 + a * 2.2 + fbm(p.x, p.y, p.z, 2, seed) * 2)), 14);
    const base = mix(FOOD.salmon, FOOD.salmonDeep, fbm(p.x * 1.2, p.y * 1.2, p.z * 1.2, 3, seed + 2) * 0.7);
    return mix(base, FOOD.salmonFat, stripe * 0.85);
  });
  return mesh(g, mat({ roughness: 0.32, clearcoat: 0.45, clearcoatRoughness: 0.25, specular: 0.7, side: THREE.DoubleSide }));
}

function nori(): THREE.Mesh {
  const g = weld(
    lathe(
      [
        [R_NORI_IN, 0],
        [R_RICE_IN, 0],
        [R_RICE_IN, H],
        [R_NORI_IN, H],
        [R_NORI_IN, 0],
      ],
      64,
    ),
  );
  paint(g, () => FOOD.nori);
  return mesh(g, mat({ roughness: 0.6, specular: 0.4 }));
}

function cream(seed: number): THREE.Mesh {
  const g = new THREE.CylinderGeometry(R_NORI_IN, R_NORI_IN, H - 0.06, 40, 4);
  g.translate(0, (H - 0.06) / 2, 0);
  displace(g, (p) => (p.y > H - 0.2 ? (noise3(p.x * 3, 0, p.z * 3, seed) - 0.5) * 0.08 : 0));
  paint(g, (p) => mix(FOOD.creamCheese, FOOD.riceShadow, noise3(p.x * 4, p.y * 4, p.z * 4, seed) * 0.25));
  return mesh(g, mat({ roughness: 0.38, clearcoat: 0.2, sheen: 0.3, specular: 0.5 }));
}

function cucumber(): THREE.Mesh {
  const g = new THREE.BoxGeometry(0.55, H + 0.02, 0.5, 2, 4, 2);
  g.translate(0.38, (H + 0.02) / 2, 0.05);
  paint(g, (p) => (p.x > 0.6 ? FOOD.cucumberSkin : mix(FOOD.cucumber, FOOD.pickleSeed, Math.max(0, 0.2 - Math.abs(p.z - 0.05)) * 2)));
  return mesh(g, mat({ roughness: 0.3, clearcoat: 0.4, specular: 0.6 }));
}

function ginger(rnd: () => number): THREE.Group {
  const grp = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const g = new THREE.CircleGeometry(1.2, 32);
    deform(g, (p) => {
      // Thin pickled slices fold into a loose rose.
      p.z = (p.x * p.x + p.y * p.y) * 0.22 + Math.sin(p.x * 2 + i) * 0.08;
    });
    paint(g, (p) => mix(FOOD.ginger, FOOD.salmonFat, Math.hypot(p.x, p.y) / 1.4));
    const m = mesh(g, mat({ roughness: 0.25, clearcoat: 0.6, specular: 0.6, side: THREE.DoubleSide }));
    m.rotation.set(-Math.PI / 2 + 0.4 + rnd() * 0.5, (i / 6) * Math.PI * 2, 0);
    m.position.set(Math.cos(i) * 0.4, 0.35 + i * 0.08, Math.sin(i) * 0.4);
    grp.add(m);
  }
  return grp;
}

function wasabi(): THREE.Mesh {
  const g = weld(new THREE.SphereGeometry(0.9, 48, 32));
  g.scale(1.1, 0.7, 0.9);
  displace(g, (p) => (fbm(p.x * 1.8, p.y * 1.8, p.z * 1.8, 4, 71) - 0.5) * 0.35 + Math.sin(Math.atan2(p.z, p.x) * 7 + p.y * 4) * 0.04);
  paint(g, (p) => mix(FOOD.wasabi, FOOD.avocadoDeep, fbm(p.x * 2, p.y * 2, p.z * 2, 3, 72) * 0.4));
  return mesh(g, mat({ roughness: 0.65, sheen: 0.4 }));
}

/** Set «Филадельфия»: eight pieces with a real cross-section, ginger and wasabi on slate. */
export function buildRolls(seed = 23): DishModel {
  const rnd = mulberry(seed);
  const group = new THREE.Group();
  group.add(slate(24, 10));
  const base = 0.95;
  const layers = {
    salmon: new THREE.Group(),
    rice: new THREE.Group(),
    nori: new THREE.Group(),
    cream: new THREE.Group(),
    cucumber: new THREE.Group(),
  };
  const xs = [-8.95, -5.05, -1.15, 2.75];
  const zs = [-2.05, 2.05];
  let k = 0;
  for (const z of zs) {
    for (const x of xs) {
      const s = 0.96 + rnd() * 0.08;
      const yaw = rnd() * Math.PI * 2;
      const place = (o: THREE.Object3D) => {
        o.position.set(x + (rnd() - 0.5) * 0.15, 0, z + (rnd() - 0.5) * 0.15);
        o.rotation.y = yaw;
        o.scale.set(s, 0.94 + rnd() * 0.1, s);
        return o;
      };
      // Same transform for every layer of one piece.
      const holder = place(new THREE.Object3D());
      const put = (layer: THREE.Group, o: THREE.Object3D) => {
        o.position.copy(holder.position);
        o.rotation.copy(holder.rotation);
        o.scale.copy(holder.scale);
        layer.add(o);
      };
      put(layers.salmon, salmon(seed + k));
      put(layers.rice, rice(rnd, seed + k * 3));
      put(layers.nori, nori());
      put(layers.cream, cream(seed + k));
      put(layers.cucumber, cucumber());
      k++;
    }
  }
  const sides = new THREE.Group();
  const gin = ginger(rnd);
  gin.position.set(8.2, 0, -1.9);
  const was = wasabi();
  was.position.set(8.5, 0.5, 2.3);
  sides.add(gin, was);

  const all: Array<[string, string, THREE.Object3D, number]> = [
    ['salmon', 'Лосось', layers.salmon, 0],
    ['rice', 'Рис', layers.rice, 3.5],
    ['nori', 'Нори', layers.nori, 6.5],
    ['cream', 'Сливочный сыр', layers.cream, 9],
    ['cucumber', 'Огурец', layers.cucumber, 11.5],
    ['sides', 'Имбирь и васаби', sides, 2],
  ];
  const parts = all.map(([id, title, o, lift]) => {
    o.position.y = base;
    group.add(o);
    return part(id, title, o, [0, lift, 0]);
  });
  return { group, parts, footprintCm: 26, heightCm: base + H, pitch: 0.62 };
}
