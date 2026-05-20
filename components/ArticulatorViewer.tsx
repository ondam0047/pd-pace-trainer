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
 * Anatomical coordinate system
 *   +X = anterior (face front)
 *   -X = posterior (back of head / spine)
 *   +Y = superior (up)
 *   -Y = inferior (down)
 *   +Z = right side of head, -Z = left side
 *   The midsagittal plane is Z = 0.
 * ============================================================ */

/* ============================================================
 * Pose model
 * ============================================================ */

type Pose = {
  jawOpen: number; // 0 (closed) .. 1 (wide open)
  lipClosure: number; // 0 (open) .. 1 (closed/pressed)
  lipProtrusion: number; // 0 .. 1 (rounded forward)
  tongueTipY: number; // displacement on Y axis
  tongueTipX: number; // displacement on X axis (anterior +)
  tongueBodyY: number;
  tongueBodyX: number;
  velumLower: number; // 0 = raised (oral), 1 = lowered (nasal)
  frication: number; // 0..1 turbulence visualization
};

const IDLE_POSE: Pose = {
  jawOpen: 0.15,
  lipClosure: 0.0,
  lipProtrusion: 0.0,
  tongueTipY: -0.1,
  tongueTipX: 0.0,
  tongueBodyY: 0.0,
  tongueBodyX: 0.0,
  velumLower: 0.0,
  frication: 0.0,
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
      tongueTipY: 0.55,
      tongueTipX: 0.1,
      tongueBodyY: 0.05,
    },
  },
  alveolar_nasal: {
    label: "ㄴ",
    sub: "치조 비음 (연구개 하강)",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.12,
      tongueTipY: 0.55,
      tongueTipX: 0.1,
      velumLower: 1.0,
    },
  },
  alveolar_fric: {
    label: "ㅅ · ㅆ",
    sub: "치조 마찰음",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.18,
      tongueTipY: 0.38,
      tongueTipX: 0.12,
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
      tongueTipX: 0.0,
      tongueBodyY: 0.25,
      frication: 0.6,
    },
  },
  velar_stop: {
    label: "ㄱ · ㅋ · ㄲ",
    sub: "연구개 파열음",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.15,
      tongueBodyY: 0.5,
      tongueBodyX: -0.3,
    },
  },
  velar_nasal: {
    label: "ㅇ (받침)",
    sub: "연구개 비음 (연구개 하강)",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.18,
      tongueBodyY: 0.45,
      tongueBodyX: -0.3,
      velumLower: 1.0,
    },
  },
  liquid: {
    label: "ㄹ",
    sub: "치조 탄설/설측음",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.18,
      tongueTipY: 0.42,
      tongueTipX: 0.0,
      tongueBodyY: 0.05,
    },
  },
  glottal: {
    label: "ㅎ",
    sub: "성문 마찰음",
    pose: {
      ...IDLE_POSE,
      jawOpen: 0.22,
      frication: 0.5,
    },
  },
};

/* ============================================================
 * Helpers
 * ============================================================ */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (x: number, e0: number, e1: number) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/* ============================================================
 * Head silhouette (midsagittal profile, extruded)
 * Profile coords are in the X-Y plane (X = anterior, Y = up).
 * Numbers chosen to match a typical lateral skull/face contour.
 * ============================================================ */
