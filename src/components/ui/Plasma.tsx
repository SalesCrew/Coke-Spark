"use client";

import React, { useEffect, useRef } from "react";

interface PlasmaProps {
  color?: string;
  speed?: number;
  direction?: "forward" | "reverse" | "pingpong";
  scale?: number;
  opacity?: number;
  mouseInteractive?: boolean;
  tintStrength?: number;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [1, 0.5, 0.2];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ];
};

const vertex = `#version 300 es
precision highp float;
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 uCustomColor;
uniform float uUseCustomColor;
uniform float uSpeed;
uniform float uDirection;
uniform float uScale;
uniform float uOpacity;
uniform vec2 uMouse;
uniform float uMouseInteractive;
out vec4 fragColor;

void mainImage(out vec4 o, vec2 C) {
  vec2 center = iResolution.xy * 0.5;
  C = (C - center) / uScale + center;
  vec2 mouseOffset = (uMouse - center) * 0.0002;
  C += mouseOffset * length(C - center) * step(0.5, uMouseInteractive);
  float i, d, z, T = iTime * uSpeed * uDirection;
  vec3 O, p, S;
  for (vec2 r = iResolution.xy, Q; ++i < 60.; O += o.w/d*o.xyz) {
    p = z*normalize(vec3(C-.5*r,r.y));
    p.z -= 4.;
    S = p;
    d = p.y-T;
    p.x += .4*(1.+p.y)*sin(d + p.x*0.1)*cos(.34*d + p.x*0.05);
    Q = p.xz *= mat2(cos(p.y+vec4(0,11,33,0)-T));
    z+= d = abs(sqrt(length(Q*Q)) - .25*(5.+S.y))/3.+8e-4;
    o = 1.+sin(S.y+p.z*.5+S.z-length(S-p)+vec4(2,1,0,8));
  }
  o.xyz = tanh(O/1e4);
}

bool finite1(float x){ return !(isnan(x) || isinf(x)); }
vec3 sanitize(vec3 c){
  return vec3(
    finite1(c.r) ? c.r : 0.0,
    finite1(c.g) ? c.g : 0.0,
    finite1(c.b) ? c.b : 0.0
  );
}

void main() {
  vec4 o = vec4(0.0);
  mainImage(o, gl_FragCoord.xy);
  vec3 rgb = sanitize(o.rgb);
  float intensity = (rgb.r + rgb.g + rgb.b) / 3.0;
  vec3 darkTint   = uCustomColor * 0.35;
  vec3 midTint    = uCustomColor;
  vec3 brightTint = uCustomColor * 1.15 + vec3(0.08, 0.0, 0.0);
  vec3 tinted = intensity < 0.5
    ? mix(darkTint, midTint, intensity * 2.0)
    : mix(midTint, brightTint, (intensity - 0.5) * 2.0);
  vec3 finalColor = mix(rgb, tinted, uUseCustomColor);
  float alpha = length(rgb) * uOpacity;
  fragColor = vec4(finalColor, alpha);
}`;

export const Plasma: React.FC<PlasmaProps> = ({
  color = "#DC2626",
  speed = 1,
  direction = "forward",
  scale = 1,
  opacity = 1,
  mouseInteractive = true,
  tintStrength = 1.0,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Holds a live ref to the program uniform so we can update it without remounting
  const programRef = useRef<any>(null);
  // Target and current color for smooth lerp
  const targetColorRef = useRef<[number, number, number]>(hexToRgb(color));
  const currentColorRef = useRef<[number, number, number]>([...targetColorRef.current]);

  // ── Update target color whenever the `color` prop changes ────
  useEffect(() => {
    targetColorRef.current = hexToRgb(color);
  }, [color]);

  // ── One-time renderer setup ───────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    let raf = 0;
    let renderer: any;
    let ro: ResizeObserver;

    const init = async () => {
      const { Renderer, Program, Mesh, Triangle } = await import("ogl");
      if (!containerRef.current) return;

      const directionMultiplier = direction === "reverse" ? -1.0 : 1.0;
      const initColor = hexToRgb(color);

      renderer = new Renderer({
        webgl: 2,
        alpha: true,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      });
      const gl = renderer.gl;
      const canvas = gl.canvas as HTMLCanvasElement;
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      containerRef.current.appendChild(canvas);

      const geometry = new Triangle(gl);
      const program = new Program(gl, {
        vertex,
        fragment,
        uniforms: {
          iTime: { value: 0 },
          iResolution: { value: new Float32Array([1, 1]) },
          uCustomColor: { value: new Float32Array(initColor) },
          uUseCustomColor: { value: tintStrength },
          uSpeed: { value: speed * 0.4 },
          uDirection: { value: directionMultiplier },
          uScale: { value: scale },
          uOpacity: { value: opacity },
          uMouse: { value: new Float32Array([0, 0]) },
          uMouseInteractive: { value: mouseInteractive ? 1.0 : 0.0 },
        },
      });

      programRef.current = program;

      const mesh = new Mesh(gl, { geometry, program });

      const handleMouseMove = (e: MouseEvent) => {
        if (!mouseInteractive || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouseUniform = program.uniforms.uMouse.value as Float32Array;
        mouseUniform[0] = e.clientX - rect.left;
        mouseUniform[1] = e.clientY - rect.top;
      };

      if (mouseInteractive && containerRef.current) {
        containerRef.current.addEventListener("mousemove", handleMouseMove);
      }

      const setSize = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        renderer.setSize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
        const res = program.uniforms.iResolution.value as Float32Array;
        res[0] = gl.drawingBufferWidth;
        res[1] = gl.drawingBufferHeight;
      };

      ro = new ResizeObserver(setSize);
      ro.observe(containerRef.current);
      setSize();

      const LERP = 0.04; // smoothing factor per frame (~40 frames to reach target)
      const t0 = performance.now();

      const loop = (t: number) => {
        const timeValue = (t - t0) * 0.001;

        // Smooth color lerp every frame
        const cur = currentColorRef.current;
        const tgt = targetColorRef.current;
        const needsUpdate = Math.abs(cur[0] - tgt[0]) > 0.001 || Math.abs(cur[1] - tgt[1]) > 0.001 || Math.abs(cur[2] - tgt[2]) > 0.001;
        if (needsUpdate) {
          cur[0] += (tgt[0] - cur[0]) * LERP;
          cur[1] += (tgt[1] - cur[1]) * LERP;
          cur[2] += (tgt[2] - cur[2]) * LERP;
          const colorUniform = program.uniforms.uCustomColor.value as Float32Array;
          colorUniform[0] = cur[0];
          colorUniform[1] = cur[1];
          colorUniform[2] = cur[2];
        }

        // Time
        if (direction === "pingpong") {
          const dur = 10;
          const seg = timeValue % dur;
          const isForward = Math.floor(timeValue / dur) % 2 === 0;
          const u = seg / dur;
          const smooth = u * u * (3 - 2 * u);
          const pt = isForward ? smooth * dur : (1 - smooth) * dur;
          (program.uniforms.uDirection as any).value = 1.0;
          (program.uniforms.iTime as any).value = pt;
        } else {
          (program.uniforms.iTime as any).value = timeValue;
        }

        renderer.render({ scene: mesh });
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

      return () => {
        if (mouseInteractive && containerRef.current) {
          containerRef.current.removeEventListener("mousemove", handleMouseMove);
        }
      };
    };

    let cleanup: (() => void) | undefined;
    init().then((fn) => { cleanup = fn; });

    return () => {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      if (cleanup) cleanup();
      programRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← runs only once, color changes are handled via targetColorRef

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}
    />
  );
};

export default Plasma;
