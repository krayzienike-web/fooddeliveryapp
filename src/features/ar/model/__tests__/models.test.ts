import * as THREE from 'three';
import { AR_KINDS, buildDish } from '..';
import { DISHES } from '@/mocks/seed/menu';

const bbox = (o: THREE.Object3D) => {
  o.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(o);
};

describe('procedural AR dishes', () => {
  test('every AR dish in the menu has a model kind we can build', () => {
    const kinds = DISHES.filter((d) => d.arModel).map((d) => d.arModel);
    expect(kinds.sort()).toEqual([...AR_KINDS].sort());
  });

  test.each(AR_KINDS)('%s: builds, has titled ingredients with explode offsets, and is real-scale', (kind) => {
    const m = buildDish(kind);
    expect(m.parts.length).toBeGreaterThanOrEqual(4);
    for (const p of m.parts) {
      expect(p.title.length).toBeGreaterThan(2);
      expect(m.group.getObjectById(p.object.id)).toBeDefined();
    }
    expect(m.parts.some((p) => p.explode.length() > 0)).toBe(true);
    const box = bbox(m.group);
    const size = box.getSize(new THREE.Vector3());
    // Centimetres: a dish with its plate is 15–45 cm across and sits on the table (y ≥ 0).
    expect(Math.max(size.x, size.z)).toBeGreaterThan(15);
    expect(Math.max(size.x, size.z)).toBeLessThan(45);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.5);
    expect(m.footprintCm).toBeGreaterThan(Math.max(size.x, size.z) * 0.6);
  });

  test('every mesh has vertex colours or an explicit colour, and no NaN positions', () => {
    for (const kind of AR_KINDS) {
      buildDish(kind).group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        if (mat.vertexColors) expect(mesh.geometry.getAttribute('color')).toBeDefined();
        const pos = mesh.geometry.getAttribute('position');
        for (let i = 0; i < pos.count; i += 37) expect(Number.isFinite(pos.getY(i))).toBe(true);
      });
    }
  });

  test('pizza diameter follows the size option (25 / 30 / 35 cm)', () => {
    const width = (cm: number) => {
      const m = buildDish('pizza', { sizeCm: cm });
      const dough = m.parts.find((p) => p.id === 'dough')!.object;
      return bbox(dough).getSize(new THREE.Vector3()).x;
    };
    // The puffed rim adds a few millimetres, as a real cornicione does.
    for (const cm of [25, 30, 35]) expect(Math.abs(width(cm) - cm)).toBeLessThan(1);
    expect(width(35) - width(25)).toBeCloseTo(10, 0);
  });

  test('more pepperoni on a bigger pizza; models are deterministic', () => {
    const count = (cm: number) => buildDish('pizza', { sizeCm: cm }).parts.find((p) => p.id === 'pepperoni')!.object.children.length;
    expect(count(35)).toBeGreaterThan(count(25));
    const a = bbox(buildDish('burger').group);
    const b = bbox(buildDish('burger').group);
    expect(a.equals(b)).toBe(true);
  });

  test('the burger stack goes bun → patty → cheese → … → bun, bottom to top', () => {
    const m = buildDish('burger');
    const ys = m.parts.map((p) => p.object.position.y);
    expect([...ys].sort((x, y) => x - y)).toEqual(ys);
    expect(m.parts[0].title).toBe('Булка бриошь');
    expect(m.parts.at(-1)!.title).toBe('Булка бриошь');
  });
});
