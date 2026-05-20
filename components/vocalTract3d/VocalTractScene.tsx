"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import {
  ALL_PHONEMES,
  CONSONANTS,
  VOWELS,
  type PhonemeDef,
  type PhonemeParams,
} from "./phonemeParams";

/**
 * 절차적 3D 성도 시각화.
 *
 * 측면 단면(sagittal) 윤곽을 두께 0.3 의 측방 사출(extrude)로 만들어
 * "반쪽 머리" 느낌을 줍니다. 마우스 드래그로 자유 회전 — 정면/측면/뒷면
 * 모두 회전해서 볼 수 있습니다.
 *
 * 구성
 *  - 상악(경구개·연구개·뒷벽) : 정적 셔이프
 *  - 하악(턱·하순) : jawOpen 으로 회전
 *  - 혀 (몸체 + 끝) : 위치·크기를 모음/자음 파라미터로 변형
 *  - 입술 : aperture/protrusion 으로 두 메쉬 간 간격 조정
 *  - 연구개 (velum) : 닫힘/열림 회전
 *  - 협착점 마커 : 자음 활성 시 빨간 구로 표시
 */

interface SceneProps {
  phoneme: PhonemeDef;
  showLabels?: boolean;
}

// 측면 윤곽의 깊이 (z-축 두께)
const SAGITTAL_DEPTH = 0.4;

function makeProfileExtrude(
  points: THREE.Vector2[],
  depth = SAGITTAL_DEPTH,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape(points);
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: 0.02,
    bevelThickness: 0.02,
    bevelSegments: 3,
  });
}

// ----- 정적 구조 -----

function UpperVocalTract() {
  // 경구개 + 연구개 + 후두 뒷벽의 외곽선 (대략적인 한국 성인 남성 비례)
  const geom = useMemo(() => {
    const p = [
      new THREE.Vector2(1.0, 0.35), // 윗입술 위
      new THREE.Vector2(0.85, 0.5),
      new THREE.Vector2(0.6, 0.55), // 윗 잇몸
      new THREE.Vector2(0.3, 0.6), // 경구개 앞
      new THREE.Vector2(-0.1, 0.6), // 경구개 뒤
      new THREE.Vector2(-0.4, 0.55), // 연구개 시작
      new THREE.Vector2(-0.6, 0.4), // 인두 뒷벽 위
      new THREE.Vector2(-0.7, 0.0), // 인두 뒷벽
      new THREE.Vector2(-0.7, -0.5), // 성문 부근
      new THREE.Vector2(-0.95, -0.5), // 두개 바깥 (외곽)
      new THREE.Vector2(-0.95, 0.95),
      new THREE.Vector2(1.05, 0.95),
      new THREE.Vector2(1.05, 0.35),
    ];
    return makeProfileExtrude(p);
  }, []);
  return (
    <mesh
      geometry={geom}
      position={[0, 0, -SAGITTAL_DEPTH / 2]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color="#f6d4c8" roughness={0.7} metalness={0.05} />
    </mesh>
  );
}

function LowerJaw({ jawOpen }: { jawOpen: number }) {
  // 턱은 힌지(귀 부근, 약 x=-0.55) 를 중심으로 회전
  const geom = useMemo(() => {
    const p = [
      new THREE.Vector2(1.0, 0.0), // 아랫입술 위
      new THREE.Vector2(0.95, -0.05),
      new THREE.Vector2(0.6, -0.1), // 아래 잇몸
      new THREE.Vector2(0.2, -0.2),
      new THREE.Vector2(-0.2, -0.35),
      new THREE.Vector2(-0.5, -0.4), // 턱 뒤
      new THREE.Vector2(-0.6, -0.65),
      new THREE.Vector2(-0.55, -0.95), // 턱 끝 외곽
      new THREE.Vector2(1.05, -0.95),
      new THREE.Vector2(1.05, 0.0),
    ];
    return makeProfileExtrude(p);
  }, []);

  // 부드러운 보간
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const target = -jawOpen * 0.35; // 라디안
    ref.current.rotation.z += (target - ref.current.rotation.z) * 0.18;
  });

  return (
    <group ref={ref} position={[-0.55, -0.4, 0]}>
      <mesh
        geometry={geom}
        position={[0.55, 0.4, -SAGITTAL_DEPTH / 2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#eebfb1"
          roughness={0.75}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
}

function Tongue({ params }: { params: PhonemeParams }) {
  const bodyRef = useRef<THREE.Mesh>(null);
  const tipRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    // 부드러운 보간으로 위치/스케일 이동
    if (bodyRef.current) {
      const m = bodyRef.current;
      const targetX = params.tongueBodyX;
      const targetY = params.tongueBodyY;
      const targetS = params.tongueBodyRadius * 3.4;
      m.position.x += (targetX - m.position.x) * 0.18;
      m.position.y += (targetY - m.position.y) * 0.18;
      m.scale.x += (targetS - m.scale.x) * 0.18;
      m.scale.y += (targetS * 0.7 - m.scale.y) * 0.18;
      m.scale.z += (targetS * 0.85 - m.scale.z) * 0.18;
    }
    if (tipRef.current) {
      const m = tipRef.current;
      const targetX = params.tongueTipX;
      const targetY = params.tongueTipY;
      const targetS = params.tongueTipRadius * 3.0;
      m.position.x += (targetX - m.position.x) * 0.18;
      m.position.y += (targetY - m.position.y) * 0.18;
      m.scale.setScalar(m.scale.x + (targetS - m.scale.x) * 0.18);
    }
  });

  return (
    <group>
      <mesh ref={bodyRef} castShadow position={[0.1, 0.05, 0]}>
        <sphereGeometry args={[0.3, 32, 24]} />
        <meshStandardMaterial color="#cc4848" roughness={0.4} metalness={0.1} />
      </mesh>
      <mesh ref={tipRef} castShadow position={[0.5, -0.05, 0]}>
        <sphereGeometry args={[0.08, 24, 18]} />
        <meshStandardMaterial color="#dd5252" roughness={0.4} metalness={0.1} />
      </mesh>
    </group>
  );
}

