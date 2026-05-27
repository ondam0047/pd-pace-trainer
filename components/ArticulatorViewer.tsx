"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { GizmoHelper, GizmoViewport, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/* ============================================================
 * Coordinate system (midsagittal plane)
 *   +X anterior (face front, right in default view)
 *   +Y superior (up) ; +Z toward viewer
 * ============================================================ */

type Pt = [number, number];

/* ---------- geometry helpers ---------- */

function shapeFromPoints(points: Pt[]): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  return s;
}

function extrudeGeom(points: Pt[], depth: number, zCenter: number) {
  const bevel = Math.min(0.09, depth * 0.35);
  const g = new THREE.ExtrudeGeometry(shapeFromPoints(points), {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 24,
  });
  g.translate(0, 0, zCenter - depth / 2);
  g.computeVertexNormals();
  return g;
}

/* Apply a vertical (Y) color gradient as vertex colors for fleshy depth. */
function applyVGradient(
  geom: THREE.BufferGeometry,
  yBottom: number,
  yTop: number,
  bottom: string,
  top: string,
) {
  const cB = new THREE.Color(bottom);
  const cT = new THREE.Color(top);
  const pos = geom.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = THREE.MathUtils.clamp((y - yBottom) / (yTop - yBottom), 0, 1);
    tmp.copy(cB).lerp(cT, t);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

type Grad = { yBottom: number; yTop: number; bottom: string; top: string };

/* Anatomical cross-section region: beveled solid + PBR shading. */
function Region({
  points,
  color,
  depth = 0.55,
  zCenter = 0,
  renderOrder = 0,
  opacity = 1,
  transparent = false,
  roughness = 0.62,
  emissive = "#000000",
  emissiveIntensity = 0,
  gradient,
  outline = false,
  outlineColor = "#3f2a20",
  outlineWidth = 2,
}: {
  points: Pt[];
  color: string;
  depth?: number;
  zCenter?: number;
  renderOrder?: number;
  opacity?: number;
  transparent?: boolean;
  roughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  gradient?: Grad;
  outline?: boolean;
  outlineColor?: string;
  outlineWidth?: number;
}) {
  const geom = useMemo(() => {
    const g = extrudeGeom(points, depth, zCenter);
    if (gradient)
      applyVGradient(g, gradient.yBottom, gradient.yTop, gradient.bottom, gradient.top);
    return g;
  }, [points, depth, zCenter, gradient]);
  const linePts = useMemo(
    () =>
      [...points, points[0]].map(
        (p) =>
          [p[0], p[1], zCenter + depth / 2 + 0.01] as [number, number, number],
      ),
    [points, zCenter, depth],
  );
  return (
    <group>
      <mesh geometry={geom} renderOrder={renderOrder} castShadow receiveShadow>
        <meshStandardMaterial
          color={color}
          vertexColors={!!gradient}
          roughness={roughness}
          metalness={0}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          transparent={transparent}
          opacity={opacity}
          depthWrite={!transparent}
          side={THREE.DoubleSide}
        />
      </mesh>
      {outline && (
        <Line
          points={linePts}
          color={outlineColor}
          lineWidth={outlineWidth}
          transparent
          opacity={0.5}
          renderOrder={renderOrder + 1}
        />
      )}
    </group>
  );
}

/* ============================================================
 * Static anatomical outlines (rest pose)
 * ============================================================ */

const SKIN: Pt[] = [
  [-0.2, 3.0],
  [0.9, 3.35],
  [1.8, 3.1],
  [2.3, 2.6],
  [2.55, 2.05],
  [2.45, 1.65],
  [2.55, 1.3],
  [3.05, 1.05],
  [3.2, 0.7],
  [3.0, 0.45],
  [2.7, 0.32],
  [2.62, 0.12],
  [2.78, -0.05],
  [2.74, -0.32],
  [2.62, -0.5],
  [2.74, -0.72],
  [2.66, -1.0],
  [2.4, -1.25],
  [2.0, -1.45],
  [1.45, -1.6],
  [0.85, -1.7],
  [0.5, -1.95],
  [0.42, -2.45],
  [0.42, -2.8],
  [-0.7, -2.85],
  [-0.95, -2.4],
  [-1.0, -1.6],
  [-1.05, -0.4],
  [-1.1, 0.7],
  [-1.12, 1.5],
  [-1.0, 2.2],
  [-0.8, 2.75],
  [-0.5, 3.05],
];

const NASAL: Pt[] = [
  [2.35, 0.62],
  [2.4, 1.0],
  [1.65, 1.5],
  [0.5, 1.6],
  [-0.2, 1.25],
  [-0.32, 0.78],
  [-0.12, 0.6],
  [0.1, 0.82],
  [0.32, 0.58],
  [0.58, 0.85],
  [0.84, 0.58],
  [1.12, 0.86],
  [1.4, 0.58],
  [1.7, 0.84],
  [2.0, 0.6],
  [2.18, 0.72],
];

const HARD_PALATE: Pt[] = [
  [0.25, 0.4],
  [1.0, 0.46],
  [1.9, 0.4],
  [2.12, 0.3],
  [2.12, 0.5],
  [1.9, 0.58],
  [1.0, 0.64],
  [0.25, 0.56],
];

const ORAL_AIRWAY: Pt[] = [
  [2.5, 0.05],
  [1.95, 0.3],
  [1.0, 0.4],
  [0.25, 0.4],
  [-0.32, 0.22],
  [-0.5, -0.4],
  [-0.5, -1.2],
  [-0.42, -1.7],
  [-0.28, -1.95],
  [-0.08, -1.62],
  [0.02, -1.0],
  [0.12, -0.4],
  [0.5, 0.04],
  [1.1, 0.08],
  [1.7, -0.02],
  [2.18, -0.16],
  [2.5, -0.12],
];

const NASAL_AIRWAY: Pt[] = [
  [2.28, 0.6],
  [2.3, 0.66],
  [0.4, 0.62],
  [-0.2, 0.52],
  [-0.4, 0.2],
  [-0.55, 0.2],
  [-0.5, 0.58],
  [-0.22, 0.74],
  [0.4, 0.7],
  [1.5, 0.66],
  [2.2, 0.62],
];

const TONGUE_BODY: Pt[] = [
  [-0.42, -1.0],
  [-0.48, -0.3],
  [-0.32, 0.12],
  [0.2, 0.2],
  [0.8, 0.18],
  [1.25, 0.04],
  [1.32, -0.5],
  [1.0, -0.95],
  [0.2, -1.05],
];

const TONGUE_TIP_PIVOT: Pt = [1.25, 0.0];
const TONGUE_TIP_REL: Pt[] = [
  [0.0, 0.06],
  [0.62, 0.0],
  [0.66, -0.16],
  [0.0, -0.2],
];

const VELUM_HINGE: Pt = [0.25, 0.42];
const VELUM_REL: Pt[] = [
  [0.0, 0.04],
  [-0.25, 0.0],
  [-0.55, -0.12],
  [-0.72, -0.34],
  [-0.55, -0.26],
  [-0.3, -0.14],
  [-0.05, -0.04],
];

const UPPER_LIP: Pt[] = [
  [2.3, 0.12],
  [2.58, 0.14],
  [2.64, -0.02],
  [2.46, -0.06],
  [2.3, 0.0],
];
const LOWER_LIP: Pt[] = [
  [2.3, -0.34],
  [2.5, -0.4],
  [2.6, -0.56],
  [2.42, -0.62],
  [2.3, -0.46],
];
const UPPER_TEETH: Pt[] = [
  [2.0, 0.05],
  [2.18, 0.05],
  [2.18, -0.16],
  [2.0, -0.16],
];
const LOWER_TEETH: Pt[] = [
  [2.0, -0.28],
  [2.18, -0.28],
  [2.18, -0.5],
  [2.0, -0.5],
];
const MANDIBLE: Pt[] = [
  [2.35, -0.6],
  [2.5, -0.75],
  [2.3, -1.15],
  [1.6, -1.35],
  [0.7, -1.4],
  [0.55, -1.15],
  [1.4, -0.9],
  [2.0, -0.78],
];

/* ---------- layer Z stagger (toward +Z = nearer camera) ---------- */
const Z = {
  skin: -0.4,
  nasalAir: -0.06,
  oralAir: -0.04,
  nasal: 0.0,
  hardPalate: 0.06,
  tongue: 0.1,
  mandible: 0.04,
  velum: 0.16,
  teeth: 0.2,
  lips: 0.24,
};

/* ---------- anatomical color palette ---------- */
const C = {
  skin: "#e7b48f",
  skinDeep: "#cf8f6b",
  bone: "#efe1c2",
  nasal: "#a8748a",
  nasalDeep: "#7e5068",
  velum: "#d98890",
  tongue: "#cf7f7a",
  tongueDeep: "#9c4a46",
  tongueTip: "#e2a89e",
  airway: "#bfe6ee",
  lip: "#c75f57",
  teeth: "#fbf6ea",
  mucosaGlow: "#4a1e2a",
  outline: "#3f2a20",
};

/* ============================================================
 * Live (per-frame) articulator state — mutated in place to
 * avoid React re-renders every frame.
 * ============================================================ */
type Live = {
  jawOpen: number;
  lipClosure: number;
  lipProtrusion: number;
  tipY: number;
  tipX: number;
  bodyY: number;
  bodyX: number;
  velumLower: number;
  // airflow
  place: number; // 0 glottis .. 1 lips
  manner: number; // 0 none,1 stop,2 fric,3 nasal,4 approx
  nasal: boolean;
  gesture: number; // 0 open .. 1 full constriction
  airIntensity: number;
};

const makeLive = (): Live => ({
  jawOpen: 0.2,
  lipClosure: 0,
  lipProtrusion: 0,
  tipY: 0,
  tipX: 0,
  bodyY: 0,
  bodyX: 0,
  velumLower: 0,
  place: 1,
  manner: 0,
  nasal: false,
  gesture: 0,
  airIntensity: 0.4,
});

/* ============================================================
 * Movable articulators (read from live ref in their own frame)
 * ============================================================ */

function Velum({ live }: { live: React.RefObject<Live> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current && live.current)
      ref.current.rotation.z =
        -live.current.velumLower * THREE.MathUtils.degToRad(50);
  });
  return (
    <group position={[VELUM_HINGE[0], VELUM_HINGE[1], 0]}>
      <group ref={ref}>
        <Region
          points={VELUM_REL}
          color={C.velum}
          zCenter={Z.velum}
          renderOrder={20}
          roughness={0.5}
          emissive={C.mucosaGlow}
          emissiveIntensity={0.12}
        />
        <mesh position={[-0.72, -0.34, Z.velum]} renderOrder={21} castShadow>
          <sphereGeometry args={[0.075, 18, 18]} />
          <meshStandardMaterial color="#cf6f6a" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

function Tongue({ live }: { live: React.RefObject<Live> }) {
  const bodyRef = useRef<THREE.Group>(null);
  const tipRef = useRef<THREE.Group>(null);
  useFrame(() => {
    const l = live.current;
    if (!l) return;
    if (bodyRef.current) {
      bodyRef.current.position.x = l.bodyX * 0.45;
      bodyRef.current.position.y = l.bodyY * 0.5;
    }
    if (tipRef.current) {
      tipRef.current.rotation.z = l.tipY * 1.3;
      tipRef.current.position.x = l.tipX * 0.3;
    }
  });
  return (
    <group ref={bodyRef}>
      <Region
        points={TONGUE_BODY}
        color={C.tongue}
        zCenter={Z.tongue}
        depth={0.7}
        renderOrder={16}
        roughness={0.5}
        gradient={{
          yBottom: -1.05,
          yTop: 0.2,
          bottom: C.tongueDeep,
          top: C.tongueTip,
        }}
      />
      <group position={[TONGUE_TIP_PIVOT[0], TONGUE_TIP_PIVOT[1], 0]}>
        <group ref={tipRef}>
          <Region
            points={TONGUE_TIP_REL}
            color={C.tongueTip}
            zCenter={Z.tongue + 0.02}
            depth={0.66}
            renderOrder={17}
            roughness={0.5}
          />
        </group>
      </group>
    </group>
  );
}

function LowerJaw({ live }: { live: React.RefObject<Live> }) {
  const jawRef = useRef<THREE.Group>(null);
  const lipRef = useRef<THREE.Group>(null);
  const pivot: Pt = [-1.0, 0.4];
  useFrame(() => {
    const l = live.current;
    if (!l) return;
    if (jawRef.current)
      jawRef.current.rotation.z = -l.jawOpen * THREE.MathUtils.degToRad(15);
    if (lipRef.current) {
      lipRef.current.position.y = l.lipClosure * 0.16;
      lipRef.current.position.x = l.lipProtrusion * 0.16;
    }
  });
  return (
    <group position={[pivot[0], pivot[1], 0]}>
      <group ref={jawRef}>
        <group position={[-pivot[0], -pivot[1], 0]}>
          <Region
            points={MANDIBLE}
            color={C.bone}
            zCenter={Z.mandible}
            renderOrder={14}
            roughness={0.7}
          />
          <Region
            points={LOWER_TEETH}
            color={C.teeth}
            zCenter={Z.teeth}
            depth={0.6}
            renderOrder={22}
            roughness={0.35}
          />
          <group ref={lipRef}>
            <Region
              points={LOWER_LIP}
              color={C.lip}
              zCenter={Z.lips}
              depth={0.62}
              renderOrder={24}
              roughness={0.45}
            />
          </group>
        </group>
      </group>
    </group>
  );
}

function UpperLip({ live }: { live: React.RefObject<Live> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const l = live.current;
    if (ref.current && l) {
      ref.current.position.y = -l.lipClosure * 0.1;
      ref.current.position.x = l.lipProtrusion * 0.16;
    }
  });
  return (
    <group ref={ref}>
      <Region
        points={UPPER_LIP}
        color={C.lip}
        zCenter={Z.lips}
        depth={0.62}
        renderOrder={24}
        roughness={0.45}
      />
    </group>
  );
}

