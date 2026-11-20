import { createMulberry32 } from './prng';

export interface DemoSceneMeta {
  id: 'canopy' | 'street' | 'palace';
  name: string;
  nameZh: string;
}

export const DEMO_SCENES: DemoSceneMeta[] = [
  { id: 'canopy', name: 'Sunlit Canopy', nameZh: '逆光树冠（教程同款题材）' },
  { id: 'street', name: 'Winter Streetlights', nameZh: '冬夜苏联街景' },
  { id: 'palace', name: 'Brutalist Facade', nameZh: '苏维埃文化宫立面' },
];

/**
 * Procedurally paints a rich photographic-like 978x404 demo canvas so users immediately
 * experience every ZATO pipeline stage before even uploading their own photograph.
 */
export function renderDemoSceneCanvas(sceneId: DemoSceneMeta['id']): HTMLCanvasElement {
  const w = 978;
  const h = 404;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  if (sceneId === 'canopy') {
    paintSunlitCanopy(ctx, w, h);
  } else if (sceneId === 'street') {
    paintWinterStreet(ctx, w, h);
  } else {
    paintBrutalistPalace(ctx, w, h);
  }
  return canvas;
}

function paintSunlitCanopy(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const rng = createMulberry32(7331);
  // Warm sky glow with blinding sun core (mirrors Pages 1-8 foliage photo)
  const sunX = w * 0.36;
  const sunY = h * 0.44;
  const skyGrad = ctx.createRadialGradient(sunX, sunY, 12, sunX, sunY, w * 0.72);
  skyGrad.addColorStop(0.0, '#ffffff');
  skyGrad.addColorStop(0.14, '#fff7dc');
  skyGrad.addColorStop(0.35, '#dce8c6');
  skyGrad.addColorStop(0.68, '#95b293');
  skyGrad.addColorStop(1.0, '#3a4f38');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Diagonal branches
  ctx.lineCap = 'round';
  for (let i = 0; i < 28; i++) {
    const startX = rng() * w;
    const startY = rng() > 0.5 ? h + 20 : -20;
    const endX = rng() * w;
    const endY = rng() * h;
    ctx.strokeStyle = `rgba(${28 + rng() * 25}, ${34 + rng() * 20}, ${22 + rng() * 15}, ${0.55 + rng() * 0.4})`;
    ctx.lineWidth = 2 + rng() * 7;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo((startX + endX) / 2 + (rng() - 0.5) * 140, (startY + endY) / 2 + (rng() - 0.5) * 90, endX, endY);
    ctx.stroke();
  }

  // Multi-depth foliage leaf clusters with backlit rim light near the sun
  for (let layer = 0; layer < 3; layer++) {
    const count = layer === 0 ? 520 : layer === 1 ? 680 : 540;
    for (let i = 0; i < count; i++) {
      const lx = rng() * w;
      const ly = rng() * h;
      const distSun = Math.hypot(lx - sunX, ly - sunY);
      // Leave radiant clearing around the sun center
      if (distSun < 56 + rng() * 34 && rng() < 0.85) continue;

      const lightBoost = Math.max(0, 1 - distSun / 360);
      const baseTone = layer === 0 ? 115 : layer === 1 ? 68 : 26;
      const r = Math.min(255, baseTone + lightBoost * 115 + (rng() - 0.5) * 35);
      const g = Math.min(255, baseTone + 22 + lightBoost * 120 + (rng() - 0.5) * 35);
      const b = Math.min(255, baseTone - 12 + lightBoost * 65 + (rng() - 0.5) * 25);
      const alpha = layer === 0 ? 0.55 : layer === 1 ? 0.78 : 0.92;

      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(rng() * Math.PI * 2);
      const rx = (8 + rng() * 18) * (layer === 2 ? 1.15 : 0.85);
      const ry = rx * (0.42 + rng() * 0.35);
      ctx.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Sun flare bloom over nearby edges
  const bloom = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 155);
  bloom.addColorStop(0.0, 'rgba(255, 255, 255, 0.96)');
  bloom.addColorStop(0.26, 'rgba(255, 252, 232, 0.72)');
  bloom.addColorStop(0.6, 'rgba(230, 240, 210, 0.22)');
  bloom.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, w, h);
}

