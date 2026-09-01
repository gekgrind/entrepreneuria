"use client";

/**
 * ConstellationScene — the interactive R3F layer of Scene 3.
 *
 * Progressive enhancement ONLY: it renders the exact registry layout
 * (lib/ecosystem/orbits — the same computation as the static SVG) over
 * the static baseline. Scroll progress is the single source of truth for
 * all scene state, so re-entry after suspension is always deterministic.
 *
 * Visual language: a tilted spiral-galaxy disk. Entrepreneuria is the
 * warm core; products sit on their registry-computed orbital rings;
 * hub→product connections are gentle curved energy paths (never rigid
 * spokes); a restrained dust of spiral-arm particles (the SAME arm
 * geometry as ConstellationStatic — lib/ecosystem/spiral) gives the disk
 * depth without reading as noise.
 *
 * Loaded via dynamic import (ssr: false) from ConstellationInteractive —
 * never in first-load JS.
 */
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

import type { Product } from "@/lib/ecosystem/schema";
import { GALAXY_TO_VIEWBOX, SPIRAL_ARM } from "@/lib/ecosystem/spiral";
import { computeOrbits, getMaxOrbitalTierFromProducts, type OrbitNode } from "./layout";

export interface SceneProps {
  products: readonly Product[];
  /** Ignition progress 0..1 (ScrollTrigger of the ecosystem section). */
  progress: { current: number };
  /** Camera dolly progress 0..1 (full passage through the section). */
  dolly: { current: number };
  /** Render loop runs only while true (suspend off-viewport). */
  active: boolean;
  onReady: () => void;
  onActiveProduct: (slug: string) => void;
}

/** World half-extent: the 1000-unit constellation space maps to ±WORLD. */
const WORLD = 3.1;
/** Tilt of the galaxy disk (rad around X) — dimensionality, not flatness. */
const GALAXY_TILT = -0.34;

function toWorld(x: number, y: number): [number, number] {
  return [((x - 500) / 500) * WORLD, ((500 - y) / 500) * WORLD];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Mutable ref holding the currently hovered/clicked product slug. */
type ActiveRef = { current: string | null };

/** Shared radial glow texture (white → transparent; tinted per sprite). */
function useGlowTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(
      size / 2, size / 2, 0, size / 2, size / 2, size / 2,
    );
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.32)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

function circlePoints(radiusViewBox: number, segments = 96): Float32Array {
  const pts = new Float32Array(segments * 3);
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const [x, y] = toWorld(500 + radiusViewBox * Math.cos(a), 500 + radiusViewBox * Math.sin(a));
    pts[i * 3] = x;
    pts[i * 3 + 1] = y;
    pts[i * 3 + 2] = 0;
  }
  return pts;
}