function buildHeadSagittalShape(): THREE.Shape {
  const s = new THREE.Shape();
  // start at top of head, traverse clockwise looking from +Z
  s.moveTo(-0.2, 3.0); // top of head (back-side)
  s.bezierCurveTo(0.8, 3.35, 1.7, 3.15, 2.15, 2.7); // crown to front
  s.bezierCurveTo(2.55, 2.35, 2.55, 1.95, 2.4, 1.6); // forehead
  s.bezierCurveTo(2.3, 1.4, 2.45, 1.25, 2.55, 1.05); // brow → nasion
  s.bezierCurveTo(2.95, 0.95, 3.15, 0.7, 3.05, 0.45); // nose bridge → tip
  s.bezierCurveTo(2.95, 0.3, 2.7, 0.2, 2.55, 0.15); // under nose
  s.lineTo(2.55, -0.05); // philtrum
  s.bezierCurveTo(2.7, -0.1, 2.85, -0.2, 2.75, -0.35); // upper lip
  s.bezierCurveTo(2.65, -0.45, 2.55, -0.55, 2.55, -0.65); // between lips
  s.bezierCurveTo(2.6, -0.75, 2.75, -0.85, 2.7, -1.0); // lower lip
  s.bezierCurveTo(2.5, -1.15, 2.25, -1.25, 2.0, -1.4); // chin curve
  s.bezierCurveTo(1.55, -1.55, 1.1, -1.6, 0.7, -1.65); // chin → submental
  s.bezierCurveTo(0.4, -1.7, 0.2, -1.85, 0.1, -2.1); // throat front
  s.lineTo(0.1, -2.7); // lower neck front
  s.lineTo(-1.0, -2.85); // bottom of cut
  s.lineTo(-1.4, -2.4); // back-lower neck
  s.bezierCurveTo(-1.55, -1.8, -1.55, -1.0, -1.6, -0.2); // back of neck
  s.bezierCurveTo(-1.7, 0.6, -1.8, 1.4, -1.7, 2.1); // back of head
  s.bezierCurveTo(-1.5, 2.7, -0.95, 3.05, -0.2, 3.0); // close to top
  return s;
}

function HeadSilhouette({
  visible,
  crossSection,
}: {
  visible: boolean;
  crossSection: boolean;
}) {
  const geom = useMemo(() => {
    const shape = buildHeadSagittalShape();
    const depth = 3.6;
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.18,
      bevelSize: 0.16,
      bevelSegments: 4,
      curveSegments: 48,
    });
    // Extrusion is along +Z by default; center it
    g.translate(0, 0, -depth / 2);
    g.computeVertexNormals();
    return g;
  }, []);

  const halfGeom = useMemo(() => {
    const shape = buildHeadSagittalShape();
    const depth = 1.8;
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.12,
      bevelSegments: 3,
      curveSegments: 48,
    });
    // Only the right half (Z >= 0)
    g.computeVertexNormals();
    return g;
  }, []);

  if (!visible) return null;

  if (crossSection) {
    return (
      <mesh geometry={halfGeom}>
        <meshStandardMaterial
          color="#f6cdb5"
          roughness={0.85}
          metalness={0.0}
          side={THREE.DoubleSide}
        />
      </mesh>
    );
  }

  return (
    <mesh geometry={geom}>
      <meshPhysicalMaterial
        color="#f5c7ad"
        roughness={0.7}
        metalness={0}
        transmission={0.6}
        thickness={1.2}
        transparent
        opacity={0.16}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ============================================================
 * Hard palate — domed roof of the oral cavity
 * Built as a flexible plane that arches in both AP and lateral.
 * ============================================================ */
function buildArchPlane({
  xFront,
  xBack,
  width,
  archHeight,
  baseY,
  segments = 28,
  depthSegments = 16,
  archProfile = (t: number) => Math.sin(Math.PI * t),
}: {
  xFront: number;
  xBack: number;
  width: number;
  archHeight: number;
  baseY: number;
  segments?: number;
  depthSegments?: number;
  archProfile?: (t: number) => number;
}): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(
    xFront - xBack,
    width,
    depthSegments,
    segments,
  );
  // Lay in XZ plane (was XY), so lateral (width) → Z, AP → X
  g.rotateX(-Math.PI / 2);
  // PlaneGeometry now has y=0; reposition along X (AP)
  g.translate((xFront + xBack) / 2, baseY, 0);

  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const tAP = (x - xBack) / (xFront - xBack); // 0 back, 1 front
    const fbFalloff = archProfile(tAP);
    const w = width / 2;
    const lateral = 1 - Math.pow(z / w, 2);
    const dy = archHeight * lateral * fbFalloff;
    pos.setY(i, baseY + dy);
  }
  g.computeVertexNormals();
  return g;
}

function HardPalate() {
  const geom = useMemo(
    () =>
      buildArchPlane({
        xBack: 0.1,
        xFront: 2.2,
        width: 1.25,
        archHeight: 0.22,
        baseY: 0.42,
        segments: 32,
        depthSegments: 16,
        archProfile: (t) => Math.sin(Math.PI * t) * (0.6 + 0.4 * t), // higher in front
      }),
    [],
  );
  // Upper teeth wrap (alveolar ridge thick lip)
  return (
    <group>
      <mesh geometry={geom}>
        <meshStandardMaterial
          color="#ffd1b9"
          roughness={0.6}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Alveolar ridge — small bump just behind upper teeth */}
      <mesh position={[1.95, 0.32, 0]}>
        <torusGeometry args={[0.45, 0.05, 10, 24, Math.PI]} />
        <meshStandardMaterial color="#f2b89c" roughness={0.6} />
      </mesh>
    </group>
  );
}