/* ============================================================
 * Airflow particles following the airway centerline
 * ============================================================ */

const ORAL_PATH: THREE.Vector3[] = [
  new THREE.Vector3(-0.3, -1.9, 0.32),
  new THREE.Vector3(-0.46, -1.2, 0.32),
  new THREE.Vector3(-0.46, -0.4, 0.32),
  new THREE.Vector3(-0.3, 0.18, 0.32),
  new THREE.Vector3(0.2, 0.26, 0.32),
  new THREE.Vector3(0.9, 0.1, 0.32),
  new THREE.Vector3(1.6, -0.03, 0.32),
  new THREE.Vector3(2.3, -0.06, 0.32),
  new THREE.Vector3(2.78, -0.06, 0.32),
];

const NASAL_PATH: THREE.Vector3[] = [
  new THREE.Vector3(-0.3, -1.9, 0.3),
  new THREE.Vector3(-0.46, -1.2, 0.3),
  new THREE.Vector3(-0.46, -0.4, 0.3),
  new THREE.Vector3(-0.32, 0.2, 0.3),
  new THREE.Vector3(-0.12, 0.5, 0.3),
  new THREE.Vector3(0.5, 0.66, 0.3),
  new THREE.Vector3(1.4, 0.66, 0.3),
  new THREE.Vector3(2.25, 0.62, 0.3),
  new THREE.Vector3(2.62, 0.6, 0.3),
];

