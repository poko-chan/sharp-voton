import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// Deterministic PRNG so the town layout is stable per stage
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ====== Sky / atmosphere — always bright & inviting ======
function skyOf(stage: number): string {
  // gentle warm-to-cool gradient driven by stage, but never dark
  const palette = [
    "#f3d8b6", // dawn ruins
    "#c8e4f5",
    "#bfe1f8",
    "#b6dffb",
    "#abdcff",
    "#a5d8ff",
    "#9fd4ff",
    "#a0e0ff",
    "#b8eaff",
    "#c8efff",
  ];
  return palette[Math.min(stage, palette.length - 1)] ?? "#cdebff";
}

function groundOf(stage: number): string {
  if (stage === 0) return "#8a7a55";
  if (stage <= 2) return "#88a96a"; // grassy
  if (stage <= 4) return "#9aa874"; // farmland-ish
  if (stage <= 6) return "#9a9c8e"; // paved
  return "#a8acb4"; // future concrete/asphalt
}

type Building = { x: number; z: number; w: number; d: number; h: number; color: string; era: number };

function generateBuildings(stage: number): Building[] {
  const rng = mulberry32(stage * 9973 + 1);
  if (stage === 0) {
    return Array.from({ length: 5 }).map((_, i) => ({
      x: (i - 2) * 4 + rng() * 2,
      z: (rng() - 0.5) * 8,
      w: 1.2 + rng() * 0.5,
      d: 1.2 + rng() * 0.5,
      h: 0.5 + rng() * 0.8,
      color: "#8a7460",
      era: 0,
    }));
  }
  const count = Math.min(70, 6 + stage * 4);
  const heightCap = 0.8 + stage * 0.9;
  const gridSize = Math.ceil(Math.sqrt(count));
  const spacing = 2.6;
  const arr: Building[] = [];
  for (let i = 0; i < count; i++) {
    const gx = i % gridSize;
    const gz = Math.floor(i / gridSize);
    const dx = (gx - gridSize / 2) * spacing + (rng() - 0.5) * 0.4;
    const dz = (gz - gridSize / 2) * spacing + (rng() - 0.5) * 0.4;
    const distFromCenter = Math.sqrt(dx * dx + dz * dz);
    const centerBoost = Math.max(0.3, 1 - distFromCenter / (gridSize * spacing * 0.5));
    const h = Math.max(0.5, (0.5 + rng() * heightCap) * centerBoost);
    const w = 0.9 + rng() * 0.6;
    const d = 0.9 + rng() * 0.6;
    let palette: string[];
    let era = 0;
    if (stage <= 1) { palette = ["#c9a878", "#b89a6a", "#d2b48c"]; era = 1; } // 木造小屋
    else if (stage <= 3) { palette = ["#e3c89a", "#cdb37c", "#f1d6a0"]; era = 2; } // 漆喰の家
    else if (stage <= 5) { palette = ["#d9d2c2", "#bdb6a4", "#ece5d2"]; era = 3; } // 煉瓦/タウンハウス
    else if (stage <= 7) { palette = ["#cfd6e0", "#9faabb", "#e6ecf4"]; era = 4; } // ビル
    else { palette = ["#dfe8ff", "#a4c4ff", "#ffffff"]; era = 5; } // 未来的高層ビル
    arr.push({ x: dx, z: dz, w, d, h, color: palette[Math.floor(rng() * palette.length)], era });
  }
  return arr;
}

