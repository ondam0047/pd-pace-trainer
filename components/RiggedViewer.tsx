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
import {
  CONSONANTS,
  DIPHTHONGS,
  VOWELS,
  LIP_OPACITY,
  VELUM_INVERTED,
  IDLE_POSE,
  mannerOf,
  fullPose,
  lerp,
  lerpPose,
  type Pose,
} from "@/components/articulator/phonemeMap";

const MODEL_URL = "/models/head-rigged.glb?v=25";

const EXPECTED: Record<string, string[]> = {
  tongue: [
    "tongue_tip_up",
    "tongue_tip_down",
    "tongue_front_up",
    "tongue_back_up",
    "tongue_retract",
    "tongue_groove",
    "tongue_lateral_channel",
  ],
  lips: ["lips_closed", "lips_round", "lips_spread", "lips_jaw_open"],
  head: ["jaw_open", "velum_open"],
};

const ZERO = fullPose({});

// ── articulatory gesture timeline ───────────────────────────────────────────
// Each phoneme plays as a sequence of eased segments (onset → hold → release),
// so motion is smooth and stops actually burst open.
type Seg = { pose: Pose; op: number; dur: number };
type Seq = {
  segs: Seg[];
  loop: boolean;
  start: Pose;
  startOp: number;
  i: number;
  elapsed: number;
  active: boolean;
};

function consonantGesture(c: (typeof CONSONANTS)[number]): {
  segs: Seg[];
  loop: boolean;
} {
  const P = fullPose(c.pose);
  const op = c.opacity;
  const idle: Seg = { pose: IDLE_POSE, op: LIP_OPACITY.idle, dur: 0.22 };
  const burst = fullPose({ jaw_open: 0.14 }); // generic oral release
  switch (mannerOf(c.manner)) {
    case "stop":
      return {
        segs: [
          { pose: P, op, dur: 0.16 }, // form closure
          { pose: P, op, dur: 0.13 }, // occlusion (hold)
          { pose: burst, op, dur: 0.09 }, // release burst
          idle,
        ],
        loop: false,
      };
    case "affricate": {
      // ㅈㅊㅉ 치경경구개 파찰: 폐쇄(혀 앞날 접촉) → 느린 개방(마찰)으로 끊김 없이 흐르게.
      const fric = fullPose({ tongue_front_up: 0.55, tongue_groove: 1, jaw_open: 0.18 });
      return {
        segs: [
          { pose: P, op, dur: 0.2 }, // 부드러운 폐쇄 접근
          { pose: fric, op, dur: 0.24 }, // 느린 개방 → 마찰 (파찰음 핵심)
          { pose: fric, op, dur: 0.16 }, // 짧은 마찰 지속
          { pose: IDLE_POSE, op: LIP_OPACITY.idle, dur: 0.24 },
        ],
        loop: false,
      };
    }
    case "nasal": {
      // oral closure releases but the velum stays open through the murmur
      const rel = fullPose({ ...c.pose, lips_closed: 0, tongue_tip_up: 0, jaw_open: 0.1 });
      return {
        segs: [
          { pose: P, op, dur: 0.18 },
          { pose: P, op, dur: 0.5 }, // nasal murmur
          { pose: rel, op, dur: 0.15 },
          { pose: IDLE_POSE, op: LIP_OPACITY.idle, dur: 0.25 },
        ],
        loop: false,
      };
    }
    case "fricative":
      return {
        segs: [
          { pose: P, op, dur: 0.2 },
          { pose: P, op, dur: 0.55 }, // sustained frication
          { pose: IDLE_POSE, op: LIP_OPACITY.idle, dur: 0.2 },
        ],
        loop: false,
      };
    case "tap":
      // 탄설: tip rises to the alveolar ridge, holds 0.5s, then lowers — once.
      return {
        segs: [
          { pose: P, op, dur: 0.15 }, // rise (tongue tip up)
          { pose: P, op, dur: 0.5 }, // hold 0.5s
          { pose: IDLE_POSE, op: LIP_OPACITY.idle, dur: 0.2 }, // lower
        ],
        loop: false,
      };
    case "lateral":
      // 설측: same tip position as the tap + lateral channel, MAINTAINED (sustained).
      return {
        segs: [
          { pose: P, op, dur: 0.2 },
          { pose: P, op, dur: 0.45 }, // hold at target (no return to rest)
        ],
        loop: false,
      };
    default: // glottal ㅎ
      return {
        segs: [
          { pose: P, op, dur: 0.15 },
          { pose: P, op, dur: 0.2 },
          { pose: IDLE_POSE, op: LIP_OPACITY.idle, dur: 0.2 },
        ],
        loop: false,
      };
  }
}

