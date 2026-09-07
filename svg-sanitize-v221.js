const UNSAFE = 'script,foreignObject,iframe,object,embed,audio,video';
const MAX_SVG_BYTES = 180 * 1024;

function safeCss(value='') {
  const bad = /@import|expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding/i;
  if (bad.test(value)) return '';
  return value.replace(/url\((['"]?)(?!#|data:image\/(?:png|jpeg|jpg|webp|gif);base64,)[^)]+\1\)/gi, 'none');
}

function safeRef(value='') {
  const v = value.trim();
  return v.startsWith('#') || /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(v) ? v : '';
}

export function sanitizeSvg(raw) {
  if (new Blob([raw]).size > MAX_SVG_BYTES) throw new Error('El SVG supera 180 KB. Simplificá el patrón antes de cargarlo.');
  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('El archivo SVG no es válido.');
  const root = doc.documentElement;
  if (root.localName !== 'svg') throw new Error('El archivo debe contener un elemento SVG.');
  root.querySelectorAll(UNSAFE).forEach(el => el.remove());
  [root, ...root.querySelectorAll('*')].forEach(el => {
    [...el.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      const value = attr.value || '';
      if (name.startsWith('on')) return el.removeAttribute(attr.name);
      if (name === 'href' || name.endsWith(':href')) {
        const clean = safeRef(value);
        if (clean) el.setAttribute(attr.name, clean); else el.removeAttribute(attr.name);
        return;
      }
      if (name === 'style') {
        const clean = safeCss(value);
        if (clean) el.setAttribute(attr.name, clean); else el.removeAttribute(attr.name);
        return;
      }
      if (/javascript:|vbscript:|data:text\/html/i.test(value)) el.removeAttribute(attr.name);
    });
  });
  root.querySelectorAll('style').forEach(style => {
    const clean = safeCss(style.textContent || '');
    if (!clean) style.remove(); else style.textContent = clean;
  });
  root.removeAttribute('id');
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(root);
}

export function svgAspect(svg) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  const vb = (root.getAttribute('viewBox') || '').trim().split(/[ ,]+/).map(Number);
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return Math.max(.2, Math.min(5, vb[2] / vb[3]));
  const num = v => Number.parseFloat(String(v || '').replace(/[^0-9.+-]/g, ''));
  const w = num(root.getAttribute('width')), h = num(root.getAttribute('height'));
  return w > 0 && h > 0 ? Math.max(.2, Math.min(5, w / h)) : 1;
}

export function svgDataUrl(svg, opacity=1) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('opacity', String(Math.max(0, Math.min(1, opacity))));
  [...root.childNodes].filter(n => n.nodeType === 1 && !['defs','style','title','desc','metadata'].includes(n.localName)).forEach(n => g.appendChild(n));
  root.appendChild(g);
  const text = new XMLSerializer().serializeToString(root);
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i=0;i<bytes.length;i+=8192) binary += String.fromCharCode(...bytes.subarray(i,i+8192));
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}