function Rings({ maxTier, progress }: { maxTier: number; progress: SceneProps["progress"] }) {
  const matRefs = useRef<Array<THREE.LineBasicMaterial | null>>([]);
  const tiers = Array.from({ length: maxTier }, (_, i) => i + 1);
  const geoms = useMemo(
    () => tiers.map((t) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(circlePoints(t * 150), 3));
      return g;
    }),
    [tiers],
  );
  useFrame(() => {
    /* a whisper of orbital structure — never a diagram line */
    const o = 0.03 + Math.min(1, progress.current * 2) * 0.06;
    matRefs.current.forEach((m) => m && (m.opacity = o));
  });
  return (
    <>
      {geoms.map((g, i) => (
        <lineLoop key={i} geometry={g}>
          <lineBasicMaterial
            ref={(m) => { matRefs.current[i] = m; }}
            color="#8fd8ff"
            transparent
            opacity={0.03}
          />
        </lineLoop>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* curved hub→product energy paths                                     */
/* ------------------------------------------------------------------ */

function quadBezier(
  p0: [number, number],
  c: [number, number],
  p1: [number, number],
  t: number,
): [number, number] {
  const mt = 1 - t;
  return [
    mt * mt * p0[0] + 2 * mt * t * c[0] + t * t * p1[0],
    mt * mt * p0[1] + 2 * mt * t * c[1] + t * t * p1[1],
  ];
}

/** One gently bowed curve per node — never a straight spoke, never a
 *  node-to-node arc. All curves sweep the same rotational sense so the
 *  system reads as ONE current flowing off the core, like trailing
 *  spiral arms. */
function buildCurvedSpokes(nodes: OrbitNode[]) {
  const SEGMENTS = 16;
  const positions: number[] = [];
  const aIndex: number[] = [];
  const aT: number[] = [];
  nodes.forEach((n, i) => {
    const tip = toWorld(n.x, n.y);
    const dist = Math.max(Math.hypot(tip[0], tip[1]), 0.0001);
    const ux = -tip[1] / dist;
    const uy = tip[0] / dist;
    const bow = dist * 0.24;
    const ctrl: [number, number] = [tip[0] * 0.5 + ux * bow, tip[1] * 0.5 + uy * bow];
    let prev = quadBezier([0, 0], ctrl, tip, 0);
    for (let s = 1; s <= SEGMENTS; s += 1) {
      const t = s / SEGMENTS;
      const next = quadBezier([0, 0], ctrl, tip, t);
      positions.push(prev[0], prev[1], 0, next[0], next[1], 0);
      aIndex.push(i, i);
      aT.push((s - 1) / SEGMENTS, t);
      prev = next;
    }
  });
  return {
    positions: new Float32Array(positions),
    aIndex: new Float32Array(aIndex),
    aT: new Float32Array(aT),
  };
}

const spokeVertex = /* glsl */ `
  attribute float aIndex;
  attribute float aT;
  uniform float uActive;
  uniform float uActiveSet;
  uniform float uTime;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vT;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    float act = 1.0 - abs(aIndex - uActive);
    float actK = smoothstep(0.5, 1.0, act);
    float dim = mix(1.0, 0.4, uActiveSet * (1.0 - actK));
    float flow = 0.10 * (0.5 + 0.5 * sin(aT * 9.0 - uTime * 0.8));
    float pulse = actK * 0.55 * pow(0.5 + 0.5 * sin(aT * 6.0 - uTime * 1.8), 3.0);
    vAlpha = (0.5 + flow + pulse) * dim * uOpacity;
    vT = aT;
  }
`;

const spokeFragment = /* glsl */ `
  varying float vAlpha;
  varying float vT;
  void main() {
    vec3 warm = vec3(0.86, 0.55, 0.27);
    vec3 cool = vec3(0.1, 0.78, 1.0);
    vec3 col = mix(warm, cool, smoothstep(0.0, 0.55, vT));
    gl_FragColor = vec4(col, vAlpha);
  }
`;

function CurvedSpokes({
  nodes,
  progress,
  activeRef,
  indexBySlug,
}: {
  nodes: OrbitNode[];
  progress: SceneProps["progress"];
  activeRef: ActiveRef;
  indexBySlug: Map<string, number>;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const built = useMemo(() => buildCurvedSpokes(nodes), [nodes]);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(built.positions, 3));
    g.setAttribute("aIndex", new THREE.BufferAttribute(built.aIndex, 1));
    g.setAttribute("aT", new THREE.BufferAttribute(built.aT, 1));
    return g;
  }, [built]);

  useFrame((state) => {
    const m = matRef.current;
    if (!m) return;
    const activeIndex = activeRef.current != null ? (indexBySlug.get(activeRef.current) ?? -1) : -1;
    m.uniforms.uActive.value = activeIndex;
    m.uniforms.uActiveSet.value = activeIndex >= 0 ? 1 : 0;
    m.uniforms.uTime.value = state.clock.elapsedTime;
    m.uniforms.uOpacity.value = clamp01((progress.current - 0.05) / 0.25);
  });

  return (
    <lineSegments geometry={geom}>
      <shaderMaterial
        ref={matRef}
        vertexShader={spokeVertex}
        fragmentShader={spokeFragment}
        uniforms={{
          uActive: { value: -1 },
          uActiveSet: { value: 0 },
          uTime: { value: 0 },
          uOpacity: { value: 0 },
        }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

/* ------------------------------------------------------------------ */
/* spiral-arm dust — the SAME arm geometry as ConstellationStatic       */
/* ------------------------------------------------------------------ */

function buildArmDust(count: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const warm = new THREE.Color(0.86, 0.58, 0.32);
  const cool = new THREE.Color(0.14, 0.68, 1.0);
  const gauss = () => Math.random() + Math.random() - 1;
  for (let i = 0; i < count; i += 1) {
    const arm = Math.floor(Math.random() * SPIRAL_ARM.count);
    const rr = SPIRAL_ARM.rMin + Math.pow(Math.random(), 0.62) * (SPIRAL_ARM.rMax - SPIRAL_ARM.rMin);
    const spread = 0.05 + rr * 0.07;
    const a = arm * ((Math.PI * 2) / SPIRAL_ARM.count) - rr * SPIRAL_ARM.swirl + gauss() * (spread / rr) * 1.6;
    const rad = rr + gauss() * spread * 0.4;
    const vx = 500 + rad * GALAXY_TO_VIEWBOX * Math.cos(a);
    const vy = 500 + rad * GALAXY_TO_VIEWBOX * Math.sin(a);
    const [x, y] = toWorld(vx, vy);
    const i3 = i * 3;
    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = gauss() * (0.05 + rr * 0.03);
    const c = warm.clone().lerp(cool, clamp01((rr - SPIRAL_ARM.rMin) / (SPIRAL_ARM.rMax - SPIRAL_ARM.rMin)));
    colors[i3] = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;
  }
  return { positions, colors };
}

function ArmDust({ glowTex, progress }: { glowTex: THREE.Texture; progress: SceneProps["progress"] }) {
  const group = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const built = useMemo(() => buildArmDust(340), []);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(built.positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(built.colors, 3));
    return g;
  }, [built]);

  useFrame((state, delta) => {
    if (group.current) group.current.rotation.z += delta * 0.012;
    if (matRef.current) matRef.current.opacity = 0.5 * clamp01(progress.current * 2);
  });

  return (
    <group ref={group}>
      <points geometry={geom}>
        <pointsMaterial
          ref={matRef}
          map={glowTex}
          vertexColors
          size={0.05}
          sizeAttenuation
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

function buildCoreDust(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const gauss = () => Math.random() + Math.random() - 1;
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    positions[i3] = gauss() * 0.16;
    positions[i3 + 1] = gauss() * 0.16;
    positions[i3 + 2] = gauss() * 0.1;
  }
  return positions;
}

function CoreDust({ glowTex }: { glowTex: THREE.Texture }) {
  const built = useMemo(() => buildCoreDust(60), []);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(built, 3));
    return g;
  }, [built]);
  return (
    <points geometry={geom}>
      <pointsMaterial
        map={glowTex}
        color="#ffb066"
        size={0.05}
        sizeAttenuation
        transparent
        opacity={0.5}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ------------------------------------------------------------------ */

function ProductNode({
  product,
  position,
  dotRadius,
  index,
  total,
  progress,
  glowTex,
  activeRef,
  onActiveProduct,
}: {
  product: Product;
  position: [number, number, number];
  dotRadius: number;
  index: number;
  total: number;
  progress: SceneProps["progress"];
  glowTex: THREE.Texture;
  activeRef: ActiveRef;
  onActiveProduct: (slug: string) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const spriteRef = useRef<THREE.Sprite>(null);
  const sphereR = dotRadius * 0.016;
  const glowScale = dotRadius * 0.14;

  useFrame(() => {
    const p = progress.current;
    const t0 = 0.12 + (index / total) * 0.55;
    const reveal = smooth(clamp01((p - t0) / 0.18));
    const isActive = activeRef.current === product.slug;
    const isDimmed = activeRef.current != null && !isActive;
    const boost = isActive ? 1.35 : isDimmed ? 0.72 : 1;
    const k = reveal * boost;
    meshRef.current?.scale.setScalar((0.55 + 0.45 * reveal) * (isActive ? 1.25 : 1));
    if (matRef.current) {
      matRef.current.emissiveIntensity = (0.15 + k * 1.6) * (isActive ? 1.3 : 1);
      matRef.current.opacity = 0.25 + 0.75 * reveal * (isDimmed ? 0.75 : 1);
    }
    if (spriteRef.current) {
      const m = spriteRef.current.material as THREE.SpriteMaterial;
      m.opacity = (0.06 + 0.55 * k) * (isDimmed ? 0.7 : 1);
      spriteRef.current.scale.setScalar(glowScale * (0.7 + 0.5 * k) * (isActive ? 1.4 : 1));
    }
  });

  const activate = () => {
    activeRef.current = product.slug;
    onActiveProduct(product.slug);
  };

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          activate();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          activate();
        }}
      >
        <sphereGeometry args={[sphereR, 24, 24]} />
        <meshStandardMaterial
          ref={matRef}
          color="#bfefff"
          emissive="#00d4ff"
          emissiveIntensity={0.15}
          transparent
          opacity={0.25}
        />
      </mesh>
      <sprite ref={spriteRef} raycast={() => null} scale={[glowScale, glowScale, 1]}>
        <spriteMaterial
          map={glowTex}
          color="#00d4ff"
          transparent
          opacity={0.06}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  );
}

function FounderCenter({ glowTex }: { glowTex: THREE.Texture }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const s = 1 + Math.sin(clock.elapsedTime * 1.4) * 0.06;
    groupRef.current?.scale.setScalar(s);
  });
  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.13, 24, 24]} />
        <meshStandardMaterial
          color="#ffd9b0"
          emissive="#d27a2c"
          emissiveIntensity={1.6}
        />
      </mesh>
      <sprite raycast={() => null} scale={[1.7, 1.7, 1]}>
        <spriteMaterial
          map={glowTex}
          color="#d27a2c"
          transparent
          opacity={0.65}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <sprite raycast={() => null} scale={[3.2, 3.2, 1]}>
        <spriteMaterial
          map={glowTex}
          color="#7a4420"
          transparent
          opacity={0.22}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  );
}

