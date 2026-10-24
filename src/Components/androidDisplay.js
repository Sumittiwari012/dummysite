// Helper for the Android POS app (WebView with window.CustomerDisplayBridge).
// On desktop browsers the bridge does not exist, so every function here is a no-op
// and your existing Window Management code keeps working unchanged.

export function isAndroidDisplayAvailable() {
  try {
    return !!(window.CustomerDisplayBridge && window.CustomerDisplayBridge.isAvailable());
  } catch {
    return false;
  }
}

// Redraws any QR source onto a canvas with a white margin and returns a PNG data URL.
function toPngDataUrl(source) {
  return new Promise((resolve, reject) => {
    const SIZE = 700;
    const draw = (img, w, h) => {
      const c = document.createElement('canvas');
      c.width = SIZE; c.height = SIZE;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false; // keep QR squares sharp
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, SIZE, SIZE);
      const pad = SIZE * 0.06;
      const scale = Math.min((SIZE - 2 * pad) / w, (SIZE - 2 * pad) / h);
      const dw = w * scale, dh = h * scale;
      ctx.drawImage(img, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh);
      resolve(c.toDataURL('image/png'));
    };

    if (source instanceof HTMLCanvasElement) {
      draw(source, source.width, source.height);
    } else if (source instanceof HTMLImageElement) {
      const go = () => draw(source, source.naturalWidth, source.naturalHeight);
      source.complete && source.naturalWidth ? go() : (source.onload = go, source.onerror = reject);
    } else if (typeof SVGElement !== 'undefined' && source instanceof SVGElement) {
      // Render the SVG at full size so the QR modules stay crisp (no blurry upscaling)
      const clone = source.cloneNode(true);
      clone.setAttribute('width', SIZE);
      clone.setAttribute('height', SIZE);
      if (!clone.getAttribute('viewBox')) {
        const w = source.getAttribute('width') || SIZE;
        const h = source.getAttribute('height') || SIZE;
        clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
      }
      const xml = new XMLSerializer().serializeToString(clone);
      const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
      const img = new Image();
      img.onload = () => { draw(img, img.naturalWidth || SIZE, img.naturalHeight || SIZE); URL.revokeObjectURL(url); };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    } else if (typeof source === 'string') {
      const img = new Image();
      img.onload = () => draw(img, img.naturalWidth, img.naturalHeight);
      img.onerror = reject;
      img.src = source; // data URL
    } else {
      reject(new Error('Unsupported QR source'));
    }
  });
}

// source: <canvas>, <img>, <svg> element, or an image data URL string.
// Resolves true if the QR is now showing on the external screen.
export async function showQrOnAndroid(source) {
  if (!isAndroidDisplayAvailable() || !source) return false;
  try {
    const dataUrl = await toPngDataUrl(source);
    return !!window.CustomerDisplayBridge.showQR(dataUrl);
  } catch {
    return false;
  }
}

export function hideAndroidDisplay() {
  try {
    if (window.CustomerDisplayBridge) window.CustomerDisplayBridge.hide();
  } catch { /* ignore */ }
}
