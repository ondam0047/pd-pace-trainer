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
import {
  GizmoHelper,
  GizmoViewport,
  Line,
  OrbitControls,
  Stats,
} from "@react-three/drei";
import * as THREE from "three";

/* ============================================================
 * Coordinate system (midsagittal plane = Z 0)
 *   +X anterior (face front, right in default view)
 *   -X posterior (spine, left)
 *   +Y superior (up)
 *   +Z toward viewer (slab depth)
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
  const g = new THREE.ExtrudeGeometry(shapeFromPoints(points), {
    depth,
    bevelEnabled: false,
    curveSegments: 10,
  });
  g.translate(0, 0, zCenter - depth / 2);
  g.computeVertexNormals();
  return g;
}

/* A flat cross-section region: filled slab + 2D outline on the front face. */
function Region({
  points,
  color,
  depth = 0.45,
  zCenter = 0,
  renderOrder = 0,
  opacity = 1,
  transparent = false,
  outline = true,
  outlineColor = "#5b3a2e",
  outlineWidth = 1.4,
}: {
  points: Pt[];
  color: string;
  depth?: number;
  zCenter?: number;
  renderOrder?: number;
  opacity?: number;
  transparent?: boolean;
  outline?: boolean;
  outlineColor?: string;
  outlineWidth?: number;
}) {
  const geom = useMemo(
    () => extrudeGeom(points, depth, zCenter),
    [points, depth, zCenter],
  );
  const linePts = useMemo(
    () =>
      [...points, points[0]].map(
        (p) => [p[0], p[1], zCenter + depth / 2 + 0.001] as [number, number, number],
      ),
    [points, zCenter, depth],
  );
  return (
    <group>
      <mesh geometry={geom} renderOrder={renderOrder}>
        <meshStandardMaterial
          color={color}
          roughness={0.85}
          metalness={0}
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
          renderOrder={renderOrder + 1}
        />
      )}
    </group>
  );
}

/* ============================================================
 * Static anatomical outlines (rest pose) — point arrays
 * ============================================================ */

// Skin / facial profile (transparent envelope)
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
  [0.42, -2.95],
  [-1.05, -3.0],
  [-1.5, -2.5],
  [-1.62, -1.6],
  [-1.66, -0.4],
  [-1.78, 0.7],
  [-1.8, 1.5],
  [-1.66, 2.2],
  [-1.4, 2.75],
  [-0.85, 3.08],
];

// Cervical vertebrae blocks (posterior)
const VERT_X0 = -1.5;
const VERT_X1 = -0.95;
const VERT_TOP = 1.55;
const VERT_H = 0.52;
const VERT_GAP = 0.16;
const VERT_COUNT = 6;

// Nasal cavity soft tissue (pink) with turbinate waves on the floor
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

// Hard palate (bone) — thin band
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

// Oral + pharyngeal airway (cyan) at rest
const ORAL_AIRWAY: Pt[] = [
  [2.5, 0.05],
  [1.95, 0.3],
  [1.0, 0.4],
  [0.25, 0.4],
  [-0.32, 0.22],
  [-0.55, -0.4],
  [-0.6, -1.2],
  [-0.52, -1.7],
  [-0.32, -1.92],
  [-0.08, -1.62],
  [0.02, -1.0],
  [0.12, -0.4],
  [0.5, 0.04],
  [1.1, 0.08],
  [1.7, -0.02],
  [2.18, -0.16],
  [2.5, -0.12],
];

// Nasal airway strip (cyan) — velopharyngeal channel, revealed when velum lowers
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

// Tongue body (rest)
const TONGUE_BODY: Pt[] = [
  [-0.45, -1.0],
  [-0.5, -0.3],
  [-0.32, 0.12],
  [0.2, 0.2],
  [0.8, 0.18],
  [1.25, 0.04],
  [1.32, -0.5],
  [1.0, -0.95],
  [0.2, -1.05],
];

// Tongue tip (rest) — relative to pivot, drawn in tip group
const TONGUE_TIP_PIVOT: Pt = [1.25, 0.0];
const TONGUE_TIP_REL: Pt[] = [
  [0.0, 0.06],
  [0.62, 0.0],
  [0.66, -0.16],
  [0.0, -0.2],
];

// Soft palate (rest, raised) — relative to hinge
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

// Lips (rest)
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

// Teeth
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

// Epiglottis
const EPIGLOTTIS: Pt[] = [
  [-0.3, -1.72],
  [-0.16, -1.4],
  [-0.04, -1.5],
  [-0.18, -1.78],
];