function samplePath(path: THREE.Vector3[], u: number, out: THREE.Vector3) {
  const n = path.length - 1;
  if (u <= 0) {
    out.copy(path[0]);
    return;
  }
  if (u >= 1) {
    const a = path[n - 1];
    const b = path[n];
    out.copy(b).addScaledVector(b.clone().sub(a), (u - 1) * n * 1.2);
    return;
  }
  const seg = u * n;
  const i = Math.floor(seg);
  out.copy(path[i]).lerp(path[i + 1], seg - i);
}

function makeDotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(210,245,255,0.95)");
  g.addColorStop(0.4, "rgba(130,214,230,0.7)");
  g.addColorStop(1, "rgba(130,214,230,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function AirFlow({ live }: { live: React.RefObject<Live> }) {
  const N = 70;
  const pointsRef = useRef<THREE.Points>(null);
  const tex = useMemo(() => makeDotTexture(), []);
  const tArr = useMemo(() => {
    const a = new Float32Array(N);
    for (let i = 0; i < N; i++) a[i] = Math.random() * 1.1;
    return a;
  }, []);
  const latArr = useMemo(() => {
    const a = new Float32Array(N * 2);
    for (let i = 0; i < N * 2; i++) a[i] = (Math.random() - 0.5) * 2;
    return a;
  }, []);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(N * 3), 3),
    );
    return g;
  }, []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const l = live.current;
    if (!l) return;
    const pos = geom.attributes.position as THREE.BufferAttribute;
    const nasalRoute = l.nasal && l.velumLower > 0.4;
    const path = nasalRoute ? NASAL_PATH : ORAL_PATH;
    const stopClosed = l.manner === 1 && l.gesture > 0.55 && !nasalRoute;
    const released = l.manner === 1 && l.gesture < 0.35;
    const baseV = 0.32 * (0.5 + l.airIntensity);
    const speedMul = released ? 1.9 : l.manner === 2 ? 0.85 : 1.0;

    for (let i = 0; i < N; i++) {
      let t = tArr[i] + baseV * speedMul * dt;

      // Stop closure: bunch particles just behind the constriction.
      if (stopClosed && t > l.place - 0.18 && t < l.place + 0.05) {
        t = l.place - 0.05 - latArr[i * 2] * 0.02;
      }
      if (t > 1.12) t = Math.random() * 0.08;
      tArr[i] = t;

      samplePath(path, t, tmp);

      // Turbulence: spread after a fricative constriction or past the lips.
      let spread = 0.015;
      if (l.manner === 2 && t > l.place) spread = 0.05 + 0.06 * l.gesture;
      if (t > 1.0) spread = 0.06 + (t - 1.0) * 0.25; // puff out
      const lx = latArr[i * 2] * spread;
      const lz = latArr[i * 2 + 1] * spread;

      pos.setXYZ(i, tmp.x, tmp.y + lx, tmp.z + lz);
    }
    pos.needsUpdate = true;
    if (pointsRef.current) {
      const mat = pointsRef.current.material as THREE.PointsMaterial;
      mat.opacity = 0.25 + 0.6 * l.airIntensity;
    }
  });

  return (
    <points ref={pointsRef} geometry={geom} renderOrder={40}>
      <pointsMaterial
        map={tex}
        size={0.16}
        transparent
        depthWrite={false}
        sizeAttenuation
        color="#bdeeff"
      />
    </points>
  );
}

