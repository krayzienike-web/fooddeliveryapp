import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useMemo, useRef } from 'react';
import { PanResponder, Platform, View, type ViewStyle } from 'react-native';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { DishModel } from '@/features/ar/model/kit';
import { E2E } from '@/shared/config/env';

export interface Dish3DProps {
  model: DishModel;
  /** 0 = assembled, 1 = every ingredient lifted apart. Animated. */
  explode: number;
  /** Briefly pop an ingredient (chip tapped): matches a part id or its title (both patties at once). */
  focusId?: string;
  /** «На столе»: camera looks down at the table like a phone held over it. */
  mode?: 'orbit' | 'table';
  style?: ViewStyle;
  testID?: string;
  onReady?: () => void;
}

interface Runtime {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  holder: THREE.Group;
  bases: Map<THREE.Object3D, THREE.Vector3>;
  raf: number;
}

function disposeTree(o: THREE.Object3D) {
  o.traverse((x) => {
    const m = x as THREE.Mesh;
    m.geometry?.dispose?.();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    mats.forEach((mm) => mm.dispose());
  });
}

/**
 * Real-time 3D dish (D3). One renderer for web (WebGL2 canvas) and Android (expo-gl).
 * Transparent background + a shadow catcher, so it composes over camera video in the table mode.
 */