// Larynx cartilage
const LARYNX: Pt[] = [
  [-0.5, -1.85],
  [-0.18, -1.85],
  [-0.12, -2.45],
  [-0.5, -2.45],
];

// Mandible (lower jaw bone) — part of lower-jaw group
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

/* ---------- layer Z stagger (toward +Z = nearer default camera) ---------- */
const Z = {
  skin: -0.05,
  vertebrae: 0.0,
  nasalAir: 0.02,
  nasal: 0.05,
  oralAir: 0.04,
  hardPalate: 0.08,
  velum: 0.16,
  tongue: 0.12,
  larynx: 0.1,
  epiglottis: 0.14,
  teeth: 0.2,
  lips: 0.24,
  mandible: 0.18,
};

/* ---------- colors (matched to reference diagram) ---------- */
const C = {
  skin: "#e9c6a6",
  bone: "#efe1c6",
  vertebra: "#ecdcbe",
  nasal: "#e7a0a6",
  velum: "#e58f97",
  tongue: "#e09a9a",
  airway: "#84d6e2",
  lip: "#cf6258",
  teeth: "#fbf7ee",
  larynx: "#f0e2c8",
  vocalFold: "#ffffff",
  outline: "#6b4636",
};

/* ============================================================
 * Movable groups
 * ============================================================ */

function relTo(points: Pt[], pivot: Pt): Pt[] {
  return points.map(([x, y]) => [x - pivot[0], y - pivot[1]]);
}

function Velum({ lower }: { lower: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.z = -lower * THREE.MathUtils.degToRad(48);
  });
  return (
    <group position={[VELUM_HINGE[0], VELUM_HINGE[1], 0]}>
      <group ref={ref}>
        <Region
          points={VELUM_REL}
          color={C.velum}
          zCenter={Z.velum}
          renderOrder={20}
          outlineColor={C.outline}
        />
        {/* Uvula tip */}
        <mesh position={[-0.72, -0.34, Z.velum]} renderOrder={21}>
          <sphereGeometry args={[0.07, 14, 14]} />
          <meshStandardMaterial color="#d2685a" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

function Tongue({
  bodyX,
  bodyY,
  tipY,
  tipX,
}: {
  bodyX: number;
  bodyY: number;
  tipY: number;
  tipX: number;
}) {
  const bodyRef = useRef<THREE.Group>(null);
  const tipRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (bodyRef.current) {
      bodyRef.current.position.x = bodyX * 0.45;
      bodyRef.current.position.y = bodyY * 0.5;
    }
    if (tipRef.current) {
      tipRef.current.rotation.z = tipY * 1.3;
      tipRef.current.position.x = tipX * 0.3;
    }
  });
  return (
    <group ref={bodyRef}>
      <Region
        points={TONGUE_BODY}
        color={C.tongue}
        zCenter={Z.tongue}
        renderOrder={16}
        outlineColor={C.outline}
      />
      <group position={[TONGUE_TIP_PIVOT[0], TONGUE_TIP_PIVOT[1], 0]}>
        <group ref={tipRef}>
          <Region
            points={TONGUE_TIP_REL}
            color={C.tongue}
            zCenter={Z.tongue + 0.005}
            renderOrder={17}
            outlineColor={C.outline}
          />
        </group>
      </group>
    </group>
  );
}

function LowerJaw({
  jawOpen,
  lipClosure,
  lipProtrusion,
}: {
  jawOpen: number;
  lipClosure: number;
  lipProtrusion: number;
}) {
  const jawRef = useRef<THREE.Group>(null);
  const lipRef = useRef<THREE.Group>(null);
  const pivot: Pt = [-1.4, 0.4];
  useFrame(() => {
    if (jawRef.current)
      jawRef.current.rotation.z = -jawOpen * THREE.MathUtils.degToRad(16);
    if (lipRef.current) {
      lipRef.current.position.y = lipClosure * 0.16;
      lipRef.current.position.x = lipProtrusion * 0.16;
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
            outlineColor={C.outline}
          />
          <Region
            points={LOWER_TEETH}
            color={C.teeth}
            zCenter={Z.teeth}
            renderOrder={22}
            outlineColor="#cbb9a0"
            outlineWidth={1}
          />
          <group ref={lipRef}>
            <Region
              points={LOWER_LIP}
              color={C.lip}
              zCenter={Z.lips}
              renderOrder={24}
              outlineColor="#8a3d36"
            />
          </group>
        </group>
      </group>
    </group>
  );
}

function UpperLip({
  lipClosure,
  lipProtrusion,
}: {
  lipClosure: number;
  lipProtrusion: number;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) {
      ref.current.position.y = -lipClosure * 0.1;
      ref.current.position.x = lipProtrusion * 0.16;
    }
  });
  return (
    <group ref={ref}>
      <Region
        points={UPPER_LIP}
        color={C.lip}
        zCenter={Z.lips}
        renderOrder={24}
        outlineColor="#8a3d36"
      />
    </group>
  );
}