/* ============================================================
 * Pose / consonant gesture metadata
 * ============================================================ */

type Target = {
  jawOpen: number;
  lipClosure: number;
  lipProtrusion: number;
  tipY: number;
  tipX: number;
  bodyY: number;
  bodyX: number;
  velumLower: number;
  place: number;
  manner: number; // 0 none,1 stop,2 fric,3 nasal,4 approx
  nasal: boolean;
  air: number; // airflow intensity at full gesture
};

type PoseKey =
  | "idle"
  | "bilabial_stop"
  | "bilabial_nasal"
  | "alveolar_stop"
  | "alveolar_nasal"
  | "alveolar_fric"
  | "alveopalatal"
  | "velar_stop"
  | "velar_nasal"
  | "liquid"
  | "glottal";

const BASE: Target = {
  jawOpen: 0.2,
  lipClosure: 0,
  lipProtrusion: 0,
  tipY: 0,
  tipX: 0,
  bodyY: 0,
  bodyX: 0,
  velumLower: 0,
  place: 1,
  manner: 0,
  nasal: false,
  air: 0.4,
};

const POSES: Record<PoseKey, { label: string; sub: string; t: Target }> = {
  idle: { label: "Idle", sub: "휴지 / 호흡", t: { ...BASE } },
  bilabial_stop: {
    label: "ㅂ · ㅍ · ㅃ",
    sub: "양순 파열음 (파/바)",
    t: { ...BASE, jawOpen: 0.04, lipClosure: 1, lipProtrusion: 0.1, place: 1, manner: 1, air: 0.9 },
  },
  bilabial_nasal: {
    label: "ㅁ",
    sub: "양순 비음 (마)",
    t: { ...BASE, jawOpen: 0.05, lipClosure: 1, lipProtrusion: 0.06, velumLower: 1, place: 1, manner: 3, nasal: true, air: 0.7 },
  },
  alveolar_stop: {
    label: "ㄷ · ㅌ · ㄸ",
    sub: "치조 파열음 (타/다)",
    t: { ...BASE, jawOpen: 0.1, tipY: 0.5, tipX: 0.6, place: 0.82, manner: 1, air: 0.9 },
  },
  alveolar_nasal: {
    label: "ㄴ",
    sub: "치조 비음 (나)",
    t: { ...BASE, jawOpen: 0.1, tipY: 0.5, tipX: 0.6, velumLower: 1, place: 0.82, manner: 3, nasal: true, air: 0.7 },
  },
  alveolar_fric: {
    label: "ㅅ · ㅆ",
    sub: "치조 마찰음 (사)",
    t: { ...BASE, jawOpen: 0.16, tipY: 0.34, tipX: 0.6, place: 0.85, manner: 2, air: 1.0 },
  },
  alveopalatal: {
    label: "ㅈ · ㅊ · ㅉ",
    sub: "치조경구개 파찰음 (자/차)",
    t: { ...BASE, jawOpen: 0.13, tipY: 0.28, bodyY: 0.4, place: 0.72, manner: 2, air: 0.9 },
  },
  velar_stop: {
    label: "ㄱ · ㅋ · ㄲ",
    sub: "연구개 파열음 (카/가)",
    t: { ...BASE, jawOpen: 0.14, bodyY: 0.78, bodyX: -0.5, place: 0.5, manner: 1, air: 0.9 },
  },
  velar_nasal: {
    label: "ㅇ (받침)",
    sub: "연구개 비음 (앙)",
    t: { ...BASE, jawOpen: 0.16, bodyY: 0.7, bodyX: -0.5, velumLower: 1, place: 0.5, manner: 3, nasal: true, air: 0.7 },
  },
  liquid: {
    label: "ㄹ",
    sub: "치조 탄설/설측음 (라)",
    t: { ...BASE, jawOpen: 0.16, tipY: 0.4, tipX: 0.45, place: 0.8, manner: 4, air: 0.6 },
  },
  glottal: {
    label: "ㅎ",
    sub: "성문 마찰음 (하)",
    t: { ...BASE, jawOpen: 0.2, place: 0.06, manner: 2, air: 0.8 },
  },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

/* ============================================================
 * Scene controller — drives the live ref each frame
 * ============================================================ */

type SceneHandle = {
  setPose: (key: PoseKey) => void;
  setPlaying: (p: boolean) => void;
  setRate: (hz: number) => void;
};

const Scene = forwardRef<SceneHandle, { showSkin: boolean }>(function Scene(
  { showSkin },
  ref,
) {
  const live = useRef<Live>(makeLive());
  const target = useRef<Target>({ ...POSES.idle.t });
  const smooth = useRef<Target>({ ...POSES.idle.t });
  const playing = useRef(true);
  const rate = useRef(2.2);
  const cyc = useRef(0);

  useImperativeHandle(ref, () => ({
    setPose: (key) => {
      target.current = { ...POSES[key].t };
    },
    setPlaying: (p) => {
      playing.current = p;
    },
    setRate: (hz) => {
      rate.current = hz;
    },
  }));

  useFrame((_, dt) => {
    const l = live.current;
    const tg = target.current;
    const sm = smooth.current;

    // Smoothly track target metadata when switching consonant.
    const ks = 1 - Math.pow(0.002, dt);
    sm.jawOpen = lerp(sm.jawOpen, tg.jawOpen, ks);
    sm.lipClosure = lerp(sm.lipClosure, tg.lipClosure, ks);
    sm.lipProtrusion = lerp(sm.lipProtrusion, tg.lipProtrusion, ks);
    sm.tipY = lerp(sm.tipY, tg.tipY, ks);
    sm.tipX = lerp(sm.tipX, tg.tipX, ks);
    sm.bodyY = lerp(sm.bodyY, tg.bodyY, ks);
    sm.bodyX = lerp(sm.bodyX, tg.bodyX, ks);
    sm.velumLower = lerp(sm.velumLower, tg.velumLower, ks);
    sm.air = lerp(sm.air, tg.air, ks);
    sm.place = tg.place;
    sm.manner = tg.manner;
    sm.nasal = tg.nasal;

    // Gesture cycle (repeated articulation).
    let g: number;
    if (playing.current && tg.manner !== 0) {
      cyc.current = (cyc.current + dt * rate.current) % 1;
      const tri = cyc.current < 0.5 ? cyc.current / 0.5 : (1 - cyc.current) / 0.5;
      g = smoother(tri);
    } else if (tg.manner === 0) {
      // idle breathing
      cyc.current = (cyc.current + dt * 0.5) % 1;
      g = 0;
    } else {
      g = 1; // paused: hold full constriction
    }

    // Blend articulators between open phase and full constriction.
    l.jawOpen = lerp(0.22, sm.jawOpen, g);
    l.lipClosure = sm.lipClosure * g;
    l.lipProtrusion = sm.lipProtrusion * g;
    l.tipY = sm.tipY * g;
    l.tipX = sm.tipX * g;
    l.bodyY = sm.bodyY * g;
    l.bodyX = sm.bodyX * g;
    l.velumLower = sm.velumLower * g;

    l.place = sm.place;
    l.manner = sm.manner;
    l.nasal = sm.nasal;
    l.gesture = g;

    // Airflow: breathing baseline + bursts on release / continuous on fric.
    let air = 0.3 + 0.15 * Math.sin(cyc.current * Math.PI * 2);
    if (tg.manner === 1) air = 0.25 + sm.air * (1 - g); // stop: flow on release
    else if (tg.manner === 2) air = 0.3 + sm.air * (0.4 + 0.6 * g); // fric: continuous
    else if (tg.manner === 3) air = 0.3 + sm.air * g; // nasal
    else if (tg.manner === 4) air = 0.4 + sm.air * 0.5;
    l.airIntensity = THREE.MathUtils.clamp(air, 0, 1.2);
  });

  return (
    <group>
      {/* Skin / facial tissue — solid back layer of the cut */}
      {showSkin && (
        <Region
          points={SKIN}
          color={C.skin}
          depth={0.95}
          zCenter={Z.skin}
          renderOrder={0}
          roughness={0.85}
          gradient={{
            yBottom: -2.8,
            yTop: 3.0,
            bottom: C.skinDeep,
            top: C.skin,
          }}
        />
      )}

      {/* Nasal mucosa (turbinates) — purplish, faintly glowing */}
      <Region
        points={NASAL}
        color={C.nasal}
        zCenter={Z.nasal}
        renderOrder={8}
        roughness={0.55}
        emissive={C.mucosaGlow}
        emissiveIntensity={0.14}
        gradient={{ yBottom: 0.55, yTop: 1.6, bottom: C.nasalDeep, top: C.nasal }}
      />

      {/* Hard palate (bone) */}
      <Region
        points={HARD_PALATE}
        color={C.bone}
        zCenter={Z.hardPalate}
        renderOrder={10}
        roughness={0.65}
      />

      <Velum live={live} />
      <Tongue live={live} />
      <Region
        points={UPPER_TEETH}
        color={C.teeth}
        zCenter={Z.teeth}
        depth={0.6}
        renderOrder={22}
        roughness={0.35}
      />
      <UpperLip live={live} />
      <LowerJaw live={live} />

      {/* Air space — subtle translucent tint behind the articulators */}
      <Region
        points={ORAL_AIRWAY}
        color={C.airway}
        zCenter={Z.oralAir}
        depth={0.4}
        renderOrder={4}
        transparent
        opacity={0.28}
      />
      <Region
        points={NASAL_AIRWAY}
        color={C.airway}
        zCenter={Z.nasalAir}
        depth={0.4}
        renderOrder={4}
        transparent
        opacity={0.24}
      />

      <AirFlow live={live} />
    </group>
  );
});

/* ============================================================
 * Top-level component
 * ============================================================ */

export default function ArticulatorViewer() {
  const sceneRef = useRef<SceneHandle>(null);
  const [activePose, setActivePose] = useState<PoseKey>("idle");
  const [playing, setPlaying] = useState(true);
  const [rate, setRate] = useState(2.2);
  const [showSkin, setShowSkin] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);

  const applyPose = (key: PoseKey) => {
    setActivePose(key);
    sceneRef.current?.setPose(key);
  };
  useEffect(() => {
    sceneRef.current?.setPose("idle");
    sceneRef.current?.setPlaying(true);
    sceneRef.current?.setRate(2.2);
  }, []);

  const poseOrder: PoseKey[] = [
    "idle",
    "bilabial_stop",
    "bilabial_nasal",
    "alveolar_stop",
    "alveolar_nasal",
    "alveolar_fric",
    "alveopalatal",
    "velar_stop",
    "velar_nasal",
    "liquid",
    "glottal",
  ];

  return (
    <div className="flex h-full min-h-[640px] w-full flex-col gap-3 lg:flex-row">
      <div
        className="relative h-[560px] flex-1 overflow-hidden rounded-2xl shadow-inner lg:h-auto"
        style={{
          background:
            "radial-gradient(circle at 50% 38%, #3b3540 0%, #211d26 55%, #14111a 100%)",
        }}
      >
        <Canvas
          camera={{ position: [0.6, -0.1, 8.2], fov: 34, near: 0.1, far: 100 }}
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true }}
          shadows
        >
          <ambientLight intensity={0.5} />
          <hemisphereLight args={["#fff1e8", "#2a2030", 0.55]} />
          <directionalLight
            position={[3.5, 4.5, 6]}
            intensity={1.15}
            color="#fff2e6"
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <directionalLight position={[-4.5, 1.5, 3]} intensity={0.45} color="#cfe0ff" />
          <pointLight position={[1.8, 0.4, 3.5]} intensity={0.5} color="#ffd9c0" />
          <pointLight position={[0.5, -0.5, -3]} intensity={0.35} color="#ffb59a" />
          <Scene ref={sceneRef} showSkin={showSkin} />
          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            autoRotate={autoRotate}
            autoRotateSpeed={0.6}
            minDistance={3}
            maxDistance={18}
            target={[0.5, -0.2, 0]}
          />
          <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
            <GizmoViewport axisColors={["#ef4444", "#22c55e", "#3b82f6"]} labelColor="#0f172a" />
          </GizmoHelper>
        </Canvas>

        <div className="pointer-events-none absolute left-4 top-4 rounded-md bg-white/70 px-3 py-2 text-xs text-slate-700 backdrop-blur">
          <div className="font-semibold">조작</div>
          <div>· 왼쪽 드래그: 회전 (측면/후면/정면)</div>
          <div>· 휠: 줌 인 / 아웃</div>
          <div>· 오른쪽 드래그: 이동(팬)</div>
        </div>

        <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
          <button
            onClick={() => {
              const np = !playing;
              setPlaying(np);
              sceneRef.current?.setPlaying(np);
            }}
            className="rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white"
          >
            {playing ? "⏸ 정지" : "▶ 재생"}
          </button>
          <label className="flex items-center gap-2 rounded-md bg-white/85 px-2 py-1 text-xs text-slate-700 backdrop-blur">
            속도
            <input
              type="range"
              min={0.8}
              max={4}
              step={0.1}
              value={rate}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setRate(v);
                sceneRef.current?.setRate(v);
              }}
            />
            <span className="w-8 tabular-nums">{rate.toFixed(1)}</span>
          </label>
          <label className="flex items-center gap-2 rounded-md bg-white/85 px-2 py-1 text-xs text-slate-700 backdrop-blur">
            <input type="checkbox" checked={showSkin} onChange={(e) => setShowSkin(e.target.checked)} />
            피부 외형(반투명)
          </label>
          <label className="flex items-center gap-2 rounded-md bg-white/85 px-2 py-1 text-xs text-slate-700 backdrop-blur">
            <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
            자동 회전
          </label>
        </div>
      </div>

      <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm lg:w-80">
        <div>
          <h3 className="text-base font-semibold text-slate-900">자음 산출 (반복 조음)</h3>
          <p className="mt-1 text-xs text-slate-500">
            버튼을 누르면 해당 자음을 반복해서 조음합니다. 혀·입술·연구개가
            실시간으로 움직이고, 기도를 따라 공기가 흐릅니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {poseOrder.map((k) => {
            const p = POSES[k];
            const active = activePose === k;
            return (
              <button
                key={k}
                onClick={() => applyPose(k)}
                className={
                  "rounded-xl border px-3 py-2 text-left transition " +
                  (active
                    ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                    : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100")
                }
              >
                <div className="text-sm font-semibold">{p.label}</div>
                <div className={"mt-0.5 text-[11px] " + (active ? "text-slate-300" : "text-slate-500")}>
                  {p.sub}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-2 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
          <div className="mb-1 font-medium text-slate-700">범례</div>
          <ul className="space-y-1">
            <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: C.airway }} />기도(성도) · 공기 흐름</li>
            <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: C.nasal }} />비강 · 연구개</li>
            <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: C.tongue }} />혀</li>
            <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: C.lip }} />입술</li>
            <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: C.bone }} />경구개 · 하악 · 치아</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