function Lips({
  aperture,
  protrusion,
}: {
  aperture: number;
  protrusion: number;
}) {
  // 두 개의 원환(torus)을 위/아래로 두어 입술 표현
  const upperRef = useRef<THREE.Mesh>(null);
  const lowerRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (upperRef.current) {
      const m = upperRef.current;
      const targetY = 0.18 + aperture * 0.18;
      const targetX = 1.0 + protrusion * 0.18;
      m.position.y += (targetY - m.position.y) * 0.18;
      m.position.x += (targetX - m.position.x) * 0.18;
      // 원순성이 크면 환 두께가 커짐
      const targetS = 1.0 + protrusion * 0.5;
      m.scale.setScalar(m.scale.x + (targetS - m.scale.x) * 0.18);
    }
    if (lowerRef.current) {
      const m = lowerRef.current;
      const targetY = 0.02 - aperture * 0.18;
      const targetX = 1.0 + protrusion * 0.18;
      m.position.y += (targetY - m.position.y) * 0.18;
      m.position.x += (targetX - m.position.x) * 0.18;
      const targetS = 1.0 + protrusion * 0.5;
      m.scale.setScalar(m.scale.x + (targetS - m.scale.x) * 0.18);
    }
  });

  return (
    <group>
      <mesh ref={upperRef} position={[1.0, 0.18, 0]} castShadow>
        <torusGeometry args={[0.12, 0.04, 16, 24, Math.PI]} />
        <meshStandardMaterial color="#c64a4a" roughness={0.35} />
      </mesh>
      <mesh
        ref={lowerRef}
        position={[1.0, 0.02, 0]}
        rotation={[0, 0, Math.PI]}
        castShadow
      >
        <torusGeometry args={[0.12, 0.04, 16, 24, Math.PI]} />
        <meshStandardMaterial color="#c64a4a" roughness={0.35} />
      </mesh>
    </group>
  );
}

function Velum({ open }: { open: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    // 닫힘 = 수평, 열림 = 위로 회전 (비음 시 비강 통로 개방)
    const target = open * 0.6;
    ref.current.rotation.z += (target - ref.current.rotation.z) * 0.18;
  });
  return (
    <mesh
      ref={ref}
      position={[-0.35, 0.45, 0]}
      castShadow
    >
      <boxGeometry args={[0.25, 0.04, SAGITTAL_DEPTH * 0.9]} />
      <meshStandardMaterial color="#e89c8c" roughness={0.6} />
    </mesh>
  );
}

function ConstrictionMarker({
  point,
  degree,
}: {
  point: number;
  degree: number;
}) {
  // 협착점을 빨간 구로 표시 (point: 0=성문, 1=입술)
  if (degree < 0.2) return null;
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    // 성문(-0.7, -0.3) → 입술(1.0, 0.2) 사이의 베지어 곡선 추적
    const t = point;
    const x = -0.7 + (1.0 - -0.7) * t;
    const y = -0.3 + 0.5 * Math.sin(t * Math.PI) + (t > 0.7 ? (t - 0.7) * 0.3 : 0);
    ref.current.position.x += (x - ref.current.position.x) * 0.18;
    ref.current.position.y += (y - ref.current.position.y) * 0.18;
    const targetS = 0.04 + degree * 0.06;
    ref.current.scale.setScalar(
      ref.current.scale.x + (targetS - ref.current.scale.x) * 0.18,
    );
  });
  return (
    <mesh ref={ref} position={[0.5, 0.3, 0]}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshStandardMaterial
        color="#ef4444"
        emissive="#ef4444"
        emissiveIntensity={0.5}
      />
    </mesh>
  );
}

