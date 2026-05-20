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

const MODEL_URL = "/models/head-sagittal.glb";

function HeadModel({
  metalness,
  flatLit,
  clip,
  clipAxis,
  clipPos,
}: {
  metalness: number;
  flatLit: boolean;
  clip: boolean;
  clipAxis: "x" | "y" | "z";
  clipPos: number;
}) {
  const { scene } = useGLTF(MODEL_URL);

  // Normalize materials (Meshy exports often set metalness=1 which renders dark
  // without an HDR environment). Force a sane albedo-lit setup.
  const cloned = useMemo(() => {
    const s = scene.clone(true);
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat && "metalness" in mat) {
          mat.metalness = metalness;
          mat.roughness = 0.85;
          mat.side = THREE.DoubleSide;
          mat.needsUpdate = true;
        }
      }
    });
    return s;
  }, [scene, metalness]);

  const plane = useMemo(() => {
    const n = new THREE.Vector3(
      clipAxis === "x" ? 1 : 0,
      clipAxis === "y" ? 1 : 0,
      clipAxis === "z" ? 1 : 0,
    );
    return new THREE.Plane(n, 0);
  }, [clipAxis]);

  useEffect(() => {
    plane.constant = -clipPos;
  }, [plane, clipPos]);

  useEffect(() => {
    cloned.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.clippingPlanes = clip ? [plane] : [];
          mat.clipShadows = true;
          mat.flatShading = flatLit;
          mat.needsUpdate = true;
        }
      }
    });
  }, [cloned, clip, plane, flatLit]);

  return <primitive object={cloned} />;
}

function Spin({ on }: { on: boolean }) {
  useFrame((state, dt) => {
    if (on) state.scene.rotation.y += dt * 0.3;
  });
  return null;
}

export default function GlbHeadViewer() {
  const [metalness, setMetalness] = useState(0);
  const [clip, setClip] = useState(false);
  const [clipAxis, setClipAxis] = useState<"x" | "y" | "z">("z");
  const [clipPos, setClipPos] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const glRef = useRef(false);

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
          camera={{ position: [0, 0, 3], fov: 35, near: 0.01, far: 100 }}
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true, localClippingEnabled: true }}
          shadows
          onCreated={({ gl }) => {
            gl.localClippingEnabled = true;
            glRef.current = true;
          }}
        >
          <ambientLight intensity={0.6} />
          <hemisphereLight args={["#fff1e8", "#2a2030", 0.5]} />
          <directionalLight position={[3, 4, 6]} intensity={1.2} color="#fff2e6" castShadow />
          <directionalLight position={[-4, 1.5, 3]} intensity={0.5} color="#cfe0ff" />
          <pointLight position={[0, 0, 4]} intensity={0.5} color="#ffd9c0" />

          <Suspense fallback={null}>
            <Bounds fit clip observe margin={1.1}>
              <HeadModel
                metalness={metalness}
                flatLit={false}
                clip={clip}
                clipAxis={clipAxis}
                clipPos={clipPos}
              />
            </Bounds>
          </Suspense>
          <Spin on={autoRotate} />

          <OrbitControls
            enablePan
            enableZoom
            enableRotate
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
          <h3 className="text-base font-semibold text-slate-900">실사 모델 (GLB)</h3>
          <p className="mt-1 text-xs text-slate-500">
            Meshy AI 사지털 단면 모델. 방향·구강 위치 확인용 임시 뷰어입니다.
          </p>
        </div>

        <label className="flex items-center justify-between gap-2 text-xs text-slate-700">
          금속감(metalness)
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={metalness}
            onChange={(e) => setMetalness(parseFloat(e.target.value))}
          />
          <span className="w-8 tabular-nums">{metalness.toFixed(2)}</span>
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={clip} onChange={(e) => setClip(e.target.checked)} />
          단면 클리핑(잘라보기)
        </label>

        {clip && (
          <>
            <div className="flex gap-2 text-xs">
              {(["x", "y", "z"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setClipAxis(a)}
                  className={
                    "rounded px-2 py-1 " +
                    (clipAxis === a
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700")
                  }
                >
                  {a.toUpperCase()}축
                </button>
              ))}
            </div>
            <label className="flex items-center justify-between gap-2 text-xs text-slate-700">
              위치
              <input
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={clipPos}
                onChange={(e) => setClipPos(parseFloat(e.target.value))}
              />
              <span className="w-10 tabular-nums">{clipPos.toFixed(2)}</span>
            </label>
          </>
        )}

        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
          자동 회전
        </label>

        <div className="mt-2 rounded-xl bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800">
          <b>참고:</b> 이 모델은 정적(리깅 없음)이라 혀가 스스로 움직이지
          않습니다. 구강을 비우는 작업과, 그 안에 움직이는 조음기관을 넣을지
          여부는 화면 확인 후 결정합니다.
        </div>
      </div>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