function BuildingMesh({ b, stage }: { b: Building; stage: number }) {
  const winColor = b.era >= 4 ? "#9bd4ff" : b.era >= 3 ? "#ffeaa8" : "#ffd870";
  return (
    <group position={[b.x, b.h / 2, b.z]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color={b.color} />
      </mesh>
      {/* roof — pitched for old eras, flat for modern */}
      {b.era <= 2 ? (
        <mesh position={[0, b.h / 2 + 0.18, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[Math.max(b.w, b.d) * 0.78, 0.45, 4]} />
          <meshStandardMaterial color="#7a3a2a" />
        </mesh>
      ) : (
        <mesh position={[0, b.h / 2 + 0.05, 0]} castShadow>
          <boxGeometry args={[b.w * 1.05, 0.1, b.d * 1.05]} />
          <meshStandardMaterial color="#2a2520" />
        </mesh>
      )}
      {stage > 0 && (
        <mesh position={[0, 0, b.d / 2 + 0.001]}>
          <planeGeometry args={[b.w * 0.85, b.h * 0.7]} />
          <meshStandardMaterial
            color={winColor}
            emissive={winColor}
            emissiveIntensity={b.era >= 4 ? 0.45 : 0.2}
            transparent
            opacity={0.85}
          />
        </mesh>
      )}
    </group>
  );
}

// ===== Vehicles ascending the tech tree =====
function HorseCart({ stage }: { stage: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.position.x += dt * 1.4;
    if (ref.current.position.x > 16) ref.current.position.x = -16;
  });
  if (stage < 1 || stage > 3) return null;
  return (
    <group ref={ref} position={[-16, 0.3, -6]}>
      {/* horse */}
      <mesh position={[0.9, 0.15, 0]} castShadow>
        <boxGeometry args={[0.8, 0.5, 0.3]} />
        <meshStandardMaterial color="#6b4a2a" />
      </mesh>
      <mesh position={[1.4, 0.4, 0]} castShadow>
        <boxGeometry args={[0.3, 0.4, 0.3]} />
        <meshStandardMaterial color="#6b4a2a" />
      </mesh>
      {/* cart */}
      <mesh position={[-0.2, 0.25, 0]} castShadow>
        <boxGeometry args={[0.9, 0.4, 0.6]} />
        <meshStandardMaterial color="#a0784a" />
      </mesh>
      <mesh position={[-0.45, 0, 0.32]}><cylinderGeometry args={[0.15, 0.15, 0.05, 12]} /><meshStandardMaterial color="#2a1a10" /></mesh>
      <mesh position={[-0.45, 0, -0.32]}><cylinderGeometry args={[0.15, 0.15, 0.05, 12]} /><meshStandardMaterial color="#2a1a10" /></mesh>
    </group>
  );
}

function Car({ stage }: { stage: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.position.x -= dt * 3;
    if (ref.current.position.x < -16) ref.current.position.x = 16;
  });
  if (stage < 4) return null;
  const color = stage >= 7 ? "#e8e8f0" : "#cf3a3a";
  return (
    <group ref={ref} position={[10, 0.22, -6]}>
      <mesh castShadow><boxGeometry args={[1.2, 0.35, 0.55]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 0.28, 0]} castShadow><boxGeometry args={[0.7, 0.3, 0.5]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0.4, -0.15, 0.28]}><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#222" /></mesh>
      <mesh position={[-0.4, -0.15, 0.28]}><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#222" /></mesh>
      <mesh position={[0.4, -0.15, -0.28]}><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#222" /></mesh>
      <mesh position={[-0.4, -0.15, -0.28]}><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#222" /></mesh>
    </group>
  );
}

