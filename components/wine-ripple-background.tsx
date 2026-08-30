'use client';

import { useEffect, useRef } from 'react';

const palette = [
  ['236,142,158', '226,116,138'],
  ['244,166,172', '232,132,145'],
  ['246,184,150', '230,150,116'],
  ['246,196,126', '226,162,82'],
  ['248,210,150', '226,178,102'],
  ['246,226,168', '220,190,120'],
  ['250,238,196', '222,204,150'],
  ['252,246,222', '222,210,170'],
];

type Ripple = {
  x: number;
  y: number;
  born: number;
  max: number;
  color: string[];
  fade?: number;
};

export default function WineRippleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let width = 0,
      height = 0,
      frame = 0,
      tapCount = 0;
    let paperCanvas: HTMLCanvasElement | null = null;
    const ripples: Ripple[] = [];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let pointer: {
      id: number;
      x: number;
      y: number;
      time: number;
      moved: boolean;
    } | null = null;
    const clamp = (v: number, min: number, max: number) =>
      Math.max(min, Math.min(max, v));
    const resize = () => {
      width = innerWidth;
      height = innerHeight;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      createPaperTexture();
    };
    const createPaperTexture = () => {
      paperCanvas = document.createElement('canvas');
      paperCanvas.width = Math.max(1, Math.round(width));
      paperCanvas.height = Math.max(1, Math.round(height));
      const paperCtx = paperCanvas.getContext('2d');
      if (!paperCtx) return;
      const bg = paperCtx.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, '#fcfaf5');
      bg.addColorStop(0.45, '#f7f3eb');
      bg.addColorStop(1, '#fffdf8');
      paperCtx.fillStyle = bg;
      paperCtx.fillRect(0, 0, width, height);
      const specks = Math.min(24000, Math.round(width * height * 0.014));
      for (let i = 0; i < specks; i++) {
        paperCtx.fillStyle = `rgba(120,110,95,${Math.random() * 0.018})`;
        paperCtx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
      }
      for (let i = 0; i < 180; i++) {
        const x = Math.random() * width,
          y = Math.random() * height;
        paperCtx.save();
        paperCtx.translate(x, y);
        paperCtx.rotate((Math.random() - 0.5) * 0.8);
        paperCtx.strokeStyle = `rgba(140,128,110,${Math.random() * 0.012})`;
        paperCtx.lineWidth = 0.5;
        paperCtx.beginPath();
        paperCtx.moveTo(0, 0);
        paperCtx.lineTo(8 + Math.random() * 40, (Math.random() - 0.5) * 3);
        paperCtx.stroke();
        paperCtx.restore();
      }
    };
    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      if (paperCanvas) ctx.drawImage(paperCanvas, 0, 0, width, height);
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i],
          age = now - r.born;
        if (age >= 3000 || (r.fade && now - r.fade >= 500)) {
          ripples.splice(i, 1);
          continue;
        }
        const progress = 1 - Math.pow(1 - clamp(age / 2200, 0, 1), 3),
          radius = r.max * progress;
        let opacity = age <= 2200 ? 1 : 1 - (age - 2200) / 800;
        if (r.fade) opacity *= Math.max(0, 1 - (now - r.fade) / 500);
        const gradient = ctx.createRadialGradient(
          r.x,
          r.y,
          0,
          r.x,
          r.y,
          radius,
        );
        gradient.addColorStop(0, `rgba(${r.color[0]},${0.11 * opacity})`);
        gradient.addColorStop(0.35, `rgba(${r.color[0]},${0.18 * opacity})`);
        gradient.addColorStop(0.72, `rgba(${r.color[0]},${0.07 * opacity})`);
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.filter = 'blur(16px)';
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.filter = 'none';
        [0.34, 0.58, 0.84].forEach((scale, index) => {
          ctx.strokeStyle = `rgba(${r.color[1]},${[0.15, 0.105, 0.075][index] * opacity})`;
          ctx.lineWidth = 0.55;
          ctx.beginPath();
          ctx.arc(r.x, r.y, radius * scale, 0, Math.PI * 2);
          ctx.stroke();
        });
      }
      ctx.restore();
      frame = requestAnimationFrame(draw);
    };
    const down = (e: PointerEvent) => {
      pointer = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        time: performance.now(),
        moved: false,
      };
    };
    const move = (e: PointerEvent) => {
      if (
        pointer?.id === e.pointerId &&
        Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) > 10
      )
        pointer.moved = true;
    };
    const up = (e: PointerEvent) => {
      if (
        !reduced &&
        pointer?.id === e.pointerId &&
        !pointer.moved &&
        performance.now() - pointer.time <= 260
      ) {
        const color = palette[tapCount++ % palette.length];
        ripples.push({
          x: e.clientX,
          y: e.clientY,
          born: performance.now(),
          max: Math.min(width, height) * (0.44 + Math.random() * 0.14),
          color,
        });
        const visible = ripples.filter((r) => !r.fade);
        if (visible.length > 4) visible[0].fade = performance.now();
      }
      pointer = null;
    };
    resize();
    if (paperCanvas) ctx.drawImage(paperCanvas, 0, 0, width, height);
    addEventListener('resize', resize);
    addEventListener('pointerdown', down, { passive: true });
    addEventListener('pointermove', move, { passive: true });
    addEventListener('pointerup', up, { passive: true });
    addEventListener('pointercancel', up, { passive: true });
    if (!reduced) frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('resize', resize);
      removeEventListener('pointerdown', down);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
    };
  }, []);
  return (
    <div id="wine-ripple-app" aria-hidden="true">
      <canvas id="wine-ripple-canvas" ref={canvasRef} />
    </div>
  );
}