function paintWinterStreet(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const rng = createMulberry32(1986);
  const vpX = w * 0.5;
  const vpY = h * 0.67;

  // Cold twilight sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.72);
  sky.addColorStop(0.0, '#09111e');
  sky.addColorStop(0.42, '#284569');
  sky.addColorStop(0.78, '#7ea0c2');
  sky.addColorStop(1.0, '#eef5fa');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Horizon misty glow
  const hGlow = ctx.createRadialGradient(vpX, vpY, 8, vpX, vpY, 270);
  hGlow.addColorStop(0, 'rgba(255,255,255,0.95)');
  hGlow.addColorStop(0.4, 'rgba(195,220,242,0.5)');
  hGlow.addColorStop(1, 'rgba(40,60,95,0)');
  ctx.fillStyle = hGlow;
  ctx.fillRect(0, 0, w, h);

  // Snow sidewalks & dark asphalt road in 1-point perspective
  ctx.fillStyle = '#dde8f2';
  ctx.fillRect(0, vpY, w, h - vpY);

  ctx.fillStyle = '#18202b';
  ctx.beginPath();
  ctx.moveTo(vpX - 24, vpY);
  ctx.lineTo(vpX + 24, vpY);
  ctx.lineTo(w * 0.72, h);
  ctx.lineTo(w * 0.28, h);
  ctx.closePath();
  ctx.fill();

  // Tire tracks / road sheen
  const sheen = ctx.createLinearGradient(0, vpY, 0, h);
  sheen.addColorStop(0, 'rgba(235,244,255,0.75)');
  sheen.addColorStop(0.45, 'rgba(90,115,145,0.28)');
  sheen.addColorStop(1, 'rgba(12,18,28,0.65)');
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.moveTo(vpX - 16, vpY);
  ctx.lineTo(vpX + 16, vpY);
  ctx.lineTo(w * 0.64, h);
  ctx.lineTo(w * 0.36, h);
  ctx.closePath();
  ctx.fill();

  // Left & Right Khrushchyovka panel buildings
  const drawSideBuildings = (side: -1 | 1) => {
    ctx.fillStyle = '#1b2430';
    ctx.beginPath();
    ctx.moveTo(side === -1 ? 0 : w, 18);
    ctx.lineTo(vpX + side * 66, vpY - 46);
    ctx.lineTo(vpX + side * 66, vpY + 8);
    ctx.lineTo(side === -1 ? 0 : w, h * 0.82);
    ctx.closePath();
    ctx.fill();

    // Panel grid & lit apartment windows
    for (let col = 0; col < 14; col++) {
      const t0 = col / 14;
      const t1 = (col + 0.72) / 14;
      const x0 = side === -1 ? t0 * (vpX - 66) : w - t0 * (w - (vpX + 66));
      const x1 = side === -1 ? t1 * (vpX - 66) : w - t1 * (w - (vpX + 66));
      const top0 = 18 + t0 * (vpY - 46 - 18);
      const bot0 = h * 0.82 + t0 * (vpY + 8 - h * 0.82);
      const top1 = 18 + t1 * (vpY - 46 - 18);
      const bot1 = h * 0.82 + t1 * (vpY + 8 - h * 0.82);

      for (let row = 0; row < 5; row++) {
        const r0 = 0.1 + row * 0.16;
        const r1 = r0 + 0.095;
        const lit = rng();
        if (lit > 0.62) {
          ctx.fillStyle = lit > 0.86 ? '#fff6dd' : '#9bbbd8';
        } else {
          ctx.fillStyle = '#0c121a';
        }
        ctx.beginPath();
        ctx.moveTo(x0, top0 + (bot0 - top0) * r0);
        ctx.lineTo(x1, top1 + (bot1 - top1) * r0);
        ctx.lineTo(x1, top1 + (bot1 - top1) * r1);
        ctx.lineTo(x0, top0 + (bot0 - top0) * r1);
        ctx.closePath();
        ctx.fill();
      }
    }
  };
  drawSideBuildings(-1);
  drawSideBuildings(1);

  // Dark snow-dusted trees lining the sidewalks
  for (let i = 0; i < 420; i++) {
    const side = rng() > 0.5 ? 1 : -1;
    const depth = Math.pow(rng(), 0.7);
    const x = vpX + side * (55 + depth * 390) + (rng() - 0.5) * 45;
    const y = vpY + depth * 92 - rng() * (30 + depth * 75);
    const rad = 3 + depth * 12;
    ctx.fillStyle = rng() > 0.78 ? 'rgba(215,232,248,0.65)' : 'rgba(12,18,28,0.85)';
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Iconic Soviet curved streetlamps with glowing halos
  const lampDepths = [0.16, 0.34, 0.62];
  for (const d of lampDepths) {
    for (const side of [-1, 1] as const) {
      const px = vpX + side * (62 + d * 245);
      const baseY = vpY + d * 105;
      const topY = baseY - (70 + d * 175);
      const armX = px - side * (16 + d * 42);

      ctx.strokeStyle = '#253140';
      ctx.lineWidth = 1.5 + d * 3.5;
      ctx.beginPath();
      ctx.moveTo(px, baseY);
      ctx.lineTo(px, topY);
      ctx.quadraticCurveTo(px, topY - 12 * d, armX, topY - 4 * d);
      ctx.stroke();

      const halo = ctx.createRadialGradient(armX, topY - 2, 1, armX, topY - 2, 18 + d * 55);
      halo.addColorStop(0.0, 'rgba(255,255,255,1)');
      halo.addColorStop(0.24, 'rgba(218,242,255,0.82)');
      halo.addColorStop(0.6, 'rgba(110,165,220,0.28)');
      halo.addColorStop(1.0, 'rgba(40,90,160,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(armX, topY - 2, 18 + d * 55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Subtle snowfall speckles
  ctx.fillStyle = 'rgba(240, 248, 255, 0.75)';
  for (let i = 0; i < 160; i++) {
    ctx.fillRect(rng() * w, rng() * h * 0.75, 1.5, 1.5);
  }
}

function paintBrutalistPalace(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const rng = createMulberry32(1974);
  // Overcast Soviet sky
  const sky = ctx.createLinearGradient(0, 0, w * 0.4, h);
  sky.addColorStop(0, '#f4f2f7');
  sky.addColorStop(0.5, '#d7d2df');
  sky.addColorStop(1, '#a9a2b4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Brutalist concrete facade (angled upward perspective like Page 5 top)
  const facadeGrad = ctx.createLinearGradient(0, 0, w, h);
  facadeGrad.addColorStop(0, '#968f9e');
  facadeGrad.addColorStop(0.5, '#b8b1c0');
  facadeGrad.addColorStop(1, '#756e7e');
  ctx.fillStyle = facadeGrad;
  ctx.beginPath();
  ctx.moveTo(w * 0.14, 18);
  ctx.lineTo(w * 0.92, 6);
  ctx.lineTo(w * 0.96, h);
  ctx.lineTo(w * 0.08, h);
  ctx.closePath();
  ctx.fill();

  // Deep recessed relief shadow bay
  ctx.fillStyle = '#18141d';
  ctx.beginPath();
  ctx.moveTo(w * 0.20, 32);
  ctx.lineTo(w * 0.86, 22);
  ctx.lineTo(w * 0.87, 232);
  ctx.lineTo(w * 0.18, 246);
  ctx.closePath();
  ctx.fill();

  // Sculptural brutalist columns / relief figures in shadow bay
  for (let i = 0; i < 5; i++) {
    const cx = w * (0.25 + i * 0.135);
    const cy = 128 - i * 2;
    // White-lit concrete pedestal
    ctx.fillStyle = '#e5dfe9';
    ctx.fillRect(cx - 38, cy + 72, 76, 24);
    ctx.fillStyle = '#534b5c';
    ctx.fillRect(cx - 38, cy + 96, 76, 12);

    // Heroic abstract relief silhouette with rim highlights
    ctx.fillStyle = '#2d2634';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 38, 16, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy - 16);
    ctx.lineTo(cx + 28, cy - 22);
    ctx.lineTo(cx + 20, cy + 72);
    ctx.lineTo(cx - 22, cy + 72);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#cbc3d3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy - 16);
    ctx.lineTo(cx - 22, cy + 72);
    ctx.stroke();
  }

  // Architectural concrete panel joints
  ctx.strokeStyle = 'rgba(30, 24, 36, 0.35)';
  ctx.lineWidth = 2;
  for (let y = 264; y < h; y += 34) {
    ctx.beginPath();
    ctx.moveTo(w * 0.1, y);
    ctx.lineTo(w * 0.94, y - 10);
    ctx.stroke();
  }
  for (let x = w * 0.16; x < w * 0.92; x += 68) {
    ctx.beginPath();
    ctx.moveTo(x, 250);
    ctx.lineTo(x + 8, h);
    ctx.stroke();
  }

  // Cyrillic "ДВОРЕЦ КУЛЬТУРЫ" plaque lettering
  ctx.save();
  ctx.fillStyle = '#211b27';
  ctx.font = 'bold 21px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Д В О Р Е Ц     К У Л Ь Т У Р Ы', w * 0.52, 310);
  ctx.restore();

  // Lower dark recessed glass entrance windows
  for (let i = 0; i < 6; i++) {
    const wx = w * 0.21 + i * 102;
    ctx.fillStyle = '#1b1620';
    ctx.fillRect(wx, 340, 86, 64);
    ctx.fillStyle = 'rgba(180, 172, 194, 0.22)';
    ctx.fillRect(wx + 6, 346, 34, 52);
  }

  // Concrete surface texture speckles
  for (let i = 0; i < 3500; i++) {
    const px = rng() * w;
    const py = rng() * h;
    const bright = rng() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${bright},${bright},${bright},0.06)`;
    ctx.fillRect(px, py, 2, 2);
  }
}