/* ============================================================
 * Static pieces
 * ============================================================ */

function Vertebrae() {
  const items = useMemo(() => {
    const arr: Pt[][] = [];
    for (let i = 0; i < VERT_COUNT; i++) {
      const top = VERT_TOP - i * (VERT_H + VERT_GAP);
      const bot = top - VERT_H;
      arr.push([
        [VERT_X0, top],
        [VERT_X1, top],
        [VERT_X1, bot],
        [VERT_X0, bot],
      ]);
    }
    return arr;
  }, []);
  return (
    <group>
      {items.map((pts, i) => (
        <Region
          key={i}
          points={pts}
          color={C.vertebra}
          zCenter={Z.vertebrae}
          renderOrder={2}
          outlineColor={C.outline}
          outlineWidth={1.1}
        />
      ))}
    </group>
  );
}

function FricationStream({ amount }: { amount: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const particles = useMemo(() => {
    const arr: { phase: number; r: number; y: number }[] = [];
    for (let i = 0; i < 14; i++) {
      arr.push({
        phase: Math.random() * Math.PI * 2,
        r: 0.03 + Math.random() * 0.04,
        y: (Math.random() - 0.5) * 0.05,
      });
    }
    return arr;
  }, []);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    if (groupRef.current) {
      groupRef.current.visible = amount > 0.05;
      groupRef.current.scale.setScalar(0.5 + amount * 0.8);
    }
  });
  return (
    <group ref={groupRef} position={[2.55, -0.1, Z.lips + 0.05]}>
      {particles.map((p, i) => {
        const tt = (t.current * 1.6 + p.phase) % 1;
        const x = tt * 0.6;
        const y = p.y + Math.sin(t.current * 5 + p.phase) * 0.03;
        return (
          <mesh key={i} position={[x, y, 0]}>
            <sphereGeometry args={[p.r, 8, 8]} />
            <meshBasicMaterial
              color="#5fc4e8"
              transparent
              opacity={Math.max(0, amount * (1 - tt))}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/* ============================================================
 * Pose model
 * ============================================================ */

type Pose = {
  jawOpen: number;
  lipClosure: number;
  lipProtrusion: number;
  tongueTipY: number;
  tongueTipX: number;
  tongueBodyY: number;
  tongueBodyX: number;
  velumLower: number;
  frication: number;
};

const IDLE_POSE: Pose = {
  jawOpen: 0.12,
  lipClosure: 0,
  lipProtrusion: 0,
  tongueTipY: 0,
  tongueTipX: 0,
  tongueBodyY: 0,
  tongueBodyX: 0,
  velumLower: 0,
  frication: 0,
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

const POSES: Record<PoseKey, { label: string; sub: string; pose: Pose }> = {
  idle: { label: "Idle", sub: "휴지 자세", pose: IDLE_POSE },
  bilabial_stop: {
    label: "ㅂ · ㅍ · ㅃ",
    sub: "양순 파열음",
    pose: { ...IDLE_POSE, jawOpen: 0.03, lipClosure: 1, lipProtrusion: 0.1 },
  },
  bilabial_nasal: {
    label: "ㅁ",
    sub: "양순 비음",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.04,
      lipClosure: 1,
      lipProtrusion: 0.06,
      velumLower: 1,
    },
  },
  alveolar_stop: {
    label: "ㄷ · ㅌ · ㄸ",
    sub: "치조 파열음",
    pose: { ...IDLE_POSE, jawOpen: 0.1, tongueTipY: 0.5, tongueTipX: 0.6 },
  },
  alveolar_nasal: {
    label: "ㄴ",
    sub: "치조 비음",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.1,
      tongueTipY: 0.5,
      tongueTipX: 0.6,
      velumLower: 1,
    },
  },
  alveolar_fric: {
    label: "ㅅ · ㅆ",
    sub: "치조 마찰음",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.16,
      tongueTipY: 0.34,
      tongueTipX: 0.6,
      frication: 1,
    },
  },
  alveopalatal: {
    label: "ㅈ · ㅊ · ㅉ",
    sub: "치조경구개 파찰음",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.13,
      tongueTipY: 0.28,
      tongueBodyY: 0.4,
      frication: 0.6,
    },
  },
  velar_stop: {
    label: "ㄱ · ㅋ · ㄲ",
    sub: "연구개 파열음",
    pose: { ...IDLE_POSE, jawOpen: 0.14, tongueBodyY: 0.78, tongueBodyX: -0.5 },
  },
  velar_nasal: {
    label: "ㅇ (받침)",
    sub: "연구개 비음",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.16,
      tongueBodyY: 0.7,
      tongueBodyX: -0.5,
      velumLower: 1,
    },
  },
  liquid: {
    label: "ㄹ",
    sub: "치조 탄설/설측음",
    pose: { ...IDLE_POSE, jawOpen: 0.16, tongueTipY: 0.4, tongueTipX: 0.45 },
  },
  glottal: {
    label: "ㅎ",
    sub: "성문 마찰음",
    pose: { ...IDLE_POSE, jawOpen: 0.2, frication: 0.5 },
  },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ============================================================
 * Scene with smooth interpolation
 * ============================================================ */

type SceneHandle = { setPose: (key: PoseKey) => void };

const Scene = forwardRef<SceneHandle, { idleBreath: boolean; showSkin: boolean }>(
  function Scene({ idleBreath, showSkin }, ref) {
    const targetRef = useRef<Pose>({ ...IDLE_POSE });
    const currentRef = useRef<Pose>({ ...IDLE_POSE });
    const breathT = useRef(0);
    const [vals, setVals] = useState<Pose>({ ...IDLE_POSE });

    useImperativeHandle(ref, () => ({
      setPose: (key) => {
        targetRef.current = { ...POSES[key].pose };
      },
    }));

    useFrame((_, dt) => {
      const t = targetRef.current;
      const c = currentRef.current;
      const k = 1 - Math.pow(0.0015, dt);
      const next: Pose = {
        jawOpen: lerp(c.jawOpen, t.jawOpen, k),
        lipClosure: lerp(c.lipClosure, t.lipClosure, k),
        lipProtrusion: lerp(c.lipProtrusion, t.lipProtrusion, k),
        tongueTipY: lerp(c.tongueTipY, t.tongueTipY, k),
        tongueTipX: lerp(c.tongueTipX, t.tongueTipX, k),
        tongueBodyY: lerp(c.tongueBodyY, t.tongueBodyY, k),
        tongueBodyX: lerp(c.tongueBodyX, t.tongueBodyX, k),
        velumLower: lerp(c.velumLower, t.velumLower, k),
        frication: lerp(c.frication, t.frication, k),
      };
      if (idleBreath) {
        breathT.current += dt;
        next.jawOpen += Math.sin(breathT.current * 1.1) * 0.012;
        next.tongueBodyY += Math.sin(breathT.current * 0.85) * 0.012;
      }
      currentRef.current = next;
      setVals(next);
    });

    return (
      <group>
        {/* back layers */}
        <Vertebrae />
        <Region
          points={NASAL_AIRWAY}
          color={C.airway}
          zCenter={Z.nasalAir}
          renderOrder={4}
          outline={false}
        />
        <Region
          points={ORAL_AIRWAY}
          color={C.airway}
          zCenter={Z.oralAir}
          renderOrder={6}
          outlineColor={C.outline}
          outlineWidth={1}
        />
        <Region
          points={NASAL}
          color={C.nasal}
          zCenter={Z.nasal}
          renderOrder={8}
          outlineColor={C.outline}
        />
        <Region
          points={HARD_PALATE}
          color={C.bone}
          zCenter={Z.hardPalate}
          renderOrder={10}
          outlineColor={C.outline}
        />

        {/* larynx + epiglottis */}
        <Region
          points={LARYNX}
          color={C.larynx}
          zCenter={Z.larynx}
          renderOrder={9}
          outlineColor={C.outline}
        />
        <Region
          points={EPIGLOTTIS}
          color={C.velum}
          zCenter={Z.epiglottis}
          renderOrder={12}
          outlineColor={C.outline}
        />

        {/* movable articulators */}
        <Velum lower={vals.velumLower} />
        <Tongue
          bodyX={vals.tongueBodyX}
          bodyY={vals.tongueBodyY}
          tipY={vals.tongueTipY}
          tipX={vals.tongueTipX}
        />
        <Region
          points={UPPER_TEETH}
          color={C.teeth}
          zCenter={Z.teeth}
          renderOrder={22}
          outlineColor="#cbb9a0"
          outlineWidth={1}
        />
        <UpperLip
          lipClosure={vals.lipClosure}
          lipProtrusion={vals.lipProtrusion}
        />
        <LowerJaw
          jawOpen={vals.jawOpen}
          lipClosure={vals.lipClosure}
          lipProtrusion={vals.lipProtrusion}
        />
        <FricationStream amount={vals.frication} />

        {/* skin envelope on top, semi-transparent */}
        {showSkin && (
          <Region
            points={SKIN}
            color={C.skin}
            depth={1.1}
            zCenter={0.1}
            renderOrder={30}
            transparent
            opacity={0.16}
            outline
            outlineColor="#b98e6e"
            outlineWidth={1.6}
          />
        )}
      </group>
    );
  },
);

/* ============================================================
 * Top-level component
 * ============================================================ */

export default function ArticulatorViewer({
  showStats = false,
}: {
  showStats?: boolean;
}) {
  const sceneRef = useRef<SceneHandle>(null);
  const [activePose, setActivePose] = useState<PoseKey>("idle");
  const [idleBreath, setIdleBreath] = useState(true);
  const [showSkin, setShowSkin] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);

  const applyPose = (key: PoseKey) => {
    setActivePose(key);
    sceneRef.current?.setPose(key);
  };
  useEffect(() => {
    sceneRef.current?.setPose("idle");
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
      <div className="relative h-[560px] flex-1 overflow-hidden rounded-2xl bg-slate-50 shadow-inner lg:h-auto">
        <Canvas
          camera={{ position: [0.6, -0.1, 8.2], fov: 34, near: 0.1, far: 100 }}
          dpr={[1, 2]}
        >
          <color attach="background" args={["#f1f5f9"]} />
          <ambientLight intensity={0.85} />
          <directionalLight position={[2, 5, 6]} intensity={0.8} />
          <directionalLight position={[-3, 2, 4]} intensity={0.3} />

          <Scene ref={sceneRef} idleBreath={idleBreath} showSkin={showSkin} />

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
            <GizmoViewport
              axisColors={["#ef4444", "#22c55e", "#3b82f6"]}
              labelColor="#0f172a"
            />
          </GizmoHelper>
          {showStats && <Stats />}
        </Canvas>

        <div className="pointer-events-none absolute left-4 top-4 rounded-md bg-white/70 px-3 py-2 text-xs text-slate-700 backdrop-blur">
          <div className="font-semibold">조작</div>
          <div>· 왼쪽 드래그: 회전 (측면/후면/정면)</div>
          <div>· 휠: 줌 인 / 아웃</div>
          <div>· 오른쪽 드래그: 이동(팬)</div>
        </div>

        <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
          <label className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 text-xs text-slate-700 backdrop-blur">
            <input
              type="checkbox"
              checked={showSkin}
              onChange={(e) => setShowSkin(e.target.checked)}
            />
            피부 외형(반투명)
          </label>
          <label className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 text-xs text-slate-700 backdrop-blur">
            <input
              type="checkbox"
              checked={idleBreath}
              onChange={(e) => setIdleBreath(e.target.checked)}
            />
            Idle 호흡
          </label>
          <label className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 text-xs text-slate-700 backdrop-blur">
            <input
              type="checkbox"
              checked={autoRotate}
              onChange={(e) => setAutoRotate(e.target.checked)}
            />
            자동 회전
          </label>
        </div>
      </div>

      <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm lg:w-80">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            자음 산출 자세
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            버튼을 누르면 조음기관이 자세로 부드럽게 이동하며, 기도(파란
            영역)가 좁아지는 위치로 조음 위치를 확인할 수 있습니다.
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
                <div
                  className={
                    "mt-0.5 text-[11px] " +
                    (active ? "text-slate-300" : "text-slate-500")
                  }
                >
                  {p.sub}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-2 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
          <div className="mb-1 font-medium text-slate-700">범례</div>
          <ul className="space-y-1">
            <li>
              <span
                className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                style={{ background: C.airway }}
              />
              기도(성도 공명강)
            </li>
            <li>
              <span
                className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                style={{ background: C.nasal }}
              />
              비강 점막 · 연구개
            </li>
            <li>
              <span
                className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                style={{ background: C.tongue }}
              />
              혀(설근·설체·설첨)
            </li>
            <li>
              <span
                className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                style={{ background: C.bone }}
              />
              경구개 · 하악 · 경추
            </li>
            <li>
              <span
                className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                style={{ background: C.lip }}
              />
              입술
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
