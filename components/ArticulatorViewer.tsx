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
  OrbitControls,
  Stats,
} from "@react-three/drei";
import * as THREE from "three";

/* ============================================================
 * Pose model
 * ============================================================ */

type Pose = {
  jawOpen: number; // 0 (closed) .. 1 (wide open)
  lipClosure: number; // 0 (open) .. 1 (closed/pressed)
  lipProtrusion: number; // 0 .. 1 (rounded forward)
  // Tongue control points (in mouth-local coordinates).
  // Z+ = front of mouth, Z- = throat; Y+ = up (toward palate).
  tongueTipY: number;
  tongueTipZ: number;
  tongueBodyY: number;
  tongueBodyZ: number;
  velumLower: number; // 0 = raised (oral), 1 = lowered (nasal)
  // Optional narrow constriction visualization (frication).
  frication: number; // 0..1, scales a small airflow indicator
};

const IDLE_POSE: Pose = {
  jawOpen: 0.15,
  lipClosure: 0.0,
  lipProtrusion: 0.0,
  tongueTipY: -0.25,
  tongueTipZ: 0.55,
  tongueBodyY: -0.15,
  tongueBodyZ: -0.1,
  velumLower: 0.0,
  frication: 0.0,
};

type PoseKey =
  | "idle"
  | "bilabial_stop" // ㅂ ㅍ ㅃ
  | "bilabial_nasal" // ㅁ
  | "alveolar_stop" // ㄷ ㅌ ㄸ
  | "alveolar_nasal" // ㄴ
  | "alveolar_fric" // ㅅ ㅆ
  | "alveopalatal" // ㅈ ㅊ ㅉ
  | "velar_stop" // ㄱ ㅋ ㄲ
  | "velar_nasal" // ㅇ (받침)
  | "liquid" // ㄹ
  | "glottal"; // ㅎ

const POSES: Record<PoseKey, { label: string; sub: string; pose: Pose }> = {
  idle: {
    label: "Idle",
    sub: "휴지 자세",
    pose: IDLE_POSE,
  },
  bilabial_stop: {
    label: "ㅂ · ㅍ · ㅃ",
    sub: "양순 파열음",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.04,
      lipClosure: 1.0,
      lipProtrusion: 0.15,
      tongueBodyY: -0.2,
      tongueTipY: -0.25,
      velumLower: 0.0,
    },
  },
  bilabial_nasal: {
    label: "ㅁ",
    sub: "양순 비음 (연구개 하강)",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.06,
      lipClosure: 1.0,
      lipProtrusion: 0.1,
      velumLower: 1.0,
    },
  },
  alveolar_stop: {
    label: "ㄷ · ㅌ · ㄸ",
    sub: "치조 파열음",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.1,
      tongueTipY: 0.55, // contact w/ alveolar ridge
      tongueTipZ: 0.55,
      tongueBodyY: -0.1,
      tongueBodyZ: 0.05,
    },
  },
  alveolar_nasal: {
    label: "ㄴ",
    sub: "치조 비음 (연구개 하강)",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.12,
      tongueTipY: 0.55,
      tongueTipZ: 0.55,
      tongueBodyY: -0.1,
      velumLower: 1.0,
    },
  },
  alveolar_fric: {
    label: "ㅅ · ㅆ",
    sub: "치조 마찰음",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.18,
      tongueTipY: 0.35, // narrow gap
      tongueTipZ: 0.6,
      tongueBodyY: -0.1,
      tongueBodyZ: 0.05,
      frication: 1.0,
    },
  },
  alveopalatal: {
    label: "ㅈ · ㅊ · ㅉ",
    sub: "치조경구개 파찰음",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.15,
      tongueTipY: 0.4,
      tongueTipZ: 0.35,
      tongueBodyY: 0.2,
      tongueBodyZ: 0.1,
      frication: 0.6,
    },
  },
  velar_stop: {
    label: "ㄱ · ㅋ · ㄲ",
    sub: "연구개 파열음",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.15,
      tongueTipY: -0.3,
      tongueTipZ: 0.3,
      tongueBodyY: 0.4, // contact w/ velum
      tongueBodyZ: -0.45,
    },
  },
  velar_nasal: {
    label: "ㅇ (받침)",
    sub: "연구개 비음 (연구개 하강)",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.18,
      tongueBodyY: 0.35,
      tongueBodyZ: -0.45,
      velumLower: 1.0,
    },
  },
  liquid: {
    label: "ㄹ",
    sub: "치조 탄설/설측음",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.18,
      tongueTipY: 0.4,
      tongueTipZ: 0.45,
      tongueBodyY: -0.05,
      tongueBodyZ: 0.05,
    },
  },
  glottal: {
    label: "ㅎ",
    sub: "성문 마찰음",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.22,
      tongueBodyY: -0.15,
      frication: 0.5,
    },
  },
};

