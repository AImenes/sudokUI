// A picture of the board as a PNG, made on the device: the SVG
// (src/content/boardImage.ts) goes through a Blob, an <img> and a canvas.
// The SVG fetches nothing and holds no foreign object, so the canvas is
// never tainted and this works offline. Its root is given a pixel size
// before it is drawn: a browser that draws an SVG with no size of its own
// draws nothing (Firefox), and one with a size draws it sharp at that size.
import { svgSize } from '../content/boardImage';

/** the SVG as a PNG, `scale` pixels to its unit (a 570-unit board is 1140 px wide at 2) */
export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const { width, height } = svgSize(svg);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const sized = svg.replace(/^<svg /, `<svg width="${w}" height="${h}" `);
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('the board picture did not load'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d');
    if (!g) throw new Error('no canvas');
    g.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no PNG'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
