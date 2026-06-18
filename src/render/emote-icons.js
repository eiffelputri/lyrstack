// emote icons
// drawn around the centre

export function drawEmote(ctx, name, size, color) {
  const r = size / 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.8, size / 14);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (name) {
    case "moon":
      ctx.beginPath();
      ctx.arc(0, 0, r, Math.PI * 0.3, Math.PI * 1.7, false);
      ctx.arc(r * 0.35, 0, r * 0.85, Math.PI * 1.7, Math.PI * 0.3, true);
      ctx.closePath();
      ctx.stroke();
      return;
    case "spark":
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i;
        const r1 = i % 2 === 0 ? r : r * 0.4;
        const x = Math.cos(a) * r1;
        const y = Math.sin(a) * r1;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      return;
    case "star":
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const r1 = i % 2 === 0 ? r : r * 0.45;
        const x = Math.cos(a) * r1;
        const y = Math.sin(a) * r1;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      return;
    case "flame":
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 0.9, -r * 0.2, r * 0.7, r, 0, r);
      ctx.bezierCurveTo(-r * 0.7, r, -r * 0.9, -r * 0.2, 0, -r);
      ctx.closePath();
      ctx.stroke();
      return;
    case "drop":
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 0.8, -r * 0.1, r * 0.7, r, 0, r);
      ctx.bezierCurveTo(-r * 0.7, r, -r * 0.8, -r * 0.1, 0, -r);
      ctx.closePath();
      ctx.stroke();
      return;
    case "swirl":
      ctx.beginPath();
      for (let i = 0; i < 50; i++) {
        const t = i / 49;
        const a = t * Math.PI * 3;
        const rr = r * (1 - t * 0.85);
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    case "heart":
      ctx.beginPath();
      ctx.moveTo(0, r * 0.7);
      ctx.bezierCurveTo(r * 1.2, 0, r * 0.55, -r * 1.15, 0, -r * 0.35);
      ctx.bezierCurveTo(-r * 0.55, -r * 1.15, -r * 1.2, 0, 0, r * 0.7);
      ctx.closePath();
      ctx.stroke();
      return;
    case "bolt":
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, -r);
      ctx.lineTo(r * 0.4, -r * 0.1);
      ctx.lineTo(0, -r * 0.1);
      ctx.lineTo(r * 0.2, r);
      ctx.lineTo(-r * 0.4, r * 0.1);
      ctx.lineTo(0, r * 0.1);
      ctx.closePath();
      ctx.stroke();
      return;
    case "fracture":
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.7);
      ctx.lineTo(-r * 0.1, -r * 0.2);
      ctx.lineTo(-r * 0.45, r * 0.1);
      ctx.lineTo(r * 0.2, r * 0.4);
      ctx.lineTo(-r * 0.05, r);
      ctx.moveTo(-r * 0.1, -r * 0.2);
      ctx.lineTo(r * 0.5, -r * 0.6);
      ctx.lineTo(r, -r * 0.1);
      ctx.moveTo(r * 0.2, r * 0.4);
      ctx.lineTo(r * 0.7, r * 0.3);
      ctx.stroke();
      return;
    case "arrow_fwd":
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r * 0.7, 0);
      ctx.moveTo(r * 0.2, -r * 0.5);
      ctx.lineTo(r * 0.7, 0);
      ctx.lineTo(r * 0.2, r * 0.5);
      ctx.stroke();
      return;
    case "arrow_back":
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(-r * 0.7, 0);
      ctx.moveTo(-r * 0.2, -r * 0.5);
      ctx.lineTo(-r * 0.7, 0);
      ctx.lineTo(-r * 0.2, r * 0.5);
      ctx.stroke();
      return;
    case "cloud":
      ctx.beginPath();
      ctx.arc(-r * 0.4, 0, r * 0.45, 0, Math.PI * 2);
      ctx.arc(0, -r * 0.2, r * 0.55, 0, Math.PI * 2);
      ctx.arc(r * 0.45, 0, r * 0.45, 0, Math.PI * 2);
      ctx.moveTo(-r * 0.85, r * 0.35);
      ctx.lineTo(r * 0.9, r * 0.35);
      ctx.stroke();
      return;
    case "wave":
      ctx.beginPath();
      for (let i = -r; i <= r; i += 2) {
        const y = Math.sin((i / r) * Math.PI * 2) * r * 0.5;
        if (i === -r) ctx.moveTo(i, y);
        else ctx.lineTo(i, y);
      }
      ctx.stroke();
      return;
    case "eye":
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.quadraticCurveTo(0, -r * 0.85, r, 0);
      ctx.quadraticCurveTo(0, r * 0.85, -r, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
      ctx.stroke();
      return;
    case "warning":
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, r * 0.85);
      ctx.lineTo(-r, r * 0.85);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.25);
      ctx.lineTo(0, r * 0.35);
      ctx.stroke();
      return;
    case "triangle":
    default:
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI * 2 / 3) * i - Math.PI / 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      return;
  }
}