/* ============================================================
 * Helpers
 * ============================================================ */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Build a sagittal head silhouette as an extruded 2D shape.
function buildHeadShape(): THREE.Shape {
  const s = new THREE.Shape();
  // Coordinates roughly in units that match the articulator scene.
  // Drawn looking at the right side of the face (+Z toward face front).
  // x axis used here is mapped to Z later via extrusion orientation.
  s.moveTo(2.6, 1.4); // forehead front-top
  s.bezierCurveTo(2.8, 2.4, 1.8, 3.1, 0.6, 3.0); // top of head
  s.bezierCurveTo(-1.4, 3.0, -2.4, 2.4, -2.6, 1.4); // back of head
  s.bezierCurveTo(-2.7, 0.8, -2.6, 0.3, -2.4, -0.2); // upper neck
  s.lineTo(-2.0, -2.3); // back of neck down
  s.lineTo(-0.6, -2.6); // neck/chin underside
  s.bezierCurveTo(0.1, -2.5, 0.6, -2.0, 1.0, -1.4); // chin curve
  s.bezierCurveTo(1.2, -1.0, 1.4, -0.6, 1.6, -0.3); // lower lip / mouth
  s.bezierCurveTo(2.0, -0.2, 2.4, 0.0, 2.5, 0.4); // upper lip / nose underside
  s.bezierCurveTo(2.9, 0.6, 3.0, 0.9, 2.6, 1.4); // nose / forehead front
  return s;
}

/* ============================================================
 * Sub-meshes
 * ============================================================ */

