"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Bounds,
  GizmoHelper,
  GizmoViewport,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = "/models/head-combined.glb";

/* Static realistic shell — combined model with head + tongue + lips */
function Shell({
  metalness,
  showHead,
  showTongue,
  showLips,
}: {
  metalness: number;
  showHead: boolean;
  showTongue: boolean;
  showLips: boolean;
}) {
  const { scene } = useGLTF(MODEL_URL);
  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat && "metalness" in mat) {
          mat.metalness = metalness;
          mat.roughness = 0.85;
          mat.side = THREE.DoubleSide;
          mat.needsUpdate = true;
        }
      }
    });
  }, [scene, metalness]);
  useEffect(() => {
    const map: Record<string, boolean> = {
      head: showHead,
      tongue: showTongue,
      lips: showLips,
    };
    for (const [name, vis] of Object.entries(map)) {
      const node = scene.getObjectByName(name);
      if (node) node.visible = vis;
    }
  }, [scene, showHead, showTongue, showLips]);
  return <primitive object={scene} />;
}

type Ctrl = {
  tip: number; // 0..1 raise
  body: number; // -1..1 up+/back
  velum: number; // 0..1 lower
  upperLip: number; // 0..1 close (down)
  lowerLip: number; // 0..1 close (up)
  // alignment
  ax: number;
  ay: number;
  az: number;
  scale: number;
  metalness: number;
  visible: boolean;
  playing: boolean;
  rate: number;
};

const PINK = "#d98a86";