const Z = new THREE.Vector3(0, 0, 1);

type Jaw = {
  on: boolean;
  pivotX: number;
  pivotY: number;
  maxDeg: number;
  tongue: number;
  lips: number;
};

// Web-side placement of the new lips mesh so it sits in front of (not overlapping)
// the head's sagittal-section lips. Clean fix = rigger removes the head lips.
type LipFit = { fwd: number; up: number; scale: number };

// Same idea for the tongue: at rest it pokes through the teeth, so nudge it
// back/down and scale until it sits behind the teeth inside the oral cavity.
// This is the base rest position; all tongue gestures build on top of it.
type TongueFit = { fwd: number; up: number; scale: number };

type Found = { mesh: string; targets: string[] };
type Base = {
  mesh: THREE.Mesh;
  name: string;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  baseVerts: Float32Array | null;
  lipMats: THREE.Material[];
  centroid: THREE.Vector3;
};

function smooth01(t: number) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}

function RiggedModel({
  pose,
  jaw,
  fit,
  tfit,
  seq,
  lip,
  live,
  showArt,
  onIntrospect,
}: {
  pose: React.RefObject<Pose>;
  jaw: React.RefObject<Jaw>;
  fit: React.RefObject<LipFit>;
  tfit: React.RefObject<TongueFit>;
  seq: React.RefObject<Seq>;
  lip: React.RefObject<{ target: number; cur: number }>;
  live: React.RefObject<Pose>;
  showArt: React.RefObject<boolean>;
  onIntrospect: (found: Found[]) => void;
}) {
  const { scene } = useGLTF(MODEL_URL);
  const bases = useRef<Base[]>([]);

  useEffect(() => {
    const found: Found[] = [];
    bases.current = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.morphTargetDictionary) {
        const posAttr = m.geometry.attributes.position as THREE.BufferAttribute;
        const mats =
          m.name === "lips"
            ? Array.isArray(m.material)
              ? m.material
              : [m.material]
            : [];
        for (const mt of mats) mt.transparent = true;
        const c = new THREE.Vector3();
        m.geometry.computeBoundingBox();
        m.geometry.boundingBox!.getCenter(c);
        bases.current.push({
          mesh: m,
          name: m.name,
          pos: m.position.clone(),
          quat: m.quaternion.clone(),
          baseVerts:
            m.name === "lips" || m.name === "tongue"
              ? Float32Array.from(posAttr.array as ArrayLike<number>)
              : null,
          lipMats: mats,
          centroid: c,
        });
        found.push({ mesh: m.name, targets: Object.keys(m.morphTargetDictionary) });
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat && "roughness" in mat) {
          mat.side = THREE.DoubleSide;
          mat.roughness = 0.85;
          mat.metalness = 0;
          if (m.name === "head") {
            // The head texture (head_mask) is OPAQUE everywhere (all salmon)
            // EXCEPT the drawn tongue/lips, which are alpha=0. alphaTest turns
            // ONLY those into clean pixel-perfect HOLES (background shows, side
            // view = img01), while everything else — including the perimeter
            // RIM that forms the front "thickness" band — stays solid. The air
            // cavities are real geometry holes, so they stay open regardless.
            // Rendered FLAT (texture as emissive) so flat panels don't catch
            // extra light and show as silhouettes.
            mat.alphaTest = 0.5;
            mat.transparent = false;
            mat.depthWrite = true;
            mat.emissiveMap = mat.map;
            mat.emissive = new THREE.Color(0xffffff);
            mat.emissiveIntensity = 1;
            mat.color = new THREE.Color(0x000000);
          }
          mat.needsUpdate = true;
        }
      }
    });
    onIntrospect(found);
  }, [scene, onIntrospect]);

  const q = useRef(new THREE.Quaternion()).current;
  const v = useRef(new THREE.Vector3()).current;
  const pivot = useRef(new THREE.Vector3()).current;
  const eff = useRef<Pose>(fullPose({})).current;

  useFrame((_, dt) => {
    const j = jaw.current;
    const s = seq.current;
    const lp = lip.current;
    const f = fit.current;
    let lipTarget = lp.target;

    // 1) resolve effective pose from the gesture timeline (or static hold)
    if (s.active && s.segs.length) {
      s.elapsed += dt;
      while (s.i < s.segs.length && s.elapsed > s.segs[s.i].dur) {
        s.elapsed -= s.segs[s.i].dur;
        s.i++;
        if (s.i >= s.segs.length) {
          if (s.loop) {
            s.i = 0;
            s.start = s.segs[s.segs.length - 1].pose;
            s.startOp = s.segs[s.segs.length - 1].op;
          } else {
            // settle: hold the final segment statically
            const last = s.segs[s.segs.length - 1];
            pose.current = { ...last.pose };
            lp.target = last.op;
            s.active = false;
          }
        }
      }
      if (s.active) {
        const seg = s.segs[s.i];
        const from = s.i === 0 ? s.start : s.segs[s.i - 1].pose;
        const fromOp = s.i === 0 ? s.startOp : s.segs[s.i - 1].op;
        const t = smooth01(seg.dur > 0 ? s.elapsed / seg.dur : 1);
        const p = lerpPose(from, seg.pose, t);
        for (const m in p) eff[m] = p[m];
        lipTarget = lerp(fromOp, seg.op, t);
      } else {
        for (const m in pose.current) eff[m] = pose.current[m];
        lipTarget = lp.target;
      }
    } else {
      for (const m in pose.current) eff[m] = pose.current[m];
      lipTarget = lp.target;
    }
    for (const m in eff) live.current[m] = eff[m]; // snapshot for smooth interrupts

    // 2) lip opacity (smoothed)
    lp.cur += (lipTarget - lp.cur) * Math.min(1, dt * 8);

    // 3) jaw coupling values
    const jawW = eff["jaw_open"] ?? 0;
    // lower-lip drop is now the rigger's `lips_jaw_open` morph (v2.5), coupled to
    // jaw opening. max() so the manual debug slider still works when jaw is shut.
    if (j.on)
      eff["lips_jaw_open"] = Math.max(eff["lips_jaw_open"] ?? 0, jawW * j.lips);
    pivot.set(j.pivotX, j.pivotY, 0);
    const maxRad = THREE.MathUtils.degToRad(j.maxDeg) * jawW;

    for (const b of bases.current) {
      // show/hide the added 3D tongue & lips meshes (head section stays visible)
      if (b.name === "tongue" || b.name === "lips") {
        b.mesh.visible = showArt.current;
      }
      const dict = b.mesh.morphTargetDictionary;
      const inf = b.mesh.morphTargetInfluences;
      if (dict && inf) {
        for (const [name, idx] of Object.entries(dict)) {
          let val = eff[name] ?? 0;
          if (name === "velum_open" && VELUM_INVERTED) val = 1 - val; // ⚠️ inverted key
          inf[idx] = val;
        }
      }

      if (b.name === "tongue" && b.baseVerts) {
        // Rest placement at the VERTEX level (scale about centroid + fwd/up
        // offset), so the resting tongue is tucked behind the teeth. BUT the
        // rigger calibrated the ANTERIOR raising morphs (tip→치조, front→경구개)
        // to reach their landmark from the NATIVE rest, so we fade the tuck back
        // toward native as one of those engages — at full weight the tip lands
        // on the ridge/palate, at rest it stays tucked. `tongue_back_up` (velar,
        // ㄱㄲㅋㅇ) is EXCLUDED: it only lifts the dorsum, and un-tucking for it
        // would push the tongue tip forward past the teeth (which should stay
        // put). Its own delta lifts the back on top of the tucked base.
        const tf = tfit.current;
        // Scale restores from the tuck (0.85) toward native (1.0) as ANY raising
        // gesture engages. It reaches FULL scale well before the morph maxes out
        // (÷0.3) so a GENTLE raise like ㅅ (tip_up 0.31 + lateral_channel 0.26)
        // keeps the tongue full-size — it rises WITHOUT shrinking. Includes
        // tongue_lateral_channel (ㅅ body-up). `tongue_back_up` (velar) stays
        // excluded so the tip stays tucked while the dorsum lifts.
        const rawRaise = Math.max(
          eff["tongue_tip_up"] ?? 0,
          eff["tongue_front_up"] ?? 0,
          eff["tongue_lateral_channel"] ?? 0,
        );
        const raise = Math.min(1, rawRaise / 0.3);
        const s = tf.scale + (1 - tf.scale) * raise;
        const fwd = tf.fwd * (1 - raise);
        const up = tf.up * (1 - raise);
        const C = b.centroid;
        const base = b.baseVerts;
        const posAttr = b.mesh.geometry.attributes.position as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i] = C.x + (base[i] - C.x) * s + fwd;
          arr[i + 1] = C.y + (base[i + 1] - C.y) * s + up;
          arr[i + 2] = C.z + (base[i + 2] - C.z) * s;
        }
        posAttr.needsUpdate = true;
        b.mesh.scale.setScalar(1);
        // jaw-follow: rotate the whole tongue about the hinge (node level)
        if (j.on && j.tongue > 0 && maxRad !== 0) {
          q.setFromAxisAngle(Z, -maxRad * j.tongue);
          v.copy(b.pos).sub(pivot).applyQuaternion(q).add(pivot);
          b.mesh.position.copy(v);
          b.mesh.quaternion.copy(q).multiply(b.quat);
        } else {
          b.mesh.position.copy(b.pos);
          b.mesh.quaternion.copy(b.quat);
        }
      } else if (b.name === "lips") {
        for (const mt of b.lipMats) (mt as THREE.Material).opacity = lp.cur;
        // placement: forward/up offset + scale about the lip centroid
        const C = b.centroid;
        b.mesh.scale.setScalar(f.scale);
        b.mesh.position.set(
          C.x * (1 - f.scale) + f.fwd,
          C.y * (1 - f.scale) + f.up,
          C.z * (1 - f.scale),
        );
        // lower-lip drop on jaw open is now the rigger's `lips_jaw_open` morph
        // (driven above), so the old vertex-deform hack is gone.
      }
    }
  });

  return <primitive object={scene} />;
}