function Train({ stage }: { stage: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.position.x += dt * 4.5;
    if (ref.current.position.x > 20) ref.current.position.x = -20;
  });
  if (stage < 3) return null;
  const color = stage >= 7 ? "#5ab8f0" : stage >= 5 ? "#2d7adf" : "#3a7ac8";
  return (
    <group ref={ref} position={[-20, 0.5, 7]}>
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[1.6, 0.8, 0.65]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.7, 0.15, 0]} castShadow>
        <boxGeometry args={[0.3, 0.5, 0.55]} />
        <meshStandardMaterial color="#1a3550" />
      </mesh>
      {[1.8, 3.4].map((dx) => (
        <mesh key={dx} position={[dx, 0, 0]} castShadow>
          <boxGeometry args={[1.5, 0.75, 0.6]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

function Rails({ stage }: { stage: number }) {
  if (stage < 3) return null;
  return (
    <group>
      <mesh position={[0, 0.02, 7]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[44, 1.4]} />
        <meshStandardMaterial color="#3d2f22" />
      </mesh>
      {[-0.35, 0.35].map((z) => (
        <mesh key={z} position={[0, 0.06, 7 + z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[44, 0.06]} />
          <meshStandardMaterial color="#aab0b8" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function Station({ stage }: { stage: number }) {
  if (stage < 3) return null;
  return (
    <group position={[6, 0, 7]}>
      <mesh position={[0, 0.4, -1.1]} castShadow>
        <boxGeometry args={[3.4, 0.8, 0.3]} />
        <meshStandardMaterial color="#ece3c4" />
      </mesh>
      <mesh position={[0, 1.0, -1.1]} castShadow>
        <boxGeometry args={[3.6, 0.4, 0.45]} />
        <meshStandardMaterial color="#a8341f" />
      </mesh>
      <mesh position={[0, 1.3, -1.1]}>
        <planeGeometry args={[2.4, 0.25]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

// ANA — All Nippon Airways inspired livery (white body + dark navy + red accent)
function Plane({ stage }: { stage: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.position.x += dt * 3.5;
    if (ref.current.position.x > 22) ref.current.position.x = -22;
  });
  if (stage < 6) return null;
  return (
    <group ref={ref} position={[-22, 7, -3]} rotation={[0, 0, 0.02]}>
      {/* fuselage */}
      <mesh castShadow>
        <cylinderGeometry args={[0.28, 0.28, 3.2, 12]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* nose */}
      <mesh position={[1.7, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.28, 0.5, 12]} />
        <meshStandardMaterial color="#0a2a55" />
      </mesh>
      {/* tail fin with red accent */}
      <mesh position={[-1.5, 0.4, 0]}>
        <boxGeometry args={[0.4, 0.7, 0.06]} />
        <meshStandardMaterial color="#0a2a55" />
      </mesh>
      <mesh position={[-1.5, 0.55, 0.04]}>
        <boxGeometry args={[0.3, 0.15, 0.04]} />
        <meshStandardMaterial color="#d62828" />
      </mesh>
      {/* wings */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.7, 2.6, 0.08]} />
        <meshStandardMaterial color="#e8eef5" />
      </mesh>
      {/* engines */}
      <mesh position={[-0.1, -0.18, 0.9]}>
        <cylinderGeometry args={[0.12, 0.12, 0.35, 10]} />
        <meshStandardMaterial color="#0a2a55" />
      </mesh>
      <mesh position={[-0.1, -0.18, -0.9]}>
        <cylinderGeometry args={[0.12, 0.12, 0.35, 10]} />
        <meshStandardMaterial color="#0a2a55" />
      </mesh>
      {/* "ANA" stripe (just a navy band) */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[2.0, 0.08, 0.58]} />
        <meshStandardMaterial color="#0a2a55" />
      </mesh>
    </group>
  );
}

function Person({ x, z, color, t }: { x: number; z: number; color: string; t: number }) {
  // tiny walking person, bobbing
  const bob = Math.sin(t) * 0.05;
  return (
    <group position={[x, 0.35 + bob, z]}>
      <mesh castShadow><cylinderGeometry args={[0.07, 0.09, 0.35, 8]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 0.27, 0]}><sphereGeometry args={[0.09, 8, 8]} /><meshStandardMaterial color="#f3c7a4" /></mesh>
    </group>
  );
}

function People({ stage }: { stage: number }) {
  const ref = useRef<THREE.Group>(null);
  const rng = useMemo(() => mulberry32(stage * 7 + 5), [stage]);
  const people = useMemo(() => {
    const n = Math.min(40, 2 + stage * 4);
    const colors = ["#d64a4a", "#3aa86c", "#3a6cd6", "#d6a73a", "#9a4ad6", "#4ac4d6"];
    return Array.from({ length: n }).map(() => ({
      ox: (rng() - 0.5) * 18,
      oz: (rng() - 0.5) * 14,
      speed: 0.4 + rng() * 0.6,
      r: 1 + rng() * 3,
      phase: rng() * Math.PI * 2,
      color: colors[Math.floor(rng() * colors.length)],
    }));
  }, [stage, rng]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.userData.t = clock.elapsedTime;
  });
  if (stage === 0) return null;
  return (
    <group ref={ref}>
      {people.map((p, i) => {
        const t = (typeof window !== "undefined" ? performance.now() / 1000 : 0) + p.phase;
        const px = p.ox + Math.cos(t * p.speed) * p.r;
        const pz = p.oz + Math.sin(t * p.speed) * p.r;
        return <Person key={i} x={px} z={pz} color={p.color} t={t * 4 + p.phase} />;
      })}
    </group>
  );
}

function Trees({ stage }: { stage: number }) {
  const rng = mulberry32(stage * 31 + 7);
  const n = stage === 0 ? 4 : Math.max(4, 14 - Math.floor(stage / 2));
  const items = Array.from({ length: n }).map((_, i) => {
    const angle = (i / n) * Math.PI * 2;
    const r = 9 + rng() * 4;
    return { x: Math.cos(angle) * r, z: Math.sin(angle) * r, h: 0.6 + rng() * 0.6 };
  });
  const leafColor = stage === 0 ? "#7a6850" : "#3a7a3a";
  return (
    <>
      {items.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          <mesh position={[0, t.h / 2, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.09, t.h, 6]} />
            <meshStandardMaterial color="#6a4a2a" />
          </mesh>
          <mesh position={[0, t.h + 0.25, 0]} castShadow>
            <sphereGeometry args={[0.4, 8, 8]} />
            <meshStandardMaterial color={leafColor} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Ground({ stage }: { stage: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[80, 80]} />
      <meshStandardMaterial color={groundOf(stage)} />
    </mesh>
  );
}

function Roads({ stage }: { stage: number }) {
  if (stage < 4) return null;
  return (
    <>
      <mesh position={[0, 0.015, -2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 2]} />
        <meshStandardMaterial color="#4a4a4f" />
      </mesh>
      {/* yellow center line */}
      {Array.from({ length: 30 }).map((_, i) => (
        <mesh key={i} position={[-30 + i * 2, 0.02, -2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.8, 0.08]} />
          <meshStandardMaterial color="#f1c038" />
        </mesh>
      ))}
    </>
  );
}

function SceneInner({ stage }: { stage: number }) {
  const buildings = useMemo(() => generateBuildings(stage), [stage]);
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[12, 18, 8]} intensity={1.0} castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <Ground stage={stage} />
      <Roads stage={stage} />
      <Rails stage={stage} />
      <Station stage={stage} />
      <Train stage={stage} />
      <Car stage={stage} />
      <HorseCart stage={stage} />
      <Plane stage={stage} />
      <Trees stage={stage} />
      <People stage={stage} />
      {buildings.map((b, i) => <BuildingMesh key={i} b={b} stage={stage} />)}
    </>
  );
}

export default function Town3D({ stage }: { stage: number }) {
  const sky = skyOf(stage);
  return (
    <div className="w-full" style={{ height: 280, background: sky }}>
      <Canvas shadows camera={{ position: [13, 10, 15], fov: 45 }} dpr={[1, 2]}>
        <color attach="background" args={[sky]} />
        <fog attach="fog" args={[sky, 30, 70]} />
        <Suspense fallback={null}>
          <SceneInner stage={stage} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.5}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 4}
        />
      </Canvas>
    </div>
  );
}
