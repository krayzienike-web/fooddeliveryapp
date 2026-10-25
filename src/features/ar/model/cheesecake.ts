import * as THREE from 'three';
import { FOOD } from './palette';
import { type DishModel, deform, displace, instances, lathe, mat, mesh, mix, paint, part, weld } from './kit';
import { fbm, mulberry, noise3, spots } from './noise';

const R = 11;
const ANGLE = Math.PI / 3;
const CRUST = 1.0;
const BODY = 4.2;

/** A wedge of a round cake, tip at the origin, opening towards +z. */
function wedge(radius: number, height: number, inset = 0): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const a0 = Math.PI / 2 - ANGLE / 2;
  s.moveTo(0, inset);
  s.absarc(0, 0, radius - inset, a0, a0 + ANGLE, false);
  s.lineTo(0, inset);
  const g = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 3, curveSegments: 64, steps: Math.max(2, Math.round(height * 3)) });
  // Shape lies in XY and extrudes along +Z: stand it up so height is +Y and the arc faces +Z.
  g.rotateX(-Math.PI / 2);
  g.rotateY(Math.PI);
  return g;
}

function crust(seed: number): THREE.Mesh {
  const g = weld(wedge(R, CRUST));
  // Packed crumbs: a rough, lumpy surface.
  displace(g, (p) => (fbm(p.x * 2.4, p.y * 2.4, p.z * 2.4, 3, seed) - 0.5) * 0.16);
  paint(g, (p) => mix(FOOD.graham, FOOD.grahamDeep, fbm(p.x * 3, p.y * 3, p.z * 3, 3, seed + 1) * 0.8));
  return mesh(g, mat({ roughness: 0.85, sheen: 0.3 }), 'crust');
}

function body(seed: number): THREE.Mesh {
  const g = weld(wedge(R - 0.1, BODY));
  displace(g, (p) => (noise3(p.x * 1.5, p.y * 1.5, p.z * 1.5, seed) - 0.5) * 0.05);
  paint(g, (p, n) => {
    const r = Math.hypot(p.x, p.z);
    // Baked top and outer skin, creamy cut faces with tiny air bubbles.
    if (n.y > 0.7 && p.y > BODY - 0.3) return mix(FOOD.cheesecakeTop, FOOD.graham, fbm(p.x * 0.8, 0, p.z * 0.8, 3, seed) * 0.35);
    const skin = r > R - 0.6 && Math.abs(n.y) < 0.6;
    const base = skin ? mix(FOOD.cheesecake, FOOD.cheesecakeTop, 0.55) : FOOD.cheesecake;
    const bubble = spots(p.x, p.y, p.z, 5.5, 0.72, seed + 3);
    return mix(base, FOOD.riceShadow, bubble * 0.45 + (1 - p.y / BODY) * 0.06);
  });
  return mesh(g, mat({ roughness: 0.55, sheen: 0.35, specular: 0.5 }), 'body');
}

function sauce(seed: number, rnd: () => number): THREE.Group {
  const grp = new THREE.Group();
  // A glossy layer on top, set back from the edges.
  const g = weld(wedge(R - 0.5, 0.28, 0.6));
  displace(g, (p) => (p.y > 0.2 ? (fbm(p.x * 0.8, 0, p.z * 0.8, 3, seed) - 0.5) * 0.25 : 0));
  paint(g, (p) => mix(FOOD.berry, FOOD.berryGloss, fbm(p.x * 1.4, 0, p.z * 1.4, 3, seed + 1)));
  grp.add(mesh(g, mat({ roughness: 0.42, clearcoat: 0.12, clearcoatRoughness: 0.35, specular: 0.22 }), 'sauce-top'));
  // Drips down the curved outer face.
  // Three uneven drips: a real sauce never runs in a neat row.
  const spots3 = [-0.33, -0.05, 0.27];
  for (let i = 0; i < spots3.length; i++) {
    const a = spots3[i] * ANGLE + (rnd() - 0.5) * 0.08;
    const len = [1.1, 2.3, 0.7][i] + rnd() * 0.4;
    const pts = [0, 0.3, 0.7, 1].map((t) => new THREE.Vector3(Math.sin(a) * (R + 0.05 + Math.sin(t * Math.PI) * 0.1), 0.15 - t * len, Math.cos(a) * (R + 0.05 + Math.sin(t * Math.PI) * 0.1)));
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.26, 10, false);
    // Taper towards the tip and end in a round bead.
    deform(tube, (p) => {
      const t = Math.min(1, Math.max(0, (0.15 - p.y) / len));
      const k = 1 - t * 0.35;
      const cx = Math.sin(a) * (R + 0.05);
      const cz = Math.cos(a) * (R + 0.05);
      p.x = cx + (p.x - cx) * k;
      p.z = cz + (p.z - cz) * k;
    });
    paint(tube, () => FOOD.berryGloss);
    const bead = new THREE.SphereGeometry(0.2, 12, 10);
    paint(bead, () => FOOD.berryGloss);
    const bm = mesh(bead, mat({ roughness: 0.08, clearcoat: 1 }));
    bm.position.copy(pts[pts.length - 1]).add(new THREE.Vector3(0, -0.08, 0));
    grp.add(mesh(tube, mat({ roughness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.1, specular: 0.5 })), bm);
  }
  return grp;
}