function SceneContent(props: SceneProps) {
  const { products, progress, dolly, onActiveProduct } = props;
  const glowTex = useGlowTexture();
  const nodes = useMemo(() => computeOrbits(products), [products]);
  const maxTier = useMemo(() => getMaxOrbitalTierFromProducts(products), [products]);
  const bySlug = useMemo(
    () => new Map(products.map((p) => [p.slug, p])),
    [products],
  );
  const indexBySlug = useMemo(
    () => new Map(nodes.map((n, i) => [n.slug, i])),
    [nodes],
  );
  /* mirrors activeSlug React state but reads instantly inside useFrame,
     so hover/click drives shader uniforms with zero lag */
  const activeRef = useRef<string | null>(null);

  /* camera: slow dolly in + gentle pointer parallax */
  useFrame(({ camera, pointer }) => {
    const d = dolly.current;
    camera.position.z = 8.4 - d * 1.7;
    camera.position.y += (d * 0.5 - camera.position.y) * 0.06;
    camera.position.x += (pointer.x * 0.28 - camera.position.x) * 0.05;
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <ambientLight intensity={0.55} />
      <pointLight position={[0, 0, 0.6]} color="#ffb066" intensity={0.9} distance={4.5} decay={2} />
      <Stars radius={30} depth={20} count={130} factor={1.6} saturation={0} fade speed={0.3} />
      {/* the galactic disk, tilted for real dimensional depth rather than
          a flat diagram */}
      <group rotation={[GALAXY_TILT, 0, 0]}>
        <Rings maxTier={maxTier} progress={progress} />
        <ArmDust glowTex={glowTex} progress={progress} />
        <CoreDust glowTex={glowTex} />
        <CurvedSpokes nodes={nodes} progress={progress} activeRef={activeRef} indexBySlug={indexBySlug} />
        <FounderCenter glowTex={glowTex} />
        {nodes.map((n, i) => {
          const product = bySlug.get(n.slug);
          if (!product) return null;
          return (
            <ProductNode
              key={n.slug}
              product={product}
              position={[...toWorld(n.x, n.y), 0]}
              dotRadius={n.dotRadius}
              index={i}
              total={nodes.length}
              progress={progress}
              glowTex={glowTex}
              activeRef={activeRef}
              onActiveProduct={onActiveProduct}
            />
          );
        })}
      </group>
    </>
  );
}

export default function ConstellationScene(props: SceneProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={props.active ? "always" : "never"}
      camera={{ position: [0, 0, 8.4], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={props.onReady}
      aria-hidden="true"
    >
      <SceneContent {...props} />
    </Canvas>
  );
}
