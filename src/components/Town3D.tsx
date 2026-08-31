import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/* ============================================================
   Study# City — a small but "properly designed" city simulation.
   - real clock drives the day/night cycle (sun, sky, lights)
   - a real street grid with sidewalks, crosswalks, lane markings
   - zoning: downtown core / mid-rise / residential / park / industry
   - traffic follows the streets, pedestrians follow the sidewalks
   ============================================================ */

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- city plan ----------
const BLOCK = 9;          // block size
const ROAD = 3.2;         // road width
const CELL = BLOCK + ROAD;

function gridRadius(stage: number) {
  return Math.min(3, 1 + Math.floor(stage / 3)); // blocks from center in each direction
}
function roadLines(stage: number) {
  const r = gridRadius(stage);
  const lines: number[] = [];
  for (let i = -r; i <= r; i++) lines.push(i * CELL + CELL / 2 - CELL / 2);
  return lines.map((_, i) => (i - r) * CELL);
}

// ---------- time of day ----------
type Sky = {
  top: string; bottom: string; fog: string;
  sun: [number, number, number]; sunColor: string; sunIntensity: number;
  ambient: number; night: number; // 0 day .. 1 night
};

function timeOfDay(): number {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

function skyOf(hour: number): Sky {
  // smooth sun angle: 6:00 sunrise, 18:00 sunset
  const t = ((hour - 6) / 12) * Math.PI; // 0..PI during day
  const elev = Math.sin(t);
  const night = Math.max(0, Math.min(1, (0.12 - elev) / 0.35));
  const golden = Math.max(0, 1 - Math.abs(elev - 0.18) / 0.35) * (1 - night);

  const mix = (a: string, b: string, k: number) =>
    "#" + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();

  const dayTop = "#5aa9f0", dayBottom = "#cfe9ff";
  const duskTop = "#2f4a78", duskBottom = "#ffb083";
  const nightTop = "#0a1230", nightBottom = "#1d2a52";

  let top = mix(dayTop, duskTop, golden);
  let bottom = mix(dayBottom, duskBottom, golden);
  top = mix(top, nightTop, night);
  bottom = mix(bottom, nightBottom, night);

  return {
    top, bottom,
    fog: bottom,
    sun: [Math.cos(t) * 26, Math.max(2, elev * 26), 14],
    sunColor: night > 0.6 ? "#9fb4ff" : golden > 0.35 ? "#ffb271" : "#fff3dc",
    sunIntensity: night > 0.8 ? 0.25 : 1.5 - night * 1.1,
    ambient: 0.85 - night * 0.55,
    night,
  };
}

// ---------- facade textures (windows) ----------
function facadeTexture(era: number, seed: number, night: number) {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 128;
  const g = c.getContext("2d")!;
  const rng = mulberry32(seed);
  const base = era >= 5 ? "#c9d9f2" : era >= 4 ? "#b8c2cf" : era >= 3 ? "#d8cdb8" : "#c9a878";
  g.fillStyle = base; g.fillRect(0, 0, 64, 128);
  const cols = era >= 4 ? 5 : 3;
  const rows = era >= 4 ? 12 : 6;
  const pad = 4;
  const w = (64 - pad * (cols + 1)) / cols;
  const h = (128 - pad * (rows + 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = rng() < 0.15 + night * 0.55;
      g.fillStyle = lit
        ? era >= 4 ? "#ffe9a8" : "#ffd58a"
        : era >= 4 ? "#48586b" : "#6b5a45";
      g.fillRect(pad + col * (w + pad), pad + r * (h + pad), w, h);
    }
  }
  // subtle floor bands
  g.fillStyle = "rgba(0,0,0,0.12)";
  for (let r = 0; r < rows; r++) g.fillRect(0, pad + r * (h + pad) + h, 64, 1.2);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- buildings ----------
type Building = {
  x: number; z: number; w: number; d: number; h: number;
  era: number; kind: "tower" | "block" | "house" | "factory";
  color: string; rot: number; roof: number;
};

function generateCity(stage: number): { buildings: Building[]; parks: { x: number; z: number }[] } {
  const rng = mulberry32(stage * 9973 + 17);
  const r = gridRadius(stage);
  const buildings: Building[] = [];
  const parks: { x: number; z: number }[] = [];
  if (stage <= 0) {
    for (let i = 0; i < 6; i++) {
      buildings.push({
        x: (rng() - 0.5) * 16, z: (rng() - 0.5) * 14,
        w: 1.4 + rng(), d: 1.4 + rng(), h: 0.5 + rng() * 0.7,
        era: 0, kind: "house", color: "#8a7460", rot: rng() * Math.PI, roof: 0,
      });
    }
    return { buildings, parks };
  }

  for (let bx = -r; bx <= r; bx++) {
    for (let bz = -r; bz <= r; bz++) {
      const cx = bx * CELL, cz = bz * CELL;
      const dist = Math.hypot(bx, bz);
      // one park block
      if (bx === -1 && bz === 1) { parks.push({ x: cx, z: cz }); continue; }
      // industry on the outer ring at higher stages
      const industry = stage >= 5 && dist >= r - 0.1 && rng() < 0.35;

      const density = Math.max(0, 1 - dist / (r + 1));
      const core = density > 0.66 && stage >= 4;
      const mid = density > 0.33;

      if (industry) {
        buildings.push({
          x: cx, z: cz, w: BLOCK * 0.72, d: BLOCK * 0.55,
          h: 1.6 + rng() * 0.8, era: 3, kind: "factory",
          color: "#9aa0a6", rot: 0, roof: 1,
        });
        continue;
      }

      // subdivide block into lots
      const lots = core ? 1 : mid ? 2 : 3;
      const lotSize = BLOCK / lots;
      for (let lx = 0; lx < lots; lx++) {
        for (let lz = 0; lz < lots; lz++) {
          if (!core && rng() < 0.12) continue; // empty lot / yard
          const px = cx - BLOCK / 2 + lotSize * (lx + 0.5);
          const pz = cz - BLOCK / 2 + lotSize * (lz + 0.5);
          const foot = lotSize * (core ? 0.78 : 0.62);
          const w = foot * (0.8 + rng() * 0.35);
          const d = foot * (0.8 + rng() * 0.35);

          let era: number, kind: Building["kind"], h: number, color: string;
          if (stage <= 1) {
            era = 1; kind = "house"; h = 0.9 + rng() * 0.5;
            color = ["#c9a878", "#b89a6a", "#d2b48c"][Math.floor(rng() * 3)];
          } else if (stage <= 3) {
            era = 2; kind = rng() < 0.7 ? "house" : "block"; h = 1.1 + rng() * 1.0;
            color = ["#e3c89a", "#cdb37c", "#efe0bd"][Math.floor(rng() * 3)];
          } else if (core) {
            era = stage >= 8 ? 5 : 4; kind = "tower";
            h = (3 + rng() * 3) * (1 + (stage - 4) * 0.55) * (0.5 + density);
            color = era >= 5 ? "#dfe8ff" : "#cfd6e0";
          } else if (mid) {
            era = stage >= 8 ? 5 : 4; kind = "block";
            h = (1.8 + rng() * 2) * (1 + (stage - 4) * 0.22);
            color = ["#d9d2c2", "#c3ccd8", "#e6ecf4"][Math.floor(rng() * 3)];
          } else {
            era = 3; kind = "house"; h = 1.0 + rng() * 0.9;
            color = ["#efe6d5", "#e0d3bd", "#f4eee2"][Math.floor(rng() * 3)];
          }
          buildings.push({ x: px, z: pz, w, d, h, era, kind, color, rot: 0, roof: rng() });
        }
      }
    }
  }
  return { buildings, parks };
}

function BuildingMesh({ b, tex }: { b: Building; tex: THREE.Texture | null }) {
  const mat = useMemo(() => {
    if (!tex) return null;
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(1, Math.round(b.w)), Math.max(1, Math.round(b.h * 1.6)));
    return t;
  }, [tex, b.w, b.h]);

  return (
    <group position={[b.x, 0, b.z]} rotation={[0, b.rot, 0]}>
      <mesh position={[0, b.h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[b.w, b.h, b.d]} />
        {mat ? (
          <meshStandardMaterial map={mat} emissiveMap={mat} emissive="#ffdca0" emissiveIntensity={0.25} roughness={0.75} />
        ) : (
          <meshStandardMaterial color={b.color} roughness={0.8} />
        )}
      </mesh>

      {/* ground floor / storefront */}
      {b.kind !== "house" && (
        <mesh position={[0, 0.28, 0]}>
          <boxGeometry args={[b.w * 1.01, 0.55, b.d * 1.01]} />
          <meshStandardMaterial color="#2c3440" emissive="#7fd9ff" emissiveIntensity={0.35} roughness={0.4} />
        </mesh>
      )}

      {/* roofs */}
      {b.kind === "house" && b.era <= 3 ? (
        <mesh position={[0, b.h + 0.22, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[Math.max(b.w, b.d) * 0.76, 0.5, 4]} />
          <meshStandardMaterial color="#7a3a2a" roughness={0.9} />
        </mesh>
      ) : (
        <>
          <mesh position={[0, b.h + 0.05, 0]} castShadow>
            <boxGeometry args={[b.w * 1.04, 0.12, b.d * 1.04]} />
            <meshStandardMaterial color="#31363d" roughness={0.9} />
          </mesh>
          {/* rooftop equipment */}
          <mesh position={[b.w * 0.2, b.h + 0.22, b.d * 0.15]} castShadow>
            <boxGeometry args={[b.w * 0.25, 0.22, b.d * 0.25]} />
            <meshStandardMaterial color="#8d949c" />
          </mesh>
          {b.h > 4 && (
            <>
              <mesh position={[0, b.h + 0.9, 0]}>
                <cylinderGeometry args={[0.03, 0.05, 1.6, 6]} />
                <meshStandardMaterial color="#b9c0c8" />
              </mesh>
              <mesh position={[0, b.h + 1.75, 0]}>
                <sphereGeometry args={[0.09, 8, 8]} />
                <meshStandardMaterial color="#ff3b3b" emissive="#ff2222" emissiveIntensity={2} />
              </mesh>
            </>
          )}
        </>
      )}

      {/* factory chimney */}
      {b.kind === "factory" && (
        <mesh position={[b.w * 0.35, b.h + 0.9, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.24, 1.8, 10]} />
          <meshStandardMaterial color="#c8cdd2" />
        </mesh>
      )}
    </group>
  );
}

// ---------- streets ----------
function Streets({ stage }: { stage: number }) {
  const lines = roadLines(stage);
  if (stage <= 0) return null;
  const span = (gridRadius(stage) * 2 + 1) * CELL;
  return (
    <group>
      {lines.map((p) => (
        <group key={"h" + p}>
          {/* sidewalk */}
          <mesh position={[0, 0.03, p]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[span, ROAD + 1.3]} />
            <meshStandardMaterial color="#b9b7b0" roughness={1} />
          </mesh>
          <mesh position={[0, 0.05, p]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[span, ROAD]} />
            <meshStandardMaterial color="#3c3f45" roughness={0.95} />
          </mesh>
          {Array.from({ length: Math.floor(span / 2) }).map((_, i) => (
            <mesh key={i} position={[-span / 2 + i * 2 + 0.5, 0.07, p]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.9, 0.09]} />
              <meshStandardMaterial color="#e8e2c8" emissive="#e8e2c8" emissiveIntensity={0.15} />
            </mesh>
          ))}
        </group>
      ))}
      {lines.map((p) => (
        <group key={"v" + p}>
          <mesh position={[p, 0.031, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[ROAD + 1.3, span]} />
            <meshStandardMaterial color="#b9b7b0" roughness={1} />
          </mesh>
          <mesh position={[p, 0.051, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[ROAD, span]} />
            <meshStandardMaterial color="#3c3f45" roughness={0.95} />
          </mesh>
          {Array.from({ length: Math.floor(span / 2) }).map((_, i) => (
            <mesh key={i} position={[p, 0.071, -span / 2 + i * 2 + 0.5]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[0.9, 0.09]} />
              <meshStandardMaterial color="#e8e2c8" emissive="#e8e2c8" emissiveIntensity={0.15} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function StreetLamps({ stage, night }: { stage: number; night: number }) {
  const lines = roadLines(stage);
  if (stage < 3) return null;
  const pts: [number, number][] = [];
  lines.forEach((z) => lines.forEach((x) => pts.push([x + ROAD / 2 + 0.5, z + ROAD / 2 + 0.5])));
  return (
    <group>
      {pts.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.75, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 1.5, 6]} />
            <meshStandardMaterial color="#6e747c" />
          </mesh>
          <mesh position={[0, 1.5, 0]}>
            <sphereGeometry args={[0.11, 8, 8]} />
            <meshStandardMaterial
              color="#fff3cf"
              emissive="#ffdf9a"
              emissiveIntensity={0.2 + night * 2.4}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function TrafficLights({ stage }: { stage: number }) {
  const lines = roadLines(stage);
  const ref = useRef<THREE.Group>(null);
  const green = useRef(true);
  useFrame(({ clock }) => {
    green.current = Math.floor(clock.elapsedTime / 6) % 2 === 0;
    if (!ref.current) return;
    ref.current.children.forEach((c, i) => {
      const g = c.getObjectByName("g") as THREE.Mesh | undefined;
      const r = c.getObjectByName("r") as THREE.Mesh | undefined;
      const on = (i % 2 === 0) === green.current;
      if (g) (g.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 2.4 : 0.05;
      if (r) (r.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 0.05 : 2.4;
    });
  });
  if (stage < 5) return null;
  const pts: [number, number][] = [];
  lines.forEach((z) => lines.forEach((x) => pts.push([x - ROAD / 2 - 0.5, z - ROAD / 2 - 0.5])));
  return (
    <group ref={ref}>
      {pts.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[0.04, 0.04, 1.4, 6]} /><meshStandardMaterial color="#3f4650" /></mesh>
          <mesh position={[0, 1.5, 0]}><boxGeometry args={[0.16, 0.42, 0.16]} /><meshStandardMaterial color="#22262c" /></mesh>
          <mesh name="r" position={[0, 1.62, 0.09]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#ff4444" emissive="#ff2222" emissiveIntensity={0.05} /></mesh>
          <mesh name="g" position={[0, 1.4, 0.09]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#48e08a" emissive="#22cc66" emissiveIntensity={0.05} /></mesh>
        </group>
      ))}
    </group>
  );
}

// ---------- traffic ----------
type CarData = { line: number; axis: "x" | "z"; dir: 1 | -1; speed: number; offset: number; color: string; big: boolean };

function Traffic({ stage, night }: { stage: number; night: number }) {
  const lines = roadLines(stage);
  const cars = useMemo<CarData[]>(() => {
    if (stage < 3) return [];
    const rng = mulberry32(stage * 131 + 3);
    const n = Math.min(34, stage * 4);
    const colors = ["#e0e3e8", "#2b2f36", "#c33a3a", "#2f6fd0", "#e0b13a", "#3aa06a", "#8a8f97"];
    return Array.from({ length: n }).map(() => {
      const axis = rng() < 0.5 ? "x" : "z";
      const dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
      return {
        axis, dir,
        line: lines[Math.floor(rng() * lines.length)] + dir * 0.75,
        speed: 3.2 + rng() * 2.4,
        offset: rng() * 60,
        color: colors[Math.floor(rng() * colors.length)],
        big: rng() < 0.18,
      };
    });
  }, [stage, lines.length]);

  const group = useRef<THREE.Group>(null);
  const span = (gridRadius(stage) * 2 + 1) * CELL;
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.children.forEach((c, i) => {
      const d = cars[i];
      if (!d) return;
      let p = ((d.offset + clock.elapsedTime * d.speed) % span) - span / 2;
      if (d.dir < 0) p = -p;
      if (d.axis === "x") c.position.set(p, 0.18, d.line);
      else c.position.set(d.line, 0.18, p);
    });
  });

  if (cars.length === 0) return null;
  return (
    <group ref={group}>
      {cars.map((c, i) => {
        const L = c.big ? 2.1 : 1.25;
        const W = c.big ? 0.72 : 0.58;
        const H = c.big ? 0.6 : 0.32;
        const rot = c.axis === "x" ? 0 : Math.PI / 2;
        return (
          <group key={i} rotation={[0, rot, 0]}>
            <mesh castShadow><boxGeometry args={[L, H, W]} /><meshStandardMaterial color={c.color} metalness={0.35} roughness={0.35} /></mesh>
            {!c.big && (
              <mesh position={[-0.05, H * 0.75, 0]} castShadow>
                <boxGeometry args={[L * 0.55, H * 0.75, W * 0.9]} />
                <meshStandardMaterial color="#26303c" metalness={0.2} roughness={0.2} />
              </mesh>
            )}
            {[-1, 1].map((s) => (
              <mesh key={s} position={[c.dir * L * 0.5, 0.02, s * W * 0.32]}>
                <sphereGeometry args={[0.07, 6, 6]} />
                <meshStandardMaterial color="#fff6d8" emissive="#ffeab0" emissiveIntensity={0.3 + night * 2.2} />
              </mesh>
            ))}
            {[-1, 1].map((s) => (
              <mesh key={"t" + s} position={[-c.dir * L * 0.5, 0.02, s * W * 0.32]}>
                <sphereGeometry args={[0.06, 6, 6]} />
                <meshStandardMaterial color="#ff5a5a" emissive="#ff2a2a" emissiveIntensity={0.3 + night * 1.6} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

// ---------- rail ----------
function RailLine({ stage }: { stage: number }) {
  const ref = useRef<THREE.Group>(null);
  const z = (gridRadius(stage) + 1) * CELL - 1.5;
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.position.x += dt * 9;
    if (ref.current.position.x > 60) ref.current.position.x = -60;
  });
  if (stage < 4) return null;
  const color = stage >= 8 ? "#8fe3ff" : "#e8eef5";
  return (
    <group>
      {/* viaduct */}
      <mesh position={[0, 1.6, z]} receiveShadow castShadow>
        <boxGeometry args={[120, 0.35, 2.4]} />
        <meshStandardMaterial color="#a7aab0" roughness={0.9} />
      </mesh>
      {Array.from({ length: 13 }).map((_, i) => (
        <mesh key={i} position={[-60 + i * 10, 0.8, z]} castShadow>
          <boxGeometry args={[0.9, 1.6, 1.2]} />
          <meshStandardMaterial color="#9c9fa5" roughness={1} />
        </mesh>
      ))}
      <group ref={ref} position={[-60, 2.2, z]}>
        {[0, 2.6, 5.2, 7.8].map((dx, i) => (
          <group key={dx} position={[dx, 0, 0]}>
            <mesh castShadow><boxGeometry args={[2.4, 0.62, 0.85]} /><meshStandardMaterial color={color} metalness={0.4} roughness={0.3} /></mesh>
            <mesh position={[0, 0.05, 0.43]}><boxGeometry args={[2.0, 0.22, 0.02]} /><meshStandardMaterial color="#1d2b3d" emissive="#3aa0ff" emissiveIntensity={0.5} /></mesh>
            {i === 0 && <mesh position={[1.25, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.42, 0.55, 8]} /><meshStandardMaterial color={color} /></mesh>}
          </group>
        ))}
      </group>
    </group>
  );
}

// ---------- park ----------
function Park({ x, z, stage }: { x: number; z: number; stage: number }) {
  const rng = mulberry32(Math.round(x * 31 + z * 7) + stage);
  const trees = Array.from({ length: 14 }).map(() => ({
    x: (rng() - 0.5) * BLOCK * 0.85,
    z: (rng() - 0.5) * BLOCK * 0.85,
    h: 0.8 + rng() * 0.9,
    s: 0.8 + rng() * 0.5,
  }));
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[BLOCK, BLOCK]} />
        <meshStandardMaterial color="#5f9e56" roughness={1} />
      </mesh>
      {/* pond */}
      <mesh position={[BLOCK * 0.22, 0.04, -BLOCK * 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.6, 24]} />
        <meshStandardMaterial color="#3f83b8" metalness={0.6} roughness={0.15} />
      </mesh>
      {/* path */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.4, 2.9, 32]} />
        <meshStandardMaterial color="#cbbfa5" roughness={1} />
      </mesh>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
          <mesh position={[0, t.h / 2, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.1, t.h, 6]} />
            <meshStandardMaterial color="#6a4a2a" roughness={1} />
          </mesh>
          <mesh position={[0, t.h + 0.32, 0]} castShadow>
            <icosahedronGeometry args={[0.5, 0]} />
            <meshStandardMaterial color="#3d8a42" flatShading roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------- pedestrians ----------
function People({ stage }: { stage: number }) {
  const lines = roadLines(stage);
  const group = useRef<THREE.Group>(null);
  const people = useMemo(() => {
    if (stage < 1) return [];
    const rng = mulberry32(stage * 7 + 5);
    const n = Math.min(46, 4 + stage * 5);
    const colors = ["#d64a4a", "#3aa86c", "#3a6cd6", "#d6a73a", "#9a4ad6", "#4ac4d6", "#e8e8ee", "#3b3f46"];
    return Array.from({ length: n }).map(() => {
      const axis = rng() < 0.5 ? "x" : "z";
      return {
        axis,
        line: (lines[Math.floor(rng() * lines.length)] ?? 0) + (rng() < 0.5 ? -1 : 1) * (ROAD / 2 + 0.45),
        dir: rng() < 0.5 ? 1 : -1,
        speed: 0.8 + rng() * 0.6,
        offset: rng() * 60,
        color: colors[Math.floor(rng() * colors.length)],
      };
    });
  }, [stage, lines.length]);

  const span = (gridRadius(stage) * 2 + 1) * CELL;
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.children.forEach((c, i) => {
      const p = people[i];
      if (!p) return;
      let v = ((p.offset + clock.elapsedTime * p.speed) % span) - span / 2;
      if (p.dir < 0) v = -v;
      const bob = Math.abs(Math.sin(clock.elapsedTime * 6 + p.offset)) * 0.05;
      if (p.axis === "x") c.position.set(v, 0.3 + bob, p.line);
      else c.position.set(p.line, 0.3 + bob, v);
    });
  });

  if (people.length === 0) return null;
  return (
    <group ref={group}>
      {people.map((p, i) => (
        <group key={i}>
          <mesh castShadow><capsuleGeometry args={[0.07, 0.22, 4, 8]} /><meshStandardMaterial color={p.color} roughness={0.9} /></mesh>
          <mesh position={[0, 0.24, 0]}><sphereGeometry args={[0.085, 10, 10]} /><meshStandardMaterial color="#f3c7a4" /></mesh>
        </group>
      ))}
    </group>
  );
}

// ---------- environment ----------
function Ground({ stage }: { stage: number }) {
  const color = stage === 0 ? "#8a7a55" : stage <= 2 ? "#7fa163" : "#6f8f5c";
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[300, 300]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  );
}

function Clouds({ night }: { night: number }) {
  const ref = useRef<THREE.Group>(null);
  const items = useMemo(() => {
    const rng = mulberry32(99);
    return Array.from({ length: 9 }).map(() => ({
      x: (rng() - 0.5) * 90, y: 16 + rng() * 8, z: (rng() - 0.5) * 90, s: 2 + rng() * 3,
    }));
  }, []);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.children.forEach((c) => {
      c.position.x += dt * 0.4;
      if (c.position.x > 55) c.position.x = -55;
    });
  });
  return (
    <group ref={ref}>
      {items.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          {[[0, 0, 0], [0.8, -0.15, 0.2], [-0.75, -0.1, -0.15]].map((o, j) => (
            <mesh key={j} position={o as [number, number, number]}>
              <sphereGeometry args={[0.6, 10, 10]} />
              <meshStandardMaterial color={night > 0.5 ? "#3a4260" : "#ffffff"} transparent opacity={0.75} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Stars({ night }: { night: number }) {
  const pts = useMemo(() => {
    const rng = mulberry32(4242);
    const arr = new Float32Array(400 * 3);
    for (let i = 0; i < 400; i++) {
      const th = rng() * Math.PI * 2, ph = rng() * Math.PI * 0.42;
      const r = 110;
      arr[i * 3] = Math.cos(th) * Math.cos(ph) * r;
      arr[i * 3 + 1] = Math.sin(ph) * r + 12;
      arr[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * r;
    }
    return arr;
  }, []);
  if (night < 0.25) return null;
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pts, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.7} color="#ffffff" transparent opacity={night} sizeAttenuation />
    </points>
  );
}

// ---------- user-built structures ----------
function UserBuilding({ b, selected, onClick }: { b: UserBuildingRow; selected: boolean; onClick: () => void }) {
  const [x, z] = cellToWorld(b.gx, b.gz);
  const lv = b.level ?? 1;
  const body = (() => {
    switch (b.kind) {
      case "road":
        return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]} receiveShadow><planeGeometry args={[2.6, 2.6]} /><meshStandardMaterial color="#43474e" roughness={1} /></mesh>;
      case "park":
        return (
          <group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} receiveShadow><planeGeometry args={[2.6, 2.6]} /><meshStandardMaterial color="#5f9e56" roughness={1} /></mesh>
            {[[-0.7, -0.6], [0.6, 0.5], [0.7, -0.7]].map(([px, pz], i) => (
              <group key={i} position={[px, 0, pz]}>
                <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.06, 0.09, 0.6, 6]} /><meshStandardMaterial color="#6a4a2a" /></mesh>
                <mesh position={[0, 0.75, 0]} castShadow><icosahedronGeometry args={[0.42, 0]} /><meshStandardMaterial color="#3d8a42" flatShading /></mesh>
              </group>
            ))}
          </group>
        );
      case "solar":
        return (
          <group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}><planeGeometry args={[2.6, 2.6]} /><meshStandardMaterial color="#7d7f74" /></mesh>
            {[-0.7, 0, 0.7].map((pz) => (
              <mesh key={pz} position={[0, 0.35, pz]} rotation={[-0.5, 0, 0]} castShadow>
                <boxGeometry args={[2.2, 0.06, 0.7]} />
                <meshStandardMaterial color="#1e3a6e" metalness={0.7} roughness={0.2} emissive="#1b4a8a" emissiveIntensity={0.2} />
              </mesh>
            ))}
          </group>
        );
      case "wind":
        return <WindTurbine />;
      case "station":
        return (
          <group>
            <mesh position={[0, 0.6, 0]} castShadow><boxGeometry args={[2.6, 1.2, 1.8]} /><meshStandardMaterial color="#e8e2d4" /></mesh>
            <mesh position={[0, 1.35, 0]} castShadow><boxGeometry args={[3.0, 0.2, 2.2]} /><meshStandardMaterial color="#a8341f" /></mesh>
            <mesh position={[0, 0.75, 0.92]}><planeGeometry args={[1.8, 0.3]} /><meshStandardMaterial color="#ffffff" emissive="#9fe3ff" emissiveIntensity={0.7} /></mesh>
          </group>
        );
      case "factory":
        return (
          <group>
            <mesh position={[0, 0.8, 0]} castShadow><boxGeometry args={[2.5, 1.6, 2.0]} /><meshStandardMaterial color="#9aa0a6" /></mesh>
            <mesh position={[0.9, 2.0, 0]} castShadow><cylinderGeometry args={[0.2, 0.26, 1.6, 10]} /><meshStandardMaterial color="#c8cdd2" /></mesh>
            <Smoke />
          </group>
        );
      case "hospital":
        return (
          <group>
            <mesh position={[0, 1.1, 0]} castShadow><boxGeometry args={[2.2, 2.2, 2.0]} /><meshStandardMaterial color="#f4f7fa" /></mesh>
            <mesh position={[0, 1.6, 1.02]}><boxGeometry args={[0.8, 0.2, 0.05]} /><meshStandardMaterial color="#e23b3b" emissive="#e23b3b" emissiveIntensity={0.5} /></mesh>
            <mesh position={[0, 1.6, 1.02]}><boxGeometry args={[0.2, 0.8, 0.05]} /><meshStandardMaterial color="#e23b3b" emissive="#e23b3b" emissiveIntensity={0.5} /></mesh>
          </group>
        );
      case "school":
        return (
          <group>
            <mesh position={[0, 0.8, 0]} castShadow><boxGeometry args={[2.6, 1.6, 1.6]} /><meshStandardMaterial color="#efe2c8" /></mesh>
            <mesh position={[0, 1.75, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[1.6, 0.6, 4]} /><meshStandardMaterial color="#8c4a34" /></mesh>
            <mesh position={[0, 2.4, 0]}><cylinderGeometry args={[0.03, 0.03, 0.9, 6]} /><meshStandardMaterial color="#9aa0a6" /></mesh>
          </group>
        );
      default: {
        const h = b.kind === "tower" ? 6 + lv : b.kind === "office" ? 3.4 : b.kind === "apartment" ? 3.0 : 1.4;
        const color = b.kind === "tower" ? "#dfe8ff" : b.kind === "office" ? "#cfd6e0" : b.kind === "apartment" ? "#e2dccd" : "#e8d3b0";
        return (
          <group>
            <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[b.kind === "house" ? 1.7 : 2.2, h, b.kind === "house" ? 1.7 : 2.0]} />
              <meshStandardMaterial color={color} roughness={0.7} emissive="#ffd79a" emissiveIntensity={0.06} />
            </mesh>
            {b.kind === "house" ? (
              <mesh position={[0, h + 0.28, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[1.32, 0.6, 4]} /><meshStandardMaterial color="#7a3a2a" /></mesh>
            ) : (
              <mesh position={[0, h + 0.08, 0]} castShadow><boxGeometry args={[2.3, 0.14, 2.1]} /><meshStandardMaterial color="#31363d" /></mesh>
            )}
          </group>
        );
      }
    }
  })();

  return (
    <group
      position={[x, 0, z]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "auto"; }}
    >
      {body}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
          <ringGeometry args={[1.5, 1.75, 32]} />
          <meshBasicMaterial color="#38e08a" transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
}

function WindTurbine() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.z += dt * 2.2; });
  return (
    <group>
      <mesh position={[0, 1.6, 0]} castShadow><cylinderGeometry args={[0.08, 0.14, 3.2, 8]} /><meshStandardMaterial color="#f2f4f7" /></mesh>
      <group ref={ref} position={[0, 3.2, 0.18]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]} position={[0, 0, 0]} castShadow>
            <boxGeometry args={[0.12, 1.5, 0.05]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Smoke() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.children.forEach((c) => {
      c.position.y += dt * 0.5;
      const s = 1 + (c.position.y - 2.8) * 0.4;
      c.scale.setScalar(Math.max(0.2, s));
      if (c.position.y > 5) c.position.y = 2.8;
    });
  });
  return (
    <group ref={ref} position={[0.9, 0, 0]}>
      {[2.9, 3.6, 4.3].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <sphereGeometry args={[0.22, 8, 8]} />
          <meshStandardMaterial color="#d8d8d8" transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function BuildGrid({ stage, occupied, onPick, selected }: {
  stage: number;
  occupied: Set<string>;
  onPick: (gx: number, gz: number) => void;
  selected: [number, number] | null;
}) {
  const r = gridRadius(stage);
  const cells: [number, number][] = [];
  for (let gx = -r * 3 - 1; gx <= r * 3 + 1; gx++) {
    for (let gz = -r * 3 - 1; gz <= r * 3 + 1; gz++) {
      if (Math.abs(gx - Math.round(gx / 3) * 3) > 1) continue;
      if (Math.abs(gz - Math.round(gz / 3) * 3) > 1) continue;
      cells.push([gx, gz]);
    }
  }
  return (
    <group>
      {cells.map(([gx, gz]) => {
        const [x, z] = cellToWorld(gx, gz);
        const used = occupied.has(`${gx},${gz}`);
        const sel = selected && selected[0] === gx && selected[1] === gz;
        return (
          <mesh
            key={`${gx},${gz}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[x, 0.13, z]}
            onClick={(e) => { e.stopPropagation(); onPick(gx, gz); }}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
            onPointerOut={() => { document.body.style.cursor = "auto"; }}
          >
            <planeGeometry args={[2.7, 2.7]} />
            <meshBasicMaterial
              color={sel ? "#38e08a" : used ? "#ff6b6b" : "#7fd4ff"}
              transparent
              opacity={sel ? 0.55 : used ? 0.18 : 0.22}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export type UserBuildingRow = { id: string; kind: string; gx: number; gz: number; level: number };

function SceneInner({
  stage, sky, userBuildings, buildMode, selected, onPick, onSelectBuilding,
}: {
  stage: number; sky: Sky;
  userBuildings: UserBuildingRow[];
  buildMode: boolean;
  selected: [number, number] | null;
  onPick: (gx: number, gz: number) => void;
  onSelectBuilding: (b: UserBuildingRow) => void;
}) {
  const { buildings, parks } = useMemo(() => generateCity(stage), [stage]);
  const texByEra = useMemo(() => {
    if (typeof document === "undefined") return {} as Record<number, THREE.Texture>;
    const map: Record<number, THREE.Texture> = {};
    [1, 2, 3, 4, 5].forEach((e) => { map[e] = facadeTexture(e, e * 77 + stage, sky.night); });
    return map;
  }, [stage, Math.round(sky.night * 4)]);

  const occupied = useMemo(
    () => new Set(userBuildings.map((b) => `${b.gx},${b.gz}`)),
    [userBuildings],
  );
  // ユーザーが建てた区画には自動生成の建物を出さない
  const visible = useMemo(() => {
    const pts = userBuildings.map((b) => cellToWorld(b.gx, b.gz));
    return buildings.filter((b) => !pts.some(([x, z]) => Math.hypot(b.x - x, b.z - z) < 1.7));
  }, [buildings, userBuildings]);

  return (
    <>
      <hemisphereLight args={[sky.top, "#4a4436", 0.45 + (1 - sky.night) * 0.3]} />
      <ambientLight intensity={sky.ambient} />
      <directionalLight
        position={sky.sun}
        color={sky.sunColor}
        intensity={sky.sunIntensity}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-40} shadow-camera-right={40}
        shadow-camera-top={40} shadow-camera-bottom={-40}
        shadow-camera-far={90}
      />
      <Stars night={sky.night} />
      <Clouds night={sky.night} />
      <Ground stage={stage} />
      <Streets stage={stage} />
      <StreetLamps stage={stage} night={sky.night} />
      <TrafficLights stage={stage} />
      <Traffic stage={stage} night={sky.night} />
      <RailLine stage={stage} />
      {parks.map((p, i) => <Park key={i} x={p.x} z={p.z} stage={stage} />)}
      <People stage={stage} />
      {visible.map((b, i) => (
        <BuildingMesh key={i} b={b} tex={texByEra[b.era] ?? null} />
      ))}
      {userBuildings.map((b) => (
        <UserBuilding
          key={b.id}
          b={b}
          selected={!!selected && selected[0] === b.gx && selected[1] === b.gz}
          onClick={() => onSelectBuilding(b)}
        />
      ))}
      {buildMode && <BuildGrid stage={stage} occupied={occupied} onPick={onPick} selected={selected} />}
    </>
  );
}

export default function Town3D({
  stage,
  height = 280,
  userBuildings = [],
  buildMode = false,
  selected = null,
  onPick,
  onSelectBuilding,
  autoRotate = true,
}: {
  stage: number;
  height?: number;
  userBuildings?: UserBuildingRow[];
  buildMode?: boolean;
  selected?: [number, number] | null;
  onPick?: (gx: number, gz: number) => void;
  onSelectBuilding?: (b: UserBuildingRow) => void;
  autoRotate?: boolean;
}) {
  const hour = timeOfDay();
  const sky = useMemo(() => skyOf(hour), [Math.round(hour * 4)]);
  const dist = 18 + gridRadius(stage) * 7;

  return (
    <div
      className="w-full relative"
      style={{ height, background: `linear-gradient(180deg, ${sky.top} 0%, ${sky.bottom} 100%)` }}
    >
      <Canvas
        shadows
        camera={{ position: [dist, dist * 0.72, dist], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[sky.bottom]} />
        <fog attach="fog" args={[sky.fog, 45, 135]} />
        <Suspense fallback={null}>
          <SceneInner
            stage={stage}
            sky={sky}
            userBuildings={userBuildings}
            buildMode={buildMode}
            selected={selected}
            onPick={(gx, gz) => onPick?.(gx, gz)}
            onSelectBuilding={(b) => onSelectBuilding?.(b)}
          />
        </Suspense>
        <OrbitControls
          enablePan={buildMode}
          enableZoom
          minDistance={10}
          maxDistance={90}
          autoRotate={autoRotate && !buildMode}
          autoRotateSpeed={0.35}
          maxPolarAngle={Math.PI / 2.25}
          minPolarAngle={Math.PI / 6}
        />
      </Canvas>
      <div className="absolute left-3 top-3 text-[11px] px-2 py-1 rounded-full bg-background/70 backdrop-blur border border-border/60 tabular-nums pointer-events-none">
        {String(Math.floor(hour)).padStart(2, "0")}:{String(Math.floor((hour % 1) * 60)).padStart(2, "0")} ・ {sky.night > 0.5 ? "夜" : sky.night > 0.15 ? "夕方" : "昼"}
      </div>
    </div>
  );
}

