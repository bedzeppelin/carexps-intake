// Signature pad.
//
// Strokes are kept as normalised (0..1) points rather than raw pixels. That
// buys three things the design prototype did not have: the signature survives
// a device rotation or window resize, it renders crisply on high-DPI tablets,
// and it can be exported at print resolution for the PDF without looking
// like a scaled-up screenshot.

const INK = '#182B5C';
const LINE_RATIO = 0.019; // stroke width as a fraction of pad height

export function createSignaturePad(canvas, { onFirstStroke } = {}) {
  const strokes = [];
  let current = null;
  let notified = false;

  function sizeToDisplay() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    redraw();
  }

  function redraw() {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawInto(ctx, canvas.width, canvas.height, strokes);
  }

  function pointFrom(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    };
  }

  function start(e) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    current = [pointFrom(e)];
    strokes.push(current);
  }

  function move(e) {
    if (!current) return;
    e.preventDefault();
    current.push(pointFrom(e));
    redraw();
    if (!notified) { notified = true; onFirstStroke?.(); }
  }

  function end(e) {
    if (!current) return;
    // A tap with no movement leaves a one-point stroke that draws nothing —
    // drop it so an accidental touch does not count as a signature.
    if (current.length < 2) strokes.pop();
    current = null;
    if (e?.pointerId != null) canvas.releasePointerCapture?.(e.pointerId);
  }

  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', end);
  window.addEventListener('resize', sizeToDisplay);

  sizeToDisplay();

  return {
    isEmpty: () => strokes.length === 0,
    clear() {
      strokes.length = 0;
      current = null;
      notified = false;
      redraw();
    },
    // Render at an arbitrary pixel size — used to hand the PC service a
    // print-resolution signature for the PDF.
    toDataUrl(width = 1360, height = 320) {
      if (!strokes.length) return null;
      const out = document.createElement('canvas');
      out.width = width; out.height = height;
      const ctx = out.getContext('2d');
      drawInto(ctx, width, height, strokes);
      return out.toDataURL('image/png');
    },
    destroy() {
      window.removeEventListener('resize', sizeToDisplay);
    }
  };
}

function drawInto(ctx, w, h, strokes) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.5, h * LINE_RATIO);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const stroke of strokes) {
    if (stroke.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(stroke[0].x * w, stroke[0].y * h);
    for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x * w, stroke[i].y * h);
    ctx.stroke();
  }
}