/* Procedural movable articulators, positioned in GLB model space */
function Articulators({ ctrl }: { ctrl: React.RefObject<Ctrl> }) {
  const group = useRef<THREE.Group>(null);
  const tipPivot = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const velumPivot = useRef<THREE.Group>(null);
  const upRef = useRef<THREE.Mesh>(null);
  const loRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  useFrame((_, dt) => {
    const c = ctrl.current;
    if (!c || !group.current) return;
    group.current.visible = c.visible;
    group.current.position.set(c.ax, c.ay, c.az);
    group.current.scale.setScalar(c.scale);

    let tip = c.tip,
      velum = c.velum,
      up = c.upperLip,
      lo = c.lowerLip,
      body = c.body;
    if (c.playing) {
      t.current += dt * c.rate;
      const tri = Math.abs(((t.current % 1) * 2) - 1);
      const g = tri * tri * (3 - 2 * tri);
      tip = g; // tap tongue tip
      up = g * 0.6;
      lo = g * 0.6;
    }
    if (tipPivot.current) tipPivot.current.rotation.z = tip * 1.0;
    if (bodyRef.current) {
      bodyRef.current.position.set(
        -Math.max(0, body) * 0.05,
        body * 0.08,
        0,
      );
    }
    if (velumPivot.current) velumPivot.current.rotation.z = -velum * 0.9;
    if (upRef.current) upRef.current.position.y = 0.07 - up * 0.06;
    if (loRef.current) loRef.current.position.y = -0.06 + lo * 0.06;
  });

  return (
    <group ref={group}>
      {/* tongue body */}
      <group ref={bodyRef}>
        <mesh position={[0.04, -0.11, 0]} scale={[0.17, 0.08, 0.07]}>
          <sphereGeometry args={[1, 24, 18]} />
          <meshStandardMaterial color={PINK} roughness={0.5} />
        </mesh>
      </group>
      {/* tongue tip (pivot near blade) */}
      <group position={[0.12, -0.09, 0]}>
        <group ref={tipPivot}>
          <mesh position={[0.06, 0, 0]} scale={[0.08, 0.045, 0.05]}>
            <sphereGeometry args={[1, 20, 14]} />
            <meshStandardMaterial color={PINK} roughness={0.5} />
          </mesh>
        </group>
      </group>
      {/* velum + uvula (hinge at back of palate) */}
      <group position={[-0.02, 0.16, 0]}>
        <group ref={velumPivot}>
          <mesh position={[-0.06, -0.05, 0]} scale={[0.09, 0.03, 0.06]} rotation={[0, 0, -0.5]}>
            <sphereGeometry args={[1, 18, 12]} />
            <meshStandardMaterial color="#cf7f84" roughness={0.5} />
          </mesh>
          <mesh position={[-0.11, -0.1, 0]} scale={[0.022, 0.04, 0.025]}>
            <sphereGeometry args={[1, 14, 12]} />
            <meshStandardMaterial color="#c96f6a" roughness={0.5} />
          </mesh>
        </group>
      </group>
      {/* upper lip */}
      <mesh ref={upRef} position={[0.42, 0.07, 0]} scale={[0.04, 0.045, 0.07]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color="#c75f57" roughness={0.45} />
      </mesh>
      {/* lower lip */}
      <mesh ref={loRef} position={[0.42, -0.06, 0]} scale={[0.045, 0.05, 0.07]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color="#c75f57" roughness={0.45} />
      </mesh>
    </group>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-slate-700">
      <span className="w-16">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1"
      />
      <span className="w-10 tabular-nums text-right">{value.toFixed(2)}</span>
    </label>
  );
}

export default function GlbHybridViewer() {
  const ctrl = useRef<Ctrl>({
    tip: 0,
    body: 0,
    velum: 0,
    upperLip: 0,
    lowerLip: 0,
    ax: 0,
    ay: 0,
    az: 0,
    scale: 1,
    metalness: 0,
    visible: false,
    playing: false,
    rate: 2,
  });
  const [, force] = useState(0);
  const set = (p: Partial<Ctrl>) => {
    Object.assign(ctrl.current, p);
    force((n) => n + 1);
  };
  const c = ctrl.current;
  const [showAlign, setShowAlign] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showHead, setShowHead] = useState(true);
  const [showTongue, setShowTongue] = useState(true);
  const [showLips, setShowLips] = useState(true);

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
          camera={{ position: [2.4, 0, 0.5], fov: 35, near: 0.01, far: 100 }}
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true }}
        >
          <ambientLight intensity={0.6} />
          <hemisphereLight args={["#fff1e8", "#2a2030", 0.5]} />
          <directionalLight position={[3, 4, 6]} intensity={1.2} color="#fff2e6" />
          <directionalLight position={[-4, 1.5, 3]} intensity={0.5} color="#cfe0ff" />
          <pointLight position={[2, 0, 4]} intensity={0.5} color="#ffd9c0" />

          <Suspense fallback={null}>
            <Bounds fit clip observe margin={1.15}>
              <Shell
                metalness={c.metalness}
                showHead={showHead}
                showTongue={showTongue}
                showLips={showLips}
              />
              <Articulators ctrl={ctrl} />
            </Bounds>
          </Suspense>

          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            autoRotate={autoRotate}
            autoRotateSpeed={0.6}
            minDistance={0.5}
            maxDistance={20}
            makeDefault
          />
          <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
            <GizmoViewport axisColors={["#ef4444", "#22c55e", "#3b82f6"]} labelColor="#0f172a" />
          </GizmoHelper>
        </Canvas>

        <div className="pointer-events-none absolute left-4 top-4 rounded-md bg-white/70 px-3 py-2 text-xs text-slate-700 backdrop-blur">
          <div className="font-semibold">조작</div>
          <div>· 왼쪽 드래그: 회전 · 휠: 줌 · 오른쪽 드래그: 이동</div>
        </div>
      </div>

      <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm lg:w-80">
        <div>
          <h3 className="text-base font-semibold text-slate-900">실사 통합 모델 (GLB)</h3>
          <p className="mt-1 text-xs text-slate-500">
            사지철 머리 + 풀 3D 혀 + 풀 3D 입술이 결합된 통합 모델. 리거에게
            발주 예정인 데이터. 리깅 후 자음 자세 표현 가능.
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 p-3">
          <div className="mb-2 text-xs font-medium text-slate-700">부위 표시</div>
          <div className="flex flex-col gap-1.5 text-xs text-slate-700">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showHead} onChange={(e) => setShowHead(e.target.checked)} />
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#bbb" }} />
              사지철 머리 (head)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showTongue} onChange={(e) => setShowTongue(e.target.checked)} />
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#d56363" }} />
              혀 (tongue)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showLips} onChange={(e) => setShowLips(e.target.checked)} />
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#d68a64" }} />
              입술 (lips)
            </label>
          </div>
        </div>

        <button
          onClick={() => set({ playing: !c.playing })}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          {c.playing ? "⏸ 정지" : "▶ 반복 조음 재생"}
        </button>
        {c.playing && (
          <Slider label="속도" min={0.5} max={4} step={0.1} value={c.rate} onChange={(v) => set({ rate: v })} />
        )}

        <div className="border-t border-slate-100 pt-2">
          <div className="mb-1 text-xs font-medium text-slate-700">움직임</div>
          <div className="flex flex-col gap-2">
            <Slider label="혀끝" min={0} max={1} step={0.01} value={c.tip} onChange={(v) => set({ tip: v, playing: false })} />
            <Slider label="혀 몸통" min={-1} max={1} step={0.01} value={c.body} onChange={(v) => set({ body: v, playing: false })} />
            <Slider label="연구개" min={0} max={1} step={0.01} value={c.velum} onChange={(v) => set({ velum: v, playing: false })} />
            <Slider label="윗입술" min={0} max={1} step={0.01} value={c.upperLip} onChange={(v) => set({ upperLip: v, playing: false })} />
            <Slider label="아랫입술" min={0} max={1} step={0.01} value={c.lowerLip} onChange={(v) => set({ lowerLip: v, playing: false })} />
          </div>
        </div>

        <button
          onClick={() => setShowAlign((s) => !s)}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
        >
          {showAlign ? "정렬 숨기기" : "정렬 조정 열기"}
        </button>
        {showAlign && (
          <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-2">
            <Slider label="좌우(X)" min={-0.6} max={0.6} step={0.005} value={c.ax} onChange={(v) => set({ ax: v })} />
            <Slider label="상하(Y)" min={-0.6} max={0.6} step={0.005} value={c.ay} onChange={(v) => set({ ay: v })} />
            <Slider label="깊이(Z)" min={-0.3} max={0.3} step={0.005} value={c.az} onChange={(v) => set({ az: v })} />
            <Slider label="크기" min={0.4} max={2} step={0.01} value={c.scale} onChange={(v) => set({ scale: v })} />
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={c.visible} onChange={(e) => set({ visible: e.target.checked })} />
              가동부 표시
            </label>
            <p className="text-[11px] text-slate-500">
              가동부가 입·코 구강 안에 들어오도록 X/Y/크기를 맞춘 뒤, 그 값을
              알려주시면 기본값으로 고정하겠습니다.
            </p>
          </div>
        )}

        <Slider label="금속감" min={0} max={1} step={0.05} value={c.metalness} onChange={(v) => set({ metalness: v })} />
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
          자동 회전
        </label>
      </div>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
