"use client";

// RAW morph inspector — loads a rigged GLB and exposes every morph target as a
// 0..1 slider applied DIRECTLY to morphTargetInfluences (no velum inversion, no
// vertex hacks, no jaw coupling). For verifying the rigger's shape keys as-is.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, OrbitControls, GizmoHelper, GizmoViewport } from "@react-three/drei";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = "/models/head-rigged-v25.glb?v=23";

type MeshInfo = { mesh: THREE.Mesh; name: string; morphs: string[] };

function Model({
  values,
  hidden,
  headAlpha,
  onReady,
}: {
  values: Record<string, number>;
  hidden: Record<string, boolean>;
  headAlpha: number;
  onReady: (infos: MeshInfo[]) => void;
}) {
  const { scene } = useGLTF(MODEL_URL);
  const infos = useRef<MeshInfo[]>([]);

  useEffect(() => {
    const found: MeshInfo[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.morphTargetDictionary) {
        found.push({
          mesh: m,
          name: m.name,
          morphs: Object.keys(m.morphTargetDictionary),
        });
        // make double-sided so cut-section interiors render
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          (mat as THREE.Material).side = THREE.DoubleSide;
          (mat as THREE.Material).transparent = true;
          (mat as THREE.Material).depthWrite = true;
        }
      }
    });
    infos.current = found;
    onReady(found);
  }, [scene, onReady]);

  // apply values every render
  useEffect(() => {
    for (const info of infos.current) {
      const dict = info.mesh.morphTargetDictionary!;
      const inf = info.mesh.morphTargetInfluences!;
      for (const [name, idx] of Object.entries(dict)) {
        inf[idx] = values[`${info.name}.${name}`] ?? 0;
      }
      info.mesh.visible = !hidden[info.name];
      const mats = Array.isArray(info.mesh.material)
        ? info.mesh.material
        : [info.mesh.material];
      for (const mat of mats) {
        const mm = mat as THREE.MeshStandardMaterial;
        mm.opacity = info.name === "head" ? headAlpha : 1;
      }
    }
  });

  return <primitive object={scene} />;
}

export default function RawMorphViewer() {
  const [values, setValues] = useState<Record<string, number>>({});
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [headAlpha, setHeadAlpha] = useState(1);
  const [infos, setInfos] = useState<MeshInfo[]>([]);

  const onReady = useMemo(
    () => (found: MeshInfo[]) =>
      setInfos(
        found.map((f) => ({ mesh: f.mesh, name: f.name, morphs: f.morphs }))
      ),
    []
  );

  const set = (k: string, v: number) =>
    setValues((p) => ({ ...p, [k]: v }));
  const resetAll = () => setValues({});

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <div className="h-[70vh] flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        <Canvas camera={{ position: [0, 0, 3], fov: 35 }} dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[3, 4, 5]} intensity={1.1} />
          <directionalLight position={[-3, 2, -4]} intensity={0.5} />
          <Suspense fallback={null}>
            <Bounds fit clip observe margin={1.1}>
              <Model
                values={values}
                hidden={hidden}
                headAlpha={headAlpha}
                onReady={onReady}
              />
            </Bounds>
          </Suspense>
          <OrbitControls makeDefault />
          <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
            <GizmoViewport />
          </GizmoHelper>
        </Canvas>
      </div>

      <div className="w-full shrink-0 space-y-3 lg:w-80">
        <div className="flex items-center gap-2">
          <button
            onClick={resetAll}
            className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
          >
            전체 0으로
          </button>
          <label className="ml-auto flex items-center gap-1 text-xs text-slate-600">
            head α
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={headAlpha}
              onChange={(e) => setHeadAlpha(parseFloat(e.target.value))}
            />
          </label>
        </div>

        {infos.map((info) => (
          <div
            key={info.name}
            className="rounded-lg border border-slate-200 bg-white p-2"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">
                {info.name}{" "}
                <span className="text-xs font-normal text-slate-400">
                  ({info.morphs.length})
                </span>
              </span>
              <label className="flex items-center gap-1 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={!hidden[info.name]}
                  onChange={(e) =>
                    setHidden((p) => ({ ...p, [info.name]: !e.target.checked }))
                  }
                />
                표시
              </label>
            </div>
            {info.morphs.map((mp) => {
              const k = `${info.name}.${mp}`;
              const v = values[k] ?? 0;
              return (
                <div key={k} className="flex items-center gap-2 py-0.5">
                  <span className="w-40 truncate text-[11px] text-slate-600">
                    {mp}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={v}
                    onChange={(e) => set(k, parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-8 text-right text-[10px] tabular-nums text-slate-400">
                    {v.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