function HeadSilhouette() {
  const geom = useMemo(() => {
    const shape = buildHeadShape();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 2.6,
      bevelEnabled: true,
      bevelThickness: 0.25,
      bevelSize: 0.2,
      bevelSegments: 4,
      curveSegments: 32,
    });
    g.translate(0, 0, -1.3); // center on X axis (depth)
    // Rotate so the extruded depth aligns with world X (left-right of face).
    g.rotateY(Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh geometry={geom} castShadow={false} receiveShadow={false}>
      <meshPhysicalMaterial
        color="#f0c7b1"
        roughness={0.7}
        metalness={0.0}
        transmission={0.55}
        thickness={1.2}
        transparent
        opacity={0.18}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** Curved arch geometry for hard / soft palate. */
function buildPalateGeometry(
  frontZ: number,
  backZ: number,
  width: number,
  arch: number,
  segments = 24,
  depthSegments = 12,
) {
  const g = new THREE.PlaneGeometry(
    width,
    backZ - frontZ,
    segments,
    depthSegments,
  );
  // PlaneGeometry lies in XY by default; rotate so it lies in XZ.
  g.rotateX(-Math.PI / 2);
  // Shift so its z-range is [frontZ, backZ]
  g.translate(0, 0, (frontZ + backZ) / 2);

  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // Lateral arch: dip lower in the middle (concave dome facing down for hard palate is +Y up).
    const w = width / 2;
    const lateral = 1 - (x / w) ** 2; // 1 at center, 0 at edges
    // Front-back: tapering at very front and back (so it doesn't look like a flat slab).
    const tFB = (z - frontZ) / (backZ - frontZ); // 0..1
    const fbFalloff = Math.sin(tFB * Math.PI); // 0..1..0
    const y = arch * lateral * fbFalloff;
    pos.setY(i, y);
  }
  g.computeVertexNormals();
  return g;
}

function HardPalate() {
  const geom = useMemo(
    () => buildPalateGeometry(0.85, -0.4, 1.2, 0.25, 28, 16),
    [],
  );
  return (
    <mesh geometry={geom} position={[0, 0.6, 0]}>
      <meshStandardMaterial
        color="#ffd9c2"
        roughness={0.6}
        metalness={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function SoftPalate({ lower }: { lower: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const geom = useMemo(
    () => buildPalateGeometry(-0.4, -1.1, 1.05, 0.18, 24, 16),
    [],
  );

  useFrame(() => {
    if (!groupRef.current) return;
    // Rotate around hinge at z = -0.4 (front of velum).
    // When fully lowered, swing downward ~35deg.
    groupRef.current.rotation.x = lower * THREE.MathUtils.degToRad(35);
  });

  return (
    <group ref={groupRef} position={[0, 0.6, -0.4]}>
      <mesh geometry={geom} position={[0, 0, 0.4]}>
        <meshStandardMaterial
          color="#f3a48c"
          roughness={0.55}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Uvula */}
      <mesh position={[0, -0.12, -0.6]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#e07b66" roughness={0.5} />
      </mesh>
    </group>
  );
}

function ToothRow({
  count = 10,
  spread = 1.05,
  depth = 0.9,
  toothSize = [0.09, 0.18, 0.1] as [number, number, number],
}) {
  const teeth = useMemo(() => {
    const arr: { x: number; z: number; rotY: number }[] = [];
    // Place teeth along a semi-circular arch (front of mouth = +Z).
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1); // 0..1
      const ang = lerp(-Math.PI * 0.5, Math.PI * 0.5, t);
      const r = depth / 1.8;
      const x = Math.cos(ang) * (spread / 2);
      const z = Math.sin(ang) * r;
      arr.push({ x, z, rotY: -ang });
    }
    return arr;
  }, [count, spread, depth]);

  return (
    <group>
      {teeth.map((t, i) => (
        <mesh
          key={i}
          position={[t.x, 0, t.z]}
          rotation={[0, t.rotY, 0]}
          castShadow={false}
        >
          <boxGeometry args={toothSize} />
          <meshStandardMaterial color="#fbf6ec" roughness={0.3} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

function UpperJaw() {
  return (
    <group position={[0, 0.4, 0.0]}>
      <ToothRow />
    </group>
  );
}

function LowerJawAndLip({
  jawOpen,
  lipClosure,
  lipProtrusion,
}: {
  jawOpen: number;
  lipClosure: number;
  lipProtrusion: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const lipRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (groupRef.current) {
      // Jaw rotates around TMJ pivot located at the back of the head.
      const maxAngle = THREE.MathUtils.degToRad(22);
      groupRef.current.rotation.x = jawOpen * maxAngle;
    }
    if (lipRef.current) {
      // Lower lip rises slightly toward upper lip on closure.
      const baseY = 0.0;
      lipRef.current.position.y =
        baseY + lipClosure * 0.18 - (1 - lipClosure) * 0.02;
      lipRef.current.position.z = 0.95 + lipProtrusion * 0.18;
      lipRef.current.scale.x = 1 - lipProtrusion * 0.25;
    }
  });

  return (
    // Pivot at back of mouth (where TMJ would be)
    <group ref={groupRef} position={[0, 0, -1.1]}>
      {/* Translate teeth/lip forward into the mouth */}
      <group position={[0, 0.05, 1.1]}>
        <ToothRow />
        {/* Mandible body (suggest a curved jaw bone) */}
        <mesh position={[0, -0.22, -0.05]}>
          <torusGeometry args={[0.55, 0.08, 12, 24, Math.PI]} />
          <meshStandardMaterial color="#f8e2cf" roughness={0.7} />
        </mesh>
        {/* Lower lip */}
        <mesh ref={lipRef} position={[0, 0.0, 0.95]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.34, 0.07, 14, 28, Math.PI]} />
          <meshStandardMaterial color="#c45a55" roughness={0.45} />
        </mesh>
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
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.y = 0.22 - lipClosure * 0.06;
    ref.current.position.z = 1.0 + lipProtrusion * 0.18;
    ref.current.scale.x = 1 - lipProtrusion * 0.25;
  });
  return (
    <mesh ref={ref} position={[0, 0.22, 1.0]} rotation={[Math.PI, 0, 0]}>
      <torusGeometry args={[0.34, 0.07, 14, 28, Math.PI]} />
      <meshStandardMaterial color="#c45a55" roughness={0.45} />
    </mesh>
  );
}

/** Tongue built from a parametric grid that we deform each frame. */
function Tongue({
  tipY,
  tipZ,
  bodyY,
  bodyZ,
}: {
  tipY: number;
  tipZ: number;
  bodyY: number;
  bodyZ: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  // Base geometry is a half-ellipsoid grid (UV sphere with low res, scaled).
  const geom = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 32, 24);
    return g;
  }, []);

  // Reference rest position of each vertex along Z (front-back), used as weight.
  const restAttr = useMemo(() => {
    const pos = geom.attributes.position;
    const arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      arr[i * 3] = pos.getX(i);
      arr[i * 3 + 1] = pos.getY(i);
      arr[i * 3 + 2] = pos.getZ(i);
    }
    return arr;
  }, [geom]);

  useFrame(() => {
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const rx = restAttr[i * 3];
      const ry = restAttr[i * 3 + 1];
      const rz = restAttr[i * 3 + 2];

      // Map sphere into a tongue-shaped ellipsoid (longer in Z, flatter in Y).
      // Then displace based on body/tip weights computed from Z.
      const zNorm = rz; // -1 (back) .. +1 (front)
      // Weights along the tongue front-back axis.
      const tipW = THREE.MathUtils.smoothstep(zNorm, 0.4, 1.0);
      const bodyW = THREE.MathUtils.smoothstep(zNorm, -0.6, 0.4) * (1 - tipW);

      // Base ellipsoid scaling
      const ex = 0.55; // half-width
      const ey = 0.22; // half-height (flat top)
      const ez = 0.85; // half-length

      let x = rx * ex;
      let y = ry * ey;
      let z = rz * ez;

      // Apply displacement targets.
      y += tipW * tipY * 0.6 + bodyW * bodyY * 0.6;
      z += tipW * (tipZ - 0.5) * 0.5 + bodyW * bodyZ * 0.4;

      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
  });

  return (
    <mesh ref={meshRef} geometry={geom} position={[0, 0.0, 0.0]}>
      <meshStandardMaterial
        color="#d97c7c"
        roughness={0.55}
        metalness={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** Small swirling sparkles to indicate frication (turbulent airflow). */
function FricationStream({ amount }: { amount: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const particles = useMemo(() => {
    const arr: { phase: number; r: number; y: number }[] = [];
    for (let i = 0; i < 14; i++) {
      arr.push({
        phase: Math.random() * Math.PI * 2,
        r: 0.04 + Math.random() * 0.05,
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
      const scale = 0.5 + amount * 0.8;
      groupRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.3, 1.05]}>
      {particles.map((p, i) => {
        const tt = (t.current * 1.6 + p.phase) % 1;
        const x = Math.sin(p.phase * 2.5 + t.current * 2) * 0.04;
        const z = tt * 0.6;
        const y = p.y + Math.sin(t.current * 5 + p.phase) * 0.02;
        return (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[p.r, 8, 8]} />
            <meshBasicMaterial
              color="#7fc8f8"
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
 * Smoothly-animated articulator stack
 * ============================================================ */

type SceneHandle = {
  setPose: (key: PoseKey) => void;
};

const Articulators = forwardRef<SceneHandle, { idleBreath: boolean }>(
  function Articulators({ idleBreath }, ref) {
    const targetRef = useRef<Pose>({ ...IDLE_POSE });
    const currentRef = useRef<Pose>({ ...IDLE_POSE });
    const breathT = useRef(0);

    useImperativeHandle(ref, () => ({
      setPose: (key) => {
        targetRef.current = { ...POSES[key].pose };
      },
    }));

    // Local mirrors that drive the meshes via React state updates each frame.
    const [vals, setVals] = useState<Pose>({ ...IDLE_POSE });

    useFrame((_, dt) => {
      const t = targetRef.current;
      const c = currentRef.current;
      const k = 1 - Math.pow(0.001, dt); // critically damped-ish lerp

      const next: Pose = {
        jawOpen: lerp(c.jawOpen, t.jawOpen, k),
        lipClosure: lerp(c.lipClosure, t.lipClosure, k),
        lipProtrusion: lerp(c.lipProtrusion, t.lipProtrusion, k),
        tongueTipY: lerp(c.tongueTipY, t.tongueTipY, k),
        tongueTipZ: lerp(c.tongueTipZ, t.tongueTipZ, k),
        tongueBodyY: lerp(c.tongueBodyY, t.tongueBodyY, k),
        tongueBodyZ: lerp(c.tongueBodyZ, t.tongueBodyZ, k),
        velumLower: lerp(c.velumLower, t.velumLower, k),
        frication: lerp(c.frication, t.frication, k),
      };

      if (idleBreath) {
        breathT.current += dt;
        // Subtle ambient breathing modulation
        next.jawOpen += Math.sin(breathT.current * 1.2) * 0.015;
        next.tongueBodyY += Math.sin(breathT.current * 0.9) * 0.01;
      }

      currentRef.current = next;
      setVals(next);
    });

    return (
      <group>
        <HardPalate />
        <SoftPalate lower={vals.velumLower} />
        <UpperJaw />
        <UpperLip
          lipClosure={vals.lipClosure}
          lipProtrusion={vals.lipProtrusion}
        />
        <LowerJawAndLip
          jawOpen={vals.jawOpen}
          lipClosure={vals.lipClosure}
          lipProtrusion={vals.lipProtrusion}
        />
        <Tongue
          tipY={vals.tongueTipY}
          tipZ={vals.tongueTipZ}
          bodyY={vals.tongueBodyY}
          bodyZ={vals.tongueBodyZ}
        />
        <FricationStream amount={vals.frication} />
      </group>
    );
  },
);

/* ============================================================
 * Top-level component
 * ============================================================ */

export default function ArticulatorViewer({
  showStats = false,
  showHead = true,
}: {
  showStats?: boolean;
  showHead?: boolean;
}) {
  const sceneRef = useRef<SceneHandle>(null);
  const [activePose, setActivePose] = useState<PoseKey>("idle");
  const [idleBreath, setIdleBreath] = useState(true);
  const [headOn, setHeadOn] = useState(showHead);
  const [autoRotate, setAutoRotate] = useState(false);

  const applyPose = (key: PoseKey) => {
    setActivePose(key);
    sceneRef.current?.setPose(key);
  };

  // Apply initial pose
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
      {/* Canvas */}
      <div className="relative h-[520px] flex-1 overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 to-slate-700 shadow-inner lg:h-auto">
        <Canvas
          shadows
          camera={{ position: [5.5, 2.0, 4.5], fov: 38, near: 0.1, far: 100 }}
          dpr={[1, 2]}
        >
          <color attach="background" args={["#0f172a"]} />
          <fog attach="fog" args={["#0f172a", 12, 24]} />

          {/* Lighting */}
          <ambientLight intensity={0.55} />
          <directionalLight
            position={[5, 6, 4]}
            intensity={1.0}
            color="#fff5e6"
          />
          <directionalLight
            position={[-4, 2, -3]}
            intensity={0.4}
            color="#a8c0ff"
          />
          <pointLight position={[0, 0.4, 1.5]} intensity={0.6} color="#ffb98a" />

          {/* Scene */}
          <group position={[0, 0, 0]}>
            {headOn && <HeadSilhouette />}
            <Articulators ref={sceneRef} idleBreath={idleBreath} />
          </group>

          {/* Floor reference grid */}
          <gridHelper
            args={[10, 20, "#334155", "#1f2937"]}
            position={[0, -2.6, 0]}
          />

          {/* Controls + gizmo */}
          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            autoRotate={autoRotate}
            autoRotateSpeed={0.8}
            minDistance={2.5}
            maxDistance={14}
            target={[0, 0.3, 0]}
          />
          <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
            <GizmoViewport
              axisColors={["#ef4444", "#22c55e", "#3b82f6"]}
              labelColor="#0f172a"
            />
          </GizmoHelper>

          {showStats && <Stats />}
        </Canvas>

        {/* Overlay hints */}
        <div className="pointer-events-none absolute left-4 top-4 rounded-md bg-black/40 px-3 py-2 text-xs text-slate-100 backdrop-blur">
          <div className="font-semibold">조작</div>
          <div>· 왼쪽 드래그: 회전 (측면/후면/정면)</div>
          <div>· 휠: 줌 인 / 아웃</div>
          <div>· 오른쪽 드래그: 이동(팬)</div>
        </div>

        <div className="pointer-events-auto absolute right-4 top-4 flex flex-col items-end gap-2">
          <label className="flex items-center gap-2 rounded-md bg-black/40 px-2 py-1 text-xs text-slate-100 backdrop-blur">
            <input
              type="checkbox"
              checked={headOn}
              onChange={(e) => setHeadOn(e.target.checked)}
            />
            머리 실루엣
          </label>
          <label className="flex items-center gap-2 rounded-md bg-black/40 px-2 py-1 text-xs text-slate-100 backdrop-blur">
            <input
              type="checkbox"
              checked={idleBreath}
              onChange={(e) => setIdleBreath(e.target.checked)}
            />
            Idle 호흡
          </label>
          <label className="flex items-center gap-2 rounded-md bg-black/40 px-2 py-1 text-xs text-slate-100 backdrop-blur">
            <input
              type="checkbox"
              checked={autoRotate}
              onChange={(e) => setAutoRotate(e.target.checked)}
            />
            자동 회전
          </label>
        </div>
      </div>

      {/* Pose panel */}
      <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm lg:w-80">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            자음 산출 자세
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            버튼을 누르면 조음기관이 해당 자음 산출 자세로 부드럽게 이동합니다.
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
          <div className="mb-1 font-medium text-slate-700">표시 가이드</div>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>비음(ㅁ/ㄴ/ㅇ) 선택 시 연구개가 하강합니다.</li>
            <li>
              마찰음(ㅅ/ㅆ, ㅎ) 선택 시 좁힘 부위에 기류 표시가 나타납니다.
            </li>
            <li>치조음은 혀끝, 연구개음은 혀뒤가 닿는 위치를 보여줍니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