function Slider({
  label,
  min = 0,
  max = 1,
  step = 0.01,
  value,
  warn,
  onChange,
}: {
  label: string;
  min?: number;
  max?: number;
  step?: number;
  value: number;
  warn?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-slate-700">
      <span className={"w-40 truncate font-mono " + (warn ? "text-rose-600" : "")}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1"
      />
      <span className="w-12 text-right tabular-nums">{value.toFixed(3)}</span>
    </label>
  );
}

function Btn({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={
        "rounded-md px-2 py-1.5 text-sm font-medium transition " +
        (active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50")
      }
    >
      {children}
    </button>
  );
}

export default function RiggedViewer() {
  const pose = useRef<Pose>({ ...IDLE_POSE });
  const live = useRef<Pose>({ ...IDLE_POSE });
  const jaw = useRef<Jaw>({
    on: true,
    pivotX: -0.15,
    pivotY: 0.25,
    maxDeg: 18,
    tongue: 1.0,
    lips: 1.0,
  });
  // v2.5: rigger removed the head's original lips, so the temporary forward
  // offset that hid the z-fighting is no longer needed (default 0).
  const fit = useRef<LipFit>({ fwd: 0, up: 0, scale: 1.0 });
  // v17 restored v1's COMPLETE tongue primitive (indices+UV+normals+7 morphs).
  // Native rest pokes the tip past the front teeth, so we shrink slightly about
  // the centroid (scale 0.85, NO fwd offset). Shrinking pulls the tip back behind
  // the teeth while pulling the root FORWARD (away from the pharynx) — a back
  // offset would do the opposite and block the pharynx. Morph deltas are added
  // unscaled, so gestures still reach the ridge/velum.
  const tfit = useRef<TongueFit>({ fwd: 0, up: 0, scale: 0.85 });
  const seq = useRef<Seq>({
    segs: [],
    loop: false,
    start: ZERO,
    startOp: 1,
    i: 0,
    elapsed: 0,
    active: false,
  });
  const lip = useRef({ target: 1, cur: 1 });
  // show/hide the added 3D tongue & lips meshes. Default ON (they are the
  // articulators). Toggle OFF to verify the sagittal head section is clean
  // (the rigger's drawn tongue/lips were removed from the head texture).
  const showArt = useRef(true);

  const [, force] = useState(0);
  const [found, setFound] = useState<Found[] | null>(null);
  const [sel, setSel] = useState<string>("idle");
  const [autoRotate, setAutoRotate] = useState(false);
  const [showJaw, setShowJaw] = useState(false);
  const [showFit, setShowFit] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [loopDiph, setLoopDiph] = useState(false);

  const j = jaw.current;
  const f = fit.current;
  const tf = tfit.current;

  const playSeq = (segs: Seg[], loop: boolean, op0: number) => {
    seq.current = {
      segs,
      loop,
      start: { ...live.current },
      startOp: lip.current.cur,
      i: 0,
      elapsed: 0,
      active: segs.length > 0,
    };
    lip.current.target = op0;
    force((n) => n + 1);
  };

  const idle = () => {
    seq.current.active = false;
    pose.current = { ...IDLE_POSE }; // rest: velum open
    lip.current.target = LIP_OPACITY.idle;
    setSel("idle");
    force((n) => n + 1);
  };

  const playConsonant = (id: string) => {
    const c = CONSONANTS.find((x) => x.id === id)!;
    const g = consonantGesture(c);
    playSeq(g.segs, g.loop, c.opacity);
    setSel(id);
  };

  const playVowel = (id: string) => {
    const vw = VOWELS[id];
    playSeq(
      [
        { pose: fullPose(vw.pose), op: vw.opacity, dur: 0.2 },
        { pose: fullPose(vw.pose), op: vw.opacity, dur: 0.45 },
      ],
      false,
      vw.opacity,
    );
    setSel(id);
  };

  const playDiphthong = (id: string) => {
    const d = DIPHTHONGS.find((x) => x.id === id)!;
    const a = VOWELS[d.from];
    const b = VOWELS[d.to];
    playSeq(
      [
        { pose: fullPose(a.pose), op: a.opacity, dur: 0.14 },
        { pose: fullPose(b.pose), op: b.opacity, dur: 0.5 },
        { pose: fullPose(b.pose), op: b.opacity, dur: 0.2 },
      ],
      loopDiph,
      a.opacity,
    );
    setSel(id);
  };

  const ddkSelected = () => {
    const c = CONSONANTS.find((x) => x.id === sel);
    if (!c) return;
    // tight closure↔gap loop; no return-to-rest so the velum doesn't flicker
    // open between repetitions of an oral stop (퍼터커 stays oral).
    const P = fullPose(c.pose);
    const gap = fullPose({ jaw_open: 0.1 });
    playSeq(
      [
        { pose: P, op: c.opacity, dur: 0.14 },
        { pose: gap, op: c.opacity, dur: 0.16 },
      ],
      true,
      c.opacity,
    );
  };

  const setMorph = (name: string, v: number) => {
    seq.current.active = false;
    pose.current = { ...pose.current, [name]: v };
    setSel("");
    force((n) => n + 1);
  };
  const setJaw = (p: Partial<Jaw>) => {
    Object.assign(jaw.current, p);
    force((n) => n + 1);
  };
  const setFit = (p: Partial<LipFit>) => {
    Object.assign(fit.current, p);
    force((n) => n + 1);
  };
  const setTfit = (p: Partial<TongueFit>) => {
    Object.assign(tfit.current, p);
    force((n) => n + 1);
  };

  const allFoundNames = found?.flatMap((x) => x.targets) ?? [];
  const expectedFlat = Object.values(EXPECTED).flat();
  const missing = expectedFlat.filter((n) => !allFoundNames.includes(n));
  const extra = allFoundNames.filter((n) => !expectedFlat.includes(n));

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
          gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        >
          <ambientLight intensity={0.6} />
          <hemisphereLight args={["#fff1e8", "#2a2030", 0.5]} />
          <directionalLight position={[3, 4, 6]} intensity={1.2} color="#fff2e6" />
          <directionalLight position={[-4, 1.5, 3]} intensity={0.5} color="#cfe0ff" />
          <pointLight position={[2, 0, 4]} intensity={0.5} color="#ffd9c0" />

          <Suspense fallback={null}>
            <Bounds fit clip observe margin={1.15}>
              <RiggedModel
                pose={pose}
                jaw={jaw}
                fit={fit}
                tfit={tfit}
                seq={seq}
                lip={lip}
                live={live}
                showArt={showArt}
                onIntrospect={setFound}
              />
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
            <GizmoViewport
              axisColors={["#ef4444", "#22c55e", "#3b82f6"]}
              labelColor="#0f172a"
            />
          </GizmoHelper>
        </Canvas>

        <div className="pointer-events-none absolute left-4 top-4 rounded-md bg-white/70 px-3 py-2 text-xs text-slate-700 backdrop-blur">
          <div className="font-semibold">조음기관 음소 산출</div>
          <div>· 드래그: 회전 · 휠: 줌 · 우드래그: 이동</div>
        </div>
      </div>

      <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm lg:w-[24rem]">
        <div className="rounded-lg bg-slate-50 p-2 text-xs">
          {found === null ? (
            <span className="text-slate-500">모델 로드 중…</span>
          ) : missing.length === 0 && extra.length === 0 ? (
            <span className="font-semibold text-emerald-600">
              ✓ head-rigged.glb · 13개 타깃 정상
            </span>
          ) : (
            <span className="text-rose-600">
              {missing.length > 0 && `누락: ${missing.join(", ")} `}
              {extra.length > 0 && `예상밖: ${extra.join(", ")}`}
            </span>
          )}
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold text-slate-700">자음 (11그룹)</div>
          <div className="grid grid-cols-4 gap-1.5">
            {CONSONANTS.map((c) => (
              <Btn
                key={c.id}
                active={sel === c.id}
                onClick={() => playConsonant(c.id)}
                title={`${c.manner}${c.note ? " — " + c.note : ""}`}
              >
                {c.label}
              </Btn>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold text-slate-700">단모음 (8)</div>
          <div className="grid grid-cols-8 gap-1.5">
            {Object.values(VOWELS).map((vw) => (
              <Btn
                key={vw.id}
                active={sel === vw.id}
                onClick={() => playVowel(vw.id)}
                title={vw.feature}
              >
                {vw.label}
              </Btn>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>이중모음 (보간)</span>
            <label className="flex items-center gap-1 font-normal text-slate-500">
              <input
                type="checkbox"
                checked={loopDiph}
                onChange={(e) => setLoopDiph(e.target.checked)}
              />
              반복
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DIPHTHONGS.map((d) => (
              <Btn key={d.id} active={sel === d.id} onClick={() => playDiphthong(d.id)}>
                {d.label}
              </Btn>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={idle}
            className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            휴지 (idle)
          </button>
          <button
            onClick={ddkSelected}
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700"
            title="선택한 자음을 반복 조음 (DDK)"
          >
            ▶ DDK 반복
          </button>
        </div>

        <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={showArt.current}
            onChange={(e) => {
              showArt.current = e.target.checked;
              force((n) => n + 1);
            }}
          />
          3D 혀·입술 표시 <span className="text-xs text-slate-400">(끄면 단면만)</span>
        </label>

        {/* lips placement (fix overlap with head's sagittal lips) */}
        <div className="rounded-lg bg-sky-50 p-2">
          <button
            onClick={() => setShowFit((s) => !s)}
            className="flex w-full items-center justify-between text-xs font-semibold text-slate-700"
          >
            <span>입술·혀 맞춤 (겹침 해소)</span>
            <span className="text-slate-400">{showFit ? "▲" : "▼"}</span>
          </button>
          {showFit && (
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="text-[11px] font-semibold text-slate-600">입술</div>
              <Slider label="앞으로(X)" min={-0.05} max={0.15} step={0.002} value={f.fwd} onChange={(v) => setFit({ fwd: v })} />
              <Slider label="상하(Y)" min={-0.08} max={0.08} step={0.002} value={f.up} onChange={(v) => setFit({ up: v })} />
              <Slider label="크기" min={0.7} max={1.4} step={0.01} value={f.scale} onChange={(v) => setFit({ scale: v })} />
              <div className="mt-1 text-[11px] font-semibold text-slate-600">혀 (치아 뒤로)</div>
              <Slider label="앞뒤(X)" min={-0.3} max={0.08} step={0.002} value={tf.fwd} onChange={(v) => setTfit({ fwd: v })} />
              <Slider label="상하(Y)" min={-0.12} max={0.12} step={0.002} value={tf.up} onChange={(v) => setTfit({ up: v })} />
              <Slider label="크기 (모으기)" min={0.55} max={1.3} step={0.01} value={tf.scale} onChange={(v) => setTfit({ scale: v })} />
              <p className="text-[11px] text-slate-500">
                새 입술·혀가 사지철 머리의 그려진 부위/치아와 겹치지 않게 맞춥니다.
                혀가 치아를 뚫으면 앞뒤(X)를 음수로 당겨 구강 안으로 넣으세요.
                완전한 해결은 리거가 머리 원본 입술·혀를 제거하는 것(요청서 v2.5).
              </p>
            </div>
          )}
        </div>

        {/* jaw tuning */}
        <div className="rounded-lg bg-amber-50 p-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input type="checkbox" checked={j.on} onChange={(e) => setJaw({ on: e.target.checked })} />
            턱 추종 (아랫입술·혀)
            <button
              onClick={() => setShowJaw((s) => !s)}
              className="ml-auto rounded bg-white px-1.5 py-0.5 text-[11px] font-normal text-slate-600 ring-1 ring-slate-200"
            >
              {showJaw ? "접기" : "튜닝"}
            </button>
          </label>
          {showJaw && (
            <div className="mt-2 flex flex-col gap-1.5">
              <Slider label="입술 추종 (jaw_open 모프)" value={j.lips} onChange={(v) => setJaw({ lips: v })} />
              <Slider label="혀 추종" value={j.tongue} onChange={(v) => setJaw({ tongue: v })} />
              <Slider label="개구 각도°" min={0} max={35} step={0.5} value={j.maxDeg} onChange={(v) => setJaw({ maxDeg: v })} />
              <Slider label="힌지 X" min={-0.5} max={0.3} step={0.005} value={j.pivotX} onChange={(v) => setJaw({ pivotX: v })} />
              <Slider label="힌지 Y" min={-0.2} max={0.6} step={0.005} value={j.pivotY} onChange={(v) => setJaw({ pivotY: v })} />
            </div>
          )}
        </div>

        {/* manual morph sliders */}
        <div className="rounded-lg bg-slate-50 p-2">
          <button
            onClick={() => setShowManual((s) => !s)}
            className="flex w-full items-center justify-between text-xs font-semibold text-slate-700"
          >
            <span>수동 모프 (디버그)</span>
            <span className="text-slate-400">{showManual ? "▲" : "▼"}</span>
          </button>
          {showManual && found && (
            <div className="mt-2 flex flex-col gap-2">
              {found.map((ff) => (
                <div key={ff.mesh}>
                  <div className="text-[11px] font-medium text-slate-500">{ff.mesh}</div>
                  {ff.targets.map((name) => (
                    <Slider
                      key={name}
                      label={name}
                      warn={!expectedFlat.includes(name)}
                      value={pose.current[name] ?? 0}
                      onChange={(v) => setMorph(name, v)}
                    />
                  ))}
                </div>
              ))}
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
                자동 회전
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