function Scene({ phoneme }: SceneProps) {
  // useFrame 기반 보간으로 각 부품이 직접 보간을 함 — 여기서는 phoneme.params 만 넘김
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[3, 4, 5]}
        intensity={0.9}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-3, 2, -3]} intensity={0.35} />
      <UpperVocalTract />
      <LowerJaw jawOpen={phoneme.params.jawOpen} />
      <Tongue params={phoneme.params} />
      <Lips
        aperture={phoneme.params.lipAperture}
        protrusion={phoneme.params.lipProtrusion}
      />
      <Velum open={phoneme.params.velumOpen} />
      <ConstrictionMarker
        point={phoneme.params.constrictionPoint}
        degree={phoneme.params.constrictionDegree}
      />
      {/* 바닥 (그림자 받기) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1.0, 0]}
        receiveShadow
      >
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.95} />
      </mesh>
      {/* 정면 라벨 — 카메라가 어느 방향이든 보이도록 Html */}
      <Html position={[0, -0.85, 0.3]} center distanceFactor={3} occlude={false}>
        <div className="select-none rounded bg-white/85 px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-sm">
          {phoneme.label} <span className="text-slate-400">{phoneme.symbol}</span>
        </div>
      </Html>
    </>
  );
}

// ----- 외부 컴포넌트 -----

export default function VocalTract3D({
  initialPhonemeId = "a",
}: {
  initialPhonemeId?: string;
}) {
  const [active, setActive] = useState<string>(initialPhonemeId);
  const phoneme = ALL_PHONEMES.find((p) => p.id === active) ?? VOWELS[2];

  return (
    <div className="space-y-3">
      <div className="relative h-[480px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 shadow-inner">
        <Canvas
          shadows
          camera={{ position: [1.6, 0.6, 2.6], fov: 38 }}
          gl={{ antialias: true }}
        >
          <Scene phoneme={phoneme} />
          <OrbitControls
            enablePan={false}
            minDistance={1.8}
            maxDistance={5.5}
            target={[0, 0, 0]}
          />
        </Canvas>
        <div className="pointer-events-none absolute left-3 top-3 rounded bg-white/85 px-2 py-1 text-[10px] font-medium text-slate-600 shadow-sm">
          드래그 = 회전 · 휠 = 줌
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          모음 (단모음 7종)
        </p>
        <div className="flex flex-wrap gap-2">
          {VOWELS.map((p) => (
            <button
              key={p.id}
              onClick={() => setActive(p.id)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                active === p.id
                  ? "border-blue-500 bg-blue-500 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div>{p.label}</div>
              <div
                className={`text-[10px] ${active === p.id ? "text-blue-100" : "text-slate-500"}`}
              >
                {p.symbol}
              </div>
            </button>
          ))}
        </div>

        <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          자음 (대표)
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {CONSONANTS.map((p) => (
            <button
              key={p.id}
              onClick={() => setActive(p.id)}
              className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                active === p.id
                  ? "border-rose-500 bg-rose-500 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              title={p.description}
            >
              <div className="text-base">{p.label}</div>
              <div
                className={`text-[10px] ${active === p.id ? "text-rose-100" : "text-slate-500"}`}
              >
                {p.symbol}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <span className="font-semibold">{phoneme.label} {phoneme.symbol}</span>
          {" "}— {phoneme.description}
        </div>
      </div>

      <details className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-slate-700">
          모델 한계 + 근거
        </summary>
        <div className="mt-2 space-y-1 text-xs text-slate-600">
          <p>
            모든 장면은 코드에서 절차적으로 생성됩니다 (자산 의존 0). 음향
            물리(area function) 가 아닌 시각적 학습용 단순화 모델이며, 실제
            성도 단면과 정확히 일치하지 않습니다.
          </p>
          <p>
            파라미터 근거: Maeda (1990) 보정 조음 모델, Browman &amp; Goldstein
            (1989) 조음 음운론, 신지영 (2014) 『한국어의 말소리』.
          </p>
        </div>
      </details>
    </div>
  );
}
