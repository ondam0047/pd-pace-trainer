"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Bounds,
  GizmoHelper,
  GizmoViewport,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = "/models/head-sagittal-rigged.glb";

type Ctrl = {
  jaw: number; // 0..1 open
  tip: number; // -1..1 (up+)
  body: number; // -1..1 (up+)
  velum: number; // 0..1 lower
  lip: number; // 0..1 close
  metalness: number;
  playing: boolean;
  rate: number;
};

function Rig({ ctrl }: { ctrl: React.RefObject<Ctrl> }) {
  const { scene } = useGLTF(MODEL_URL);
  const bones = useRef<Record<string, THREE.Object3D | null>>({});
  const rest = useRef<Record<string, THREE.Vector3>>({});
  const t = useRef(0);

  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat && "metalness" in mat) {
          mat.metalness = 0;
          mat.roughness = 0.85;
          mat.side = THREE.DoubleSide;
          mat.needsUpdate = true;
        }
      }
    });
    for (const name of ["jaw", "tongue_body", "tongue_tip", "velum", "lip_upper"]) {
      const b = scene.getObjectByName(name) || null;
      bones.current[name] = b;
      if (b) rest.current[name] = b.position.clone();
    }
  }, [scene]);

  useFrame((_, dt) => {
    const c = ctrl.current;
    if (!c) return;
    let jaw = c.jaw,
      tip = c.tip,
      velum = c.velum,
      lip = c.lip;
    if (c.playing) {
      t.current += dt * c.rate;
      const tri = Math.abs(((t.current % 1) * 2) - 1); // 0..1..0
      const g = tri * tri * (3 - 2 * tri);
      jaw = 0.15 + g * 0.5;
      tip = g * 0.8;
      lip = 0;
      velum = 0;
    }
    const b = bones.current;
    if (b.jaw) b.jaw.rotation.z = -jaw * 0.5;
    if (b.tongue_tip) b.tongue_tip.rotation.z = tip * 0.9;
    if (b.tongue_body && rest.current.tongue_body) {
      b.tongue_body.position.y = rest.current.tongue_body.y + c.body * 0.14;
      b.tongue_body.position.x =
        rest.current.tongue_body.x - Math.max(0, c.body) * 0.06;
    }
    if (b.velum) b.velum.rotation.z = -velum * 0.7;
    if (b.lip_upper && rest.current.lip_upper) {
      b.lip_upper.position.y = rest.current.lip_upper.y - lip * 0.07;
    }
  });

  return <primitive object={scene} />;
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
      <span className="w-20">{label}</span>
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

export default function GlbHeadViewer() {
  const ctrl = useRef<Ctrl>({
    jaw: 0.1,
    tip: 0,
    body: 0,
    velum: 0,
    lip: 0,
    metalness: 0,
    playing: false,
    rate: 2,
  });
  const [, force] = useState(0);
  const set = (patch: Partial<Ctrl>) => {
    Object.assign(ctrl.current, patch);
    force((n) => n + 1);
  };
  const c = ctrl.current;
  const [autoRotate, setAutoRotate] = useState(false);

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
          camera={{ position: [2.4, 0, 0.6], fov: 35, near: 0.01, far: 100 }}
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
              <Rig ctrl={ctrl} />
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
          <h3 className="text-base font-semibold text-slate-900">조음기관 리깅 (GLB)</h3>
          <p className="mt-1 text-xs text-slate-500">
            본(턱·혀·연구개·입술)으로 실사 모델을 직접 움직입니다. 슬라이더로
            자유롭게 조정하거나 반복 재생으로 자동 조음을 봅니다.
          </p>
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

        <div className="mt-1 border-t border-slate-100 pt-2">
          <div className="mb-1 text-xs font-medium text-slate-700">수동 제어</div>
          <div className="flex flex-col gap-2">
            <Slider label="턱 벌림" min={0} max={1} step={0.01} value={c.jaw} onChange={(v) => set({ jaw: v, playing: false })} />
            <Slider label="혀끝" min={-1} max={1} step={0.01} value={c.tip} onChange={(v) => set({ tip: v, playing: false })} />
            <Slider label="혀 몸통" min={-1} max={1} step={0.01} value={c.body} onChange={(v) => set({ body: v, playing: false })} />
            <Slider label="연구개" min={0} max={1} step={0.01} value={c.velum} onChange={(v) => set({ velum: v, playing: false })} />
            <Slider label="윗입술" min={0} max={1} step={0.01} value={c.lip} onChange={(v) => set({ lip: v, playing: false })} />
          </div>
        </div>

        <Slider label="금속감" min={0} max={1} step={0.05} value={c.metalness} onChange={(v) => set({ metalness: v })} />

        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
          자동 회전
        </label>

        <div className="mt-1 rounded-xl bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800">
          <b>1차 리깅:</b> 본 가중치는 좌표 기반 자동 생성이라 경계가 어색할 수
          있습니다. 슬라이더로 움직여 보시고 어느 부위를 더 다듬을지 알려주시면
          가중치/본 위치를 조정합니다. 방향이 반대면(예: 턱이 위로) 알려주세요.
        </div>
      </div>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