function blueberry(rnd: () => number): THREE.Mesh {
  const g = weld(new THREE.SphereGeometry(0.55, 32, 24));
  // Squat sphere with the little star-shaped crown on top.
  deform(g, (p) => {
    p.y *= 0.85;
    const r = Math.hypot(p.x, p.z);
    if (p.y > 0.35 && r < 0.22) p.y -= (0.22 - r) * 0.6;
  });
  paint(g, (p) => mix(FOOD.blueberry, FOOD.blueberryBloom, noise3(p.x * 5, p.y * 5, p.z * 5, Math.floor(rnd() * 100)) * 0.55));
  return mesh(g, mat({ roughness: 0.55, sheen: 0.8, specular: 0.5 }));
}

function raspberry(rnd: () => number): THREE.Group {
  const grp = new THREE.Group();
  const drupe = new THREE.SphereGeometry(0.17, 12, 10);
  const items = [];
  // Drupelets packed on a slightly conical dome.
  for (let ring = 0; ring < 6; ring++) {
    const y = ring * 0.18;
    const rr = 0.55 * Math.sqrt(1 - (ring / 6.3) ** 2);
    const n = Math.max(3, Math.round(rr * 14));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + ring * 0.4;
      items.push({ p: new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr), s: 0.9 + rnd() * 0.25, c: mix(FOOD.raspberry, FOOD.berry, rnd() * 0.4) });
    }
  }
  grp.add(instances(drupe, mat({ roughness: 0.25, clearcoat: 0.6, specular: 0.7 }), items));
  return grp;
}

function mint(): THREE.Mesh {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.7, 0.6, 0, 1.6);
  s.quadraticCurveTo(-0.7, 0.6, 0, 0);
  const g = new THREE.ShapeGeometry(s, 16);
  deform(g, (p) => {
    p.z = Math.abs(p.x) * 0.35 + Math.sin(p.y * 6) * 0.03;
  });
  paint(g, (p) => mix(FOOD.mint, FOOD.herb, Math.abs(p.x) * 1.2));
  const m = mesh(g, mat({ roughness: 0.4, clearcoat: 0.3, side: THREE.DoubleSide }));
  return m;
}

/** «Чизкейк Нью-Йорк»: a slice with crumb base, baked top, berry sauce running down, fresh berries and mint. */
export function buildCheesecake(seed = 53): DishModel {
  const rnd = mulberry(seed);
  const group = new THREE.Group();
  const plate = weld(
    lathe(
      [
        [0, 0],
        [9, 0],
        [9.6, 0.18],
        [11.5, 0.5],
        [13, 0.85],
        [12.9, 0.98],
        [11.4, 0.66],
        [9.5, 0.42],
        [0, 0.4],
      ],
      128,
    ),
  );
  paint(plate, (p) => (Math.hypot(p.x, p.z) > 12.4 ? FOOD.plateLightRim : FOOD.plateLight));
  group.add(mesh(plate, mat({ roughness: 0.3, clearcoat: 0.4, specular: 0.6 }), 'plate'));

  // Served tip-first: the guest sees the cut face, the crumb base and the sauce running down the back.
  const slice = new THREE.Group();
  slice.position.set(0.5, 0.42, 4.2);
  slice.rotation.y = Math.PI + 0.35;
  group.add(slice);
  const c = crust(seed);
  const b = body(seed);
  b.position.y = CRUST;
  const s = sauce(seed, rnd);
  s.position.y = CRUST + BODY - 0.02;
  const berries = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const bb = blueberry(rnd);
    bb.position.set(-4.6 + i * 1.25 + rnd() * 0.3, 0.9, 6.4 + rnd() * 1.2 - i * 0.5);
    berries.add(bb);
  }
  const r1 = raspberry(rnd);
  r1.position.set(-2.4, 0.47, 7.9);
  const r2 = raspberry(rnd);
  r2.position.set(-5.6, 0.47, 4.8);
  const leaf = mint();
  leaf.position.set(-3.2, 0.95, 6.2);
  leaf.rotation.set(-1.35, 0.9, 0);
  berries.add(r1, r2, leaf);
  slice.add(c, b, s);
  group.add(berries);

  const parts = [
    part('crust', 'Песочная основа', c, [0, 0, 0]),
    part('body', 'Сливочный сыр', b, [0, 4, 0]),
    part('sauce', 'Ягодный соус', s, [0, 8, 0]),
    part('berries', 'Ягоды и мята', berries, [0, 10.5, 0]),
  ];
  return { group, parts, footprintCm: 26, heightCm: 0.42 + CRUST + BODY + 0.6, pitch: 0.5 };
}