export function Dish3DView({ model, explode, focusId, mode = 'orbit', style, testID, onReady }: Dish3DProps) {
  const rt = useRef<Runtime | null>(null);
  // Orbit state lives in refs: gestures update it at 60 fps without React renders.
  const orbit = useRef({ yaw: 0.6, pitch: 0.42, dist: 1, idleAt: 0, vyaw: 0 });
  const live = useRef({ explode, target: explode, focusId, focusAt: 0, mode });
  live.current.target = explode;
  live.current.mode = mode;
  if (focusId !== live.current.focusId) {
    live.current.focusId = focusId;
    live.current.focusAt = Date.now();
  }
  const modelRef = useRef(model);
  modelRef.current = model;

  const pan = useMemo(() => {
    let last = { x: 0, y: 0 };
    let pinch = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        last = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
        pinch = 0;
        orbit.current.idleAt = Date.now();
      },
      onPanResponderMove: (e) => {
        const t = e.nativeEvent.touches;
        const o = orbit.current;
        o.idleAt = Date.now();
        if (t && t.length >= 2) {
          const d = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
          if (pinch) o.dist = Math.min(2.2, Math.max(0.45, o.dist * (pinch / d)));
          pinch = d;
          return;
        }
        const { pageX, pageY } = e.nativeEvent;
        const dx = pageX - last.x;
        const dy = pageY - last.y;
        last = { x: pageX, y: pageY };
        o.yaw -= dx * 0.01;
        o.vyaw = -dx * 0.01;
        o.pitch = Math.min(1.35, Math.max(0.05, o.pitch + dy * 0.006));
      },
    });
  }, []);

  // Swap the model (e.g. pizza size) without recreating the GL context.
  useEffect(() => {
    if (model.pitch !== undefined) orbit.current.pitch = model.pitch;
    const r = rt.current;
    if (!r) return;
    r.holder.children.slice().forEach((ch) => {
      r.holder.remove(ch);
      disposeTree(ch);
    });
    r.holder.add(model.group);
    r.bases = new Map(model.parts.map((p) => [p.object, p.object.position.clone()]));
  }, [model]);

  useEffect(
    () => () => {
      const r = rt.current;
      if (!r) return;
      cancelAnimationFrame(r.raf);
      disposeTree(r.scene);
      r.renderer.dispose();
      rt.current = null;
    },
    [],
  );

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const canvas =
      Platform.OS === 'web' && (gl as unknown as { canvas?: HTMLCanvasElement }).canvas
        ? (gl as unknown as { canvas: HTMLCanvasElement }).canvas
        : ({ width: w, height: h, style: {}, clientWidth: w, clientHeight: h, addEventListener: () => undefined, removeEventListener: () => undefined } as unknown as HTMLCanvasElement);
    const renderer = new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGL2RenderingContext, antialias: true, alpha: true, premultipliedAlpha: true });
    renderer.setPixelRatio(E2E.lowGl ? 0.5 : 1);
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = !E2E.lowGl;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    try {
      if (E2E.lowGl) throw new Error('skip env in tests');
      const pmrem = new THREE.PMREMGenerator(renderer);
      // Blurred: sharp studio lights in the env map turn flat glossy food (sauce, glaze) into white mirrors.
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.35).texture;
      scene.environmentIntensity = 0.28;
    } catch {
      /* some Android GPUs lack float render targets: the lights below still carry the scene */
    }
    scene.add(new THREE.HemisphereLight(0xfff1e0, 0x2a1a12, 0.55));
    const key = new THREE.DirectionalLight(0xffe2c4, 2.4);
    key.position.set(9, 16, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -16;
    key.shadow.camera.right = 16;
    key.shadow.camera.top = 16;
    key.shadow.camera.bottom = -16;
    key.shadow.radius = 6;
    key.shadow.bias = -0.0005;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xc9dcff, 1.1);
    rim.position.set(-8, 7, -12);
    scene.add(rim);
    const warm = new THREE.PointLight(0xff7a3a, 18, 40, 2);
    warm.position.set(-10, 4, 8);
    scene.add(warm);

    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.38 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.receiveShadow = true;
    scene.add(catcher);

    if (modelRef.current.pitch !== undefined) orbit.current.pitch = modelRef.current.pitch;
    const holder = new THREE.Group();
    scene.add(holder);
    holder.add(modelRef.current.group);

    const camera = new THREE.PerspectiveCamera(32, w / h, 0.5, 400);
    const r: Runtime = { renderer, scene, camera, holder, bases: new Map(modelRef.current.parts.map((p) => [p.object, p.object.position.clone()])), raf: 0 };
    rt.current = r;

    let lastT = Date.now();
    let lastSig = '';
    const frame = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const m = modelRef.current;
      const L = live.current;
      const o = orbit.current;

      // Explode: critically damped follow of the target.
      L.explode += (L.target - L.explode) * Math.min(1, dt * 7);
      const e = L.explode * L.explode * (3 - 2 * L.explode);
      for (const p of m.parts) {
        const base = r.bases.get(p.object);
        if (!base) continue;
        p.object.position.set(base.x + p.explode.x * e, base.y + p.explode.y * e, base.z + p.explode.z * e);
        const pop = L.focusId === p.id || L.focusId === p.title ? Math.max(0, 1 - (now - L.focusAt) / 700) : 0;
        p.object.scale.setScalar(1 + Math.sin(pop * Math.PI) * 0.12);
      }

      // Idle auto-rotation (off in e2e: static frames, snappy software GL); a flick keeps spinning and decays.
      if (!E2E.reducedMotion && now - o.idleAt > 2500) o.yaw += dt * 0.25;
      else if (Math.abs(o.vyaw) > 0.0005 && now - o.idleAt > 60) {
        o.yaw += o.vyaw;
        o.vyaw *= 0.94;
      }

      const radius = Math.max(m.footprintCm * 0.75, m.heightCm * 1.3);
      const lift = m.heightCm * (0.35 + e * 0.5);
      if (L.mode === 'table') {
        // Phone held ~60 cm from the dish and tilted: true scale, whole dish in view; pinch moves closer.
        const d = 60 * o.dist;
        camera.position.set(Math.sin(o.yaw) * d * 0.55, d * 0.83, Math.cos(o.yaw) * d * 0.55);
        camera.lookAt(0, 0, 0);
      } else {
        // Fit both the footprint (horizontal fov on a narrow phone) and the exploded height.
        const vfov = (camera.fov * Math.PI) / 180;
        const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (w / h));
        const fitW = (m.footprintCm * 0.62) / Math.tan(hfov / 2);
        const fitH = ((m.heightCm * (1 + e * 1.6)) * 0.9 + m.footprintCm * 0.25) / Math.tan(vfov / 2);
        const d = Math.max(fitW, fitH, radius * 1.8) * o.dist;
        camera.position.set(Math.sin(o.yaw) * Math.cos(o.pitch) * d, lift + Math.sin(o.pitch) * d, Math.cos(o.yaw) * Math.cos(o.pitch) * d);
        camera.lookAt(0, lift, 0);
      }
      // Table mode matches a phone's main camera (~62° vertical) so the dish overlays video at true size.
      camera.fov = L.mode === 'table' ? 62 : 32;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      // Render on demand: an unchanged frame is skipped (battery on phones, snappy software GL in tests).
      const sig = `${camera.position.x.toFixed(3)},${camera.position.y.toFixed(3)},${camera.position.z.toFixed(3)},${e.toFixed(4)},${L.focusId === undefined ? 0 : now - L.focusAt < 800 ? now : 0},${m.group.uuid},${w}`;
      if (sig !== lastSig) {
        lastSig = sig;
        renderer.render(scene, camera);
        gl.endFrameEXP();
      }
      r.raf = requestAnimationFrame(frame);
    };
    frame();
    onReady?.();
  };

  return (
    <View testID={testID} style={[{ flex: 1 }, style]} {...pan.panHandlers}>
      <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
    </View>
  );
}