function SoftPalate({ lower }: { lower: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const palateGeom = useMemo(
    () =>
      buildArchPlane({
        xBack: -0.75,
        xFront: 0.1,
        width: 1.05,
        archHeight: 0.16,
        baseY: 0,
        segments: 18,
        depthSegments: 12,
        archProfile: (t) => Math.sin(Math.PI * t),
      }),
    [],
  );

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.rotation.z =
      lower * THREE.MathUtils.degToRad(38); // swing down at hinge
  });

  return (
    // Pivot at hinge = front of soft palate (junction with hard palate)
    <group position={[0.1, 0.42, 0]}>
      <group ref={groupRef}>
        <mesh geometry={palateGeom}>
          <meshStandardMaterial
            color="#f29a82"
            roughness={0.55}
            metalness={0}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Uvula */}
        <mesh position={[-0.78, -0.12, 0]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#d96a55" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

/* ============================================================
 * Nasal cavity — turbinates and septum, above the hard palate
 * ============================================================ */
function NasalCavity() {
  return (
    <group>
      {/* Floor (top of hard palate, viewed from above) — implicit, palate top */}
      {/* Turbinates: inferior, middle, superior on the lateral wall */}
      {/* Inferior turbinate (largest, lower-front) */}
      <mesh position={[1.55, 0.9, 0]} rotation={[0, 0, -0.1]}>
        <sphereGeometry args={[0.32, 20, 14]} />
        <meshStandardMaterial color="#e89685" roughness={0.6} />
      </mesh>
      {/* Middle turbinate */}
      <mesh position={[1.0, 1.2, 0]} rotation={[0, 0, -0.15]}>
        <sphereGeometry args={[0.27, 18, 12]} />
        <meshStandardMaterial color="#e08573" roughness={0.6} />
      </mesh>
      {/* Superior turbinate */}
      <mesh position={[0.45, 1.45, 0]} rotation={[0, 0, -0.2]}>
        <sphereGeometry args={[0.18, 16, 10]} />
        <meshStandardMaterial color="#d77a69" roughness={0.6} />
      </mesh>
      {/* External nose cartilage (visible inside nostril) */}
      <mesh position={[2.6, 0.6, 0]}>
        <sphereGeometry args={[0.16, 16, 12]} />
        <meshStandardMaterial color="#ffd5be" roughness={0.5} />
      </mesh>
    </group>
  );
}

/* ============================================================
 * Pharyngeal back wall — curves from soft-palate level down behind tongue
 * ============================================================ */
function PharyngealWall() {
  const geom = useMemo(() => {
    // Build a curved sheet at x ≈ -0.7 spanning vertically
    const segments = 20;
    const lat = 12;
    const g = new THREE.PlaneGeometry(3.5, 1.2, segments, lat);
    // Lay vertically: rotate so plane normal is +X
    g.rotateY(Math.PI / 2);
    g.translate(-0.7, -0.4, 0);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const z = pos.getZ(i);
      // gently curve forward at top and bottom
      const ty = (y + 2.1) / 3.5; // 0..1 along vertical
      const curve = Math.sin(ty * Math.PI) * 0.0; // keep mostly flat
      const lateralCurve = -Math.pow(z / 0.6, 2) * 0.18; // recede laterally
      pos.setX(i, -0.7 + curve + lateralCurve);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh geometry={geom}>
      <meshStandardMaterial
        color="#cf6a5a"
        roughness={0.6}
        metalness={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ============================================================
 * Tongue — anatomically-shaped 3D mesh
 * Built as a swept tube along the AP axis, varying width/height,
 * with displacement applied for tip & body control points.
 * ============================================================ */
function Tongue({
  tipY,
  tipX,
  bodyY,
  bodyX,
}: {
  tipY: number;
  tipX: number;
  bodyY: number;
  bodyX: number;
}) {
  // Pre-build a base geometry (unit sphere) — we deform it each frame
  const geom = useMemo(() => new THREE.SphereGeometry(1, 56, 36), []);

  // Static reference: store the original (theta, phi) of each vertex.
  // Sphere geometry parameterized as: phi (0..π, top->bottom), theta (0..2π around).
  const refs = useMemo(() => {
    const pos = geom.attributes.position;
    const arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      // Compute phi & theta from sphere coords
      const phi = Math.acos(THREE.MathUtils.clamp(y, -1, 1));
      const theta = Math.atan2(z, x);
      arr[i * 3] = phi;
      arr[i * 3 + 1] = theta;
      arr[i * 3 + 2] = 0;
    }
    return arr;
  }, [geom]);

  useFrame(() => {
    const pos = geom.attributes.position;

    // Base tongue shape (along AP axis, X):
    // Root at x ≈ -0.7, body at x ≈ 0.4, tip at x ≈ 1.7
    // Top dorsum height profile, bottom floor profile, width profile.
    const xRoot = -0.6;
    const xTip = 1.75;

    for (let i = 0; i < pos.count; i++) {
      const phi = refs[i * 3];
      const theta = refs[i * 3 + 1];

      // Map phi (0..π) to AP position u (0..1).
      // phi=0 (top pole) → root; phi=π (bottom pole) → tip
      const u = phi / Math.PI;
      const ap = lerp(xRoot, xTip, u);

      // Width (Z) along AP — broadest at body, narrower at root and tip
      const width =
        0.25 + 0.55 * Math.sin(Math.PI * u) * (0.7 + 0.3 * Math.sin(u * Math.PI));

      // Vertical extent — top dorsum height vs. mouth-floor height
      const topY = -0.05 - 0.35 * Math.pow(1 - Math.abs(u - 0.45) / 0.5, 2);
      // dorsum: peaks around u=0.45 → topY higher (less negative)
      const dorsumPeak = 0.05; // peak Y of dorsum at rest
      const topYRest =
        dorsumPeak - 0.55 * Math.pow(Math.abs(u - 0.45) * 2.0, 1.6);

      const floorY = -1.05 + 0.18 * Math.sin(Math.PI * u);
      const centerY = (topYRest + floorY) / 2;
      const semiH = (topYRest - floorY) / 2;

      // Cross-section parameter goes 0..2π around AP axis.
      // We use theta from the source sphere as that parameter.
      // Map vertex to ellipse cross-section.
      const cy = centerY + semiH * Math.cos(theta);
      const cz = width * Math.sin(theta);

      // Apply pose displacements with smooth weights along AP axis
      const wTip = smoothstep(u, 0.62, 1.0);
      const wBody = smoothstep(u, 0.15, 0.65) * (1 - wTip);

      const dx = wTip * tipX * 0.4 + wBody * bodyX * 0.6;
      const dy = wTip * tipY * 0.55 + wBody * bodyY * 0.55;

      pos.setXYZ(i, ap + dx, cy + dy, cz);
      // unused: topY (kept for future)
      void topY;
      void width;
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
  });

  return (
    <mesh geometry={geom}>
      <meshStandardMaterial
        color="#d57878"
        roughness={0.55}
        metalness={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ============================================================
 * Teeth + Mandible
 * ============================================================ */
function ToothRow({
  count = 12,
  spread = 1.1,
  archDepth = 0.85,
  toothSize = [0.09, 0.18, 0.1] as [number, number, number],
}) {
  const teeth = useMemo(() => {
    const arr: { x: number; z: number; rotY: number }[] = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const ang = lerp(Math.PI * 0.5, -Math.PI * 0.5, t);
      const x = Math.sin(ang) * archDepth + 1.5;
      const z = Math.cos(ang) * (spread / 2);
      arr.push({ x, z, rotY: -ang });
    }
    return arr;
  }, [count, spread, archDepth]);

  return (
    <group>
      {teeth.map((t, i) => (
        <mesh
          key={i}
          position={[t.x, 0, t.z]}
          rotation={[0, t.rotY, 0]}
        >
          <boxGeometry args={toothSize} />
          <meshStandardMaterial color="#fbf6ec" roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function UpperJaw() {
  return (
    <group position={[0, 0.22, 0]}>
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
      const maxAngle = THREE.MathUtils.degToRad(20);
      groupRef.current.rotation.z = -jawOpen * maxAngle;
    }
    if (lipRef.current) {
      const baseY = -0.85;
      lipRef.current.position.y = baseY + lipClosure * 0.2;
      lipRef.current.position.x = 2.55 + lipProtrusion * 0.15;
      lipRef.current.scale.z = 1 - lipProtrusion * 0.25;
    }
  });

  return (
    // Pivot at TMJ ≈ behind ear (-1.5, 0.5, 0)
    <group ref={groupRef} position={[-1.5, 0.5, 0]}>
      <group position={[1.5, -0.5, 0]}>
        {/* Lower teeth */}
        <group position={[0, -0.45, 0]}>
          <ToothRow />
        </group>
        {/* Mandible body — curved arc on the bottom */}
        <mesh position={[1.1, -0.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.85, 0.1, 14, 32, Math.PI]} />
          <meshStandardMaterial color="#f6dfca" roughness={0.7} />
        </mesh>
        {/* Lower lip — torus segment in front of lower teeth */}
        <mesh
          ref={lipRef}
          position={[2.55, -0.85, 0]}
          rotation={[Math.PI / 2, 0, Math.PI]}
        >
          <torusGeometry args={[0.32, 0.08, 14, 28, Math.PI]} />
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
    ref.current.position.y = -0.05 - lipClosure * 0.07;
    ref.current.position.x = 2.55 + lipProtrusion * 0.15;
    ref.current.scale.z = 1 - lipProtrusion * 0.25;
  });
  return (
    <mesh ref={ref} position={[2.55, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.32, 0.08, 14, 28, Math.PI]} />
      <meshStandardMaterial color="#c45a55" roughness={0.45} />
    </mesh>
  );
}

/* ============================================================
 * Epiglottis + Larynx + Vocal folds
 * ============================================================ */
function Epiglottis() {
  // Leaf-shaped flap above the larynx
  const geom = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(-0.05, 0.25, 0.1, 0.5, 0.0, 0.65);
    shape.bezierCurveTo(-0.18, 0.55, -0.22, 0.3, -0.05, 0);
    shape.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.35,
      bevelEnabled: true,
      bevelSize: 0.03,
      bevelThickness: 0.02,
      bevelSegments: 2,
      curveSegments: 16,
    });
    g.translate(0, 0, -0.175);
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh geometry={geom} position={[-0.35, -1.55, 0]} rotation={[0, 0, 0.3]}>
      <meshStandardMaterial color="#e08e76" roughness={0.55} />
    </mesh>
  );
}

function Larynx({ frication }: { frication: number }) {
  // Stylized thyroid cartilage tube + vocal fold slit
  return (
    <group position={[-0.35, -2.1, 0]}>
      {/* Outer tube */}
      <mesh rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.32, 0.35, 0.85, 24]} />
        <meshStandardMaterial
          color="#e3a48f"
          roughness={0.7}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Vocal folds — two wedges with a white slit */}
      <mesh position={[0.12, 0.05, 0.15]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[0.18, 0.12, 0.05]} />
        <meshStandardMaterial color="#fdf0e6" roughness={0.4} />
      </mesh>
      <mesh position={[0.12, 0.05, -0.15]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[0.18, 0.12, 0.05]} />
        <meshStandardMaterial color="#fdf0e6" roughness={0.4} />
      </mesh>
      {/* Glottal airflow indicator (visible during ㅎ) */}
      <mesh position={[0.12, 0.05, 0]}>
        <boxGeometry args={[0.02, 0.02 + frication * 0.04, 0.18]} />
        <meshBasicMaterial color="#7fc8f8" transparent opacity={frication} />
      </mesh>
    </group>
  );
}

/* ============================================================
 * Vertebral column — stack of cervical vertebrae
 * ============================================================ */
function VertebralColumn() {
  const vertebrae = useMemo(() => {
    const arr: { y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      arr.push({ y: 1.5 - i * 0.7 });
    }
    return arr;
  }, []);

  return (
    <group position={[-1.25, 0, 0]}>
      {vertebrae.map((v, i) => (
        <group key={i} position={[0, v.y, 0]}>
          {/* Body (cylinder-ish disk) */}
          <mesh>
            <cylinderGeometry args={[0.34, 0.34, 0.42, 24]} />
            <meshStandardMaterial color="#f5d8b8" roughness={0.6} />
          </mesh>
          {/* Inter-vertebral disk */}
          <mesh position={[0, -0.27, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.1, 24]} />
            <meshStandardMaterial color="#dca580" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ============================================================
 * Frication particle stream
 * ============================================================ */
function FricationStream({ amount }: { amount: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const particles = useMemo(() => {
    const arr: { phase: number; r: number; y: number }[] = [];
    for (let i = 0; i < 16; i++) {
      arr.push({
        phase: Math.random() * Math.PI * 2,
        r: 0.04 + Math.random() * 0.05,
        y: (Math.random() - 0.5) * 0.06,
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
    <group ref={groupRef} position={[2.6, -0.4, 0]}>
      {particles.map((p, i) => {
        const tt = (t.current * 1.6 + p.phase) % 1;
        const z = Math.sin(p.phase * 2.5 + t.current * 2) * 0.05;
        const x = tt * 0.6;
        const y = p.y + Math.sin(t.current * 5 + p.phase) * 0.03;
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
 * Articulator scene with smooth pose interpolation
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

    const [vals, setVals] = useState<Pose>({ ...IDLE_POSE });

    useFrame((_, dt) => {
      const t = targetRef.current;
      const c = currentRef.current;
      const k = 1 - Math.pow(0.001, dt);

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
        <NasalCavity />
        <PharyngealWall />
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
          tipX={vals.tongueTipX}
          bodyY={vals.tongueBodyY}
          bodyX={vals.tongueBodyX}
        />
        <Epiglottis />
        <Larynx frication={vals.frication} />
        <VertebralColumn />
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
  const [crossSection, setCrossSection] = useState(true);
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
      <div className="relative h-[560px] flex-1 overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 to-slate-700 shadow-inner lg:h-auto">
        <Canvas
          shadows
          camera={{ position: [6.5, 1.5, 6.0], fov: 36, near: 0.1, far: 100 }}
          dpr={[1, 2]}
        >
          <color attach="background" args={["#0f172a"]} />
          <fog attach="fog" args={["#0f172a", 14, 28]} />

          <ambientLight intensity={0.6} />
          <directionalLight
            position={[6, 7, 5]}
            intensity={1.0}
            color="#fff5e6"
          />
          <directionalLight
            position={[-5, 2, -3]}
            intensity={0.4}
            color="#a8c0ff"
          />
          <pointLight position={[2.5, 0.3, 1.5]} intensity={0.6} color="#ffb98a" />

          <group position={[0, 0, 0]}>
            <HeadSilhouette visible={headOn} crossSection={crossSection} />
            <Articulators ref={sceneRef} idleBreath={idleBreath} />
          </group>

          <gridHelper
            args={[10, 20, "#334155", "#1f2937"]}
            position={[0, -3.1, 0]}
          />

          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            autoRotate={autoRotate}
            autoRotateSpeed={0.6}
            minDistance={2.5}
            maxDistance={16}
            target={[0.5, 0, 0]}
          />
          <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
            <GizmoViewport
              axisColors={["#ef4444", "#22c55e", "#3b82f6"]}
              labelColor="#0f172a"
            />
          </GizmoHelper>

          {showStats && <Stats />}
        </Canvas>

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
            머리 외형
          </label>
          <label className="flex items-center gap-2 rounded-md bg-black/40 px-2 py-1 text-xs text-slate-100 backdrop-blur">
            <input
              type="checkbox"
              checked={crossSection}
              onChange={(e) => setCrossSection(e.target.checked)}
            />
            단면도 모드
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
          <div className="mb-1 font-medium text-slate-700">표시 구조</div>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>외형: 두개골 · 안면 윤곽 (단면도 토글)</li>
            <li>비강: 상·중·하 비갑개 (turbinates)</li>
            <li>구강: 경구개 · 연구개 · 구개수(uvula)</li>
            <li>혀: 설근·설체·설첨, 자세별 변형</li>
            <li>인두 후벽 · 후두개(epiglottis)</li>
            <li>후두: 갑상연골 · 성대(vocal folds)</li>
            <li>경추: 6개 척추체</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
