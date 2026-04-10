import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import archiver from "archiver";
import PDFDocument from "pdfkit";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import { findNearestDmc, remapBufferToDmc, type DmcColor } from "./dmc-colors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function sanitizeFilename(name: string) {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function isLightColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r > 240 && g > 240 && b > 240);
}

interface PaletteEntry {
  hex: string;
  name: string;
  dmcNumber: string;
  stitchCount: number;
  percentageOfDesign: number;
}

async function extractPaletteFromIndexedImage(buffer: Buffer) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  const colorCounts = new Map<string, number>();
  const totalPixels = info.width * info.height;
  
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
  }
  
  const fullPalette: PaletteEntry[] = Array.from(colorCounts.entries())
    .map(([hex, count]) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const dmc = findNearestDmc(r, g, b);
      return {
        hex,
        name: dmc.name,
        dmcNumber: dmc.dmc,
        stitchCount: count,
        percentageOfDesign: Number(((count / totalPixels) * 100).toFixed(2))
      };
    })
    .sort((a, b) => b.stitchCount - a.stitchCount);

  let backgroundColor: PaletteEntry | null = null;
  let designPalette: PaletteEntry[] = [...fullPalette];

  if (fullPalette.length > 0) {
    const topColor = fullPalette[0];
    if (isLightColor(topColor.hex) && topColor.percentageOfDesign > 20) {
      backgroundColor = topColor;
      designPalette = fullPalette.slice(1);
    }
  }

  return {
    fullPalette,
    designPalette,
    backgroundColor,
    actualColorCount: fullPalette.length
  };
}

function calculateColorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) {
  return Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2));
}

function analyzeConnectedRegions(data: Buffer, width: number, height: number, channels: number) {
  const visited = new Uint8Array(width * height);
  let tinyRegionCount = 0;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIdx = y * width + x;
      if (visited[pixelIdx]) continue;
      
      let regionSize = 0;
      const queue = [pixelIdx];
      visited[pixelIdx] = 1;
      
      const startDataIdx = pixelIdx * channels;
      const r = data[startDataIdx];
      const g = data[startDataIdx + 1];
      const b = data[startDataIdx + 2];
      
      let head = 0;
      while (head < queue.length) {
        const currentIdx = queue[head++];
        regionSize++;
        
        const cx = currentIdx % width;
        const cy = Math.floor(currentIdx / width);
        
        const neighbors = [
          [cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]
        ];
        
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (!visited[nIdx]) {
              const ndIdx = nIdx * channels;
              if (data[ndIdx] === r && data[ndIdx + 1] === g && data[ndIdx + 2] === b) {
                visited[nIdx] = 1;
                queue.push(nIdx);
              }
            }
          }
        }
      }
      
      if (regionSize > 0 && regionSize <= 4) {
        tinyRegionCount++;
      }
    }
  }
  
  return tinyRegionCount;
}

function runNeedlepointChecks(data: Buffer, width: number, height: number, channels: number, shape: string, requestedMaxColors: number, actualColorCount: number) {
  const warnings: string[] = [];
  
  let isolatedNoiseCount = 0;
  let thinOutlineCount = 0;
  let lowContrastEdgeCount = 0;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      
      let sameNeighbors = 0;
      const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dx, dy] of neighbors) {
        const nIdx = ((y + dy) * width + (x + dx)) * channels;
        const nr = data[nIdx], ng = data[nIdx + 1], nb = data[nIdx + 2];
        
        if (nr === r && ng === g && nb === b) {
          sameNeighbors++;
        } else {
          const dist = calculateColorDistance(r, g, b, nr, ng, nb);
          if (dist < 30) {
            lowContrastEdgeCount++;
          }
        }
      }
      
      if (sameNeighbors === 0) isolatedNoiseCount++;
      if (sameNeighbors === 1 || sameNeighbors === 2) thinOutlineCount++;
    }
  }

  const tinyRegionCount = analyzeConnectedRegions(data, width, height, channels);

  let edgeCrowding = false;
  if (shape === 'Round' || shape === 'round') {
    const radius = Math.min(width, height) / 2;
    const centerX = width / 2;
    const centerY = height / 2;
    const safeRadius = radius * 0.85; 
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > safeRadius && dist <= radius) {
          const idx = (y * width + x) * channels;
          if (data[idx] < 240 || data[idx+1] < 240 || data[idx+2] < 240) {
            edgeCrowding = true;
            break;
          }
        }
      }
      if (edgeCrowding) break;
    }
  }

  const totalPixels = width * height;
  const detailDensityScore = ((isolatedNoiseCount + thinOutlineCount + tinyRegionCount) / totalPixels) * 100;
  const contrastScore = 100 - Math.min(100, (lowContrastEdgeCount / totalPixels) * 100);

  if (isolatedNoiseCount > totalPixels * 0.005) {
    warnings.push("Contains isolated single stitches.");
  }
  if (thinOutlineCount > totalPixels * 0.05) {
    warnings.push("Thin outlines may be lost.");
  }
  if (tinyRegionCount > totalPixels * 0.01) {
    warnings.push("Too many tiny disconnected regions.");
  }
  if (lowContrastEdgeCount > totalPixels * 0.05) {
    warnings.push("Some adjacent colors lack contrast.");
  }
  if (edgeCrowding) {
    warnings.push("Details crowd the canvas edge.");
  }
  if (detailDensityScore > 5) {
    warnings.push("Design is too dense for this mesh.");
  }
  if (actualColorCount > requestedMaxColors + 2) {
    warnings.push("Uses more colors than requested.");
  }

  let productionConfidenceScore = 100;
  
  const noisePenalty = Math.min(20, (isolatedNoiseCount / totalPixels) * 2000);
  const tinyRegionPenalty = Math.min(20, (tinyRegionCount / totalPixels) * 2000);
  const contrastPenalty = Math.min(20, (lowContrastEdgeCount / totalPixels) * 200);
  const edgePenalty = edgeCrowding ? 15 : 0;
  const detailPenalty = Math.min(25, detailDensityScore * 3);
  
  productionConfidenceScore -= (noisePenalty + tinyRegionPenalty + contrastPenalty + edgePenalty + detailPenalty);
  productionConfidenceScore = Math.max(0, Math.min(100, Math.round(productionConfidenceScore)));

  return {
    warnings,
    checks: {
      isolatedNoiseCount,
      thinOutlineCount,
      lowContrastEdgeCount,
      tinyRegionCount,
      edgeCrowding,
      detailDensityScore,
      contrastScore
    },
    productionConfidenceScore
  };
}

/**
 * Remove stray/isolated pixels from the stitch-resolution buffer.
 * Phase A: Mode-filter pass (repeated) — replaces pixels with ≤1 same-color
 *          4-connected neighbors with the most common color in their 3×3 neighborhood.
 * Phase B: BFS flood-fill — merges any connected region smaller than minRegionSize
 *          into its most common bordering color.
 */
function cleanStrayPixels(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  iterations: number = 2,
  minRegionSize: number = 3
): Buffer {
  const buf = Buffer.from(data);

  const idx = (x: number, y: number) => (y * width + x) * channels;
  const colorEq = (i: number, j: number) =>
    buf[i] === buf[j] && buf[i + 1] === buf[j + 1] && buf[i + 2] === buf[j + 2];

  // Phase A: Isolated-pixel mode filter
  const dir4 = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  for (let iter = 0; iter < iterations; iter++) {
    const snapshot = Buffer.from(buf); // read from snapshot, write to buf

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ci = idx(x, y);

        // Count 4-connected same-color neighbors
        let sameCount = 0;
        for (const [dx, dy] of dir4) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (colorEq(ci, idx(nx, ny))) sameCount++;
          }
        }

        if (sameCount > 1) continue; // not isolated

        // Collect colors from 3×3 neighborhood (excluding self)
        const counts = new Map<string, { count: number; r: number; g: number; b: number }>();
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const ni = (ny * width + nx) * channels;
            const key = `${snapshot[ni]},${snapshot[ni + 1]},${snapshot[ni + 2]}`;
            const entry = counts.get(key);
            if (entry) {
              entry.count++;
            } else {
              counts.set(key, { count: 1, r: snapshot[ni], g: snapshot[ni + 1], b: snapshot[ni + 2] });
            }
          }
        }

        // Replace with most common neighbor color
        let best = { count: 0, r: 0, g: 0, b: 0 };
        for (const v of counts.values()) {
          if (v.count > best.count) best = v;
        }
        if (best.count > 0) {
          buf[ci] = best.r;
          buf[ci + 1] = best.g;
          buf[ci + 2] = best.b;
        }
      }
    }
  }

  // Phase B: BFS flood-fill to merge tiny regions
  const visited = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pi = y * width + x;
      if (visited[pi]) continue;

      // BFS to find connected region (4-connected)
      const region: number[] = [];
      const queue: number[] = [pi];
      visited[pi] = 1;
      const ci = idx(x, y);
      const cr = buf[ci], cg = buf[ci + 1], cb = buf[ci + 2];

      while (queue.length > 0) {
        const cur = queue.pop()!;
        region.push(cur);
        const cx = cur % width, cy = (cur - cx) / width;

        for (const [dx, dy] of dir4) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const ni = ny * width + nx;
          if (visited[ni]) continue;
          const nci = ni * channels;
          if (buf[nci] === cr && buf[nci + 1] === cg && buf[nci + 2] === cb) {
            visited[ni] = 1;
            queue.push(ni);
          }
        }
      }

      if (region.length >= minRegionSize) continue;

      // Find the most common bordering color
      const borderCounts = new Map<string, { count: number; r: number; g: number; b: number }>();
      for (const pi of region) {
        const cx = pi % width, cy = (pi - cx) / width;
        for (const [dx, dy] of dir4) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nci = (ny * width + nx) * channels;
          if (buf[nci] === cr && buf[nci + 1] === cg && buf[nci + 2] === cb) continue;
          const key = `${buf[nci]},${buf[nci + 1]},${buf[nci + 2]}`;
          const entry = borderCounts.get(key);
          if (entry) {
            entry.count++;
          } else {
            borderCounts.set(key, { count: 1, r: buf[nci], g: buf[nci + 1], b: buf[nci + 2] });
          }
        }
      }

      let best = { count: 0, r: cr, g: cg, b: cb };
      for (const v of borderCounts.values()) {
        if (v.count > best.count) best = v;
      }

      // Replace all pixels in this tiny region
      for (const pi of region) {
        const pci = pi * channels;
        buf[pci] = best.r;
        buf[pci + 1] = best.g;
        buf[pci + 2] = best.b;
      }
    }
  }

  return buf;
}

async function simplifyBeforeStitchConversion(buffer: Buffer, targetWidth: number, targetHeight: number) {
  const metadata = await sharp(buffer).metadata();
  const origWidth = metadata.width || 1024;
  
  const scale = origWidth / targetWidth;
  
  let medianSize = Math.floor(scale / 2);
  if (medianSize % 2 === 0) medianSize -= 1;
  if (medianSize < 3) medianSize = 0;
  if (medianSize > 5) medianSize = 5; // cap at 5 to preserve text/fine details

  let pipeline = sharp(buffer);
  if (medianSize >= 3) {
    pipeline = pipeline.median(medianSize);
  }
  
  return await pipeline.toBuffer();
}

async function posterizeImage(buffer: Buffer, levels: number): Promise<Buffer> {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  const step = 255 / (levels - 1);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.round(Math.round(data[i] / step) * step);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png().toBuffer();
}

function analyzeDetailCollapse(checks: any, totalPixels: number, currentMesh: number, currentWidth: number, currentHeight: number) {
  const collapseWarnings: string[] = [];
  let detailPreservationScore = 100;
  
  const noiseRatio = checks.isolatedNoiseCount / totalPixels;
  const tinyRegionRatio = checks.tinyRegionCount / totalPixels;
  const thinOutlineRatio = checks.thinOutlineCount / totalPixels;

  if (tinyRegionRatio > 0.015) {
    collapseWarnings.push("Small floral or interior details are partially collapsing at this mesh.");
    detailPreservationScore -= 20;
  }
  if (thinOutlineRatio > 0.06) {
    collapseWarnings.push("Interior linework is too fine for this size.");
    detailPreservationScore -= 15;
  }
  if (noiseRatio > 0.008) {
    collapseWarnings.push("Small text or signage may not remain readable.");
    detailPreservationScore -= 15;
  }

  let recommendedMinimumMesh = currentMesh;
  let recommendedMinimumSizeInches = Math.max(currentWidth, currentHeight);

  if (detailPreservationScore < 70) {
    collapseWarnings.push("This design would benefit from a larger size or finer mesh.");
    if (currentMesh < 18) recommendedMinimumMesh = 18;
    recommendedMinimumSizeInches = Math.ceil(recommendedMinimumSizeInches * 1.5);
  }

  return {
    collapseWarnings,
    detailPreservationScore: Math.max(0, detailPreservationScore),
    recommendedMinimumMesh,
    recommendedMinimumSizeInches
  };
}

async function renderPaintedCanvasPreview(rawStitchBuffer: Buffer, width: number, height: number, shape: string) {
  const previewScale = 12; // 12px per stitch
  const gap = 1; // 1px gap between stitches (mesh holes)
  const stitchSize = previewScale - gap;
  const scaledWidth = width * previewScale;
  const scaledHeight = height * previewScale;

  // Read raw pixel data from the stitch buffer
  const { data, info } = await sharp(rawStitchBuffer).raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;

  // Mesh color for blending
  const meshR = 220, meshG = 215, meshB = 205;
  const meshBlend = 0.35; // how much mesh color shows through in gap pixels

  // Build the preview by direct pixel manipulation
  const outputChannels = 4; // RGBA
  const output = Buffer.alloc(scaledWidth * scaledHeight * outputChannels, 0);

  // Fill background with canvas mesh color
  for (let i = 0; i < output.length; i += outputChannels) {
    output[i] = meshR;
    output[i + 1] = meshG;
    output[i + 2] = meshB;
    output[i + 3] = 255;
  }

  // Helper: get stitch color at grid position (clamped)
  const getStitch = (sx: number, sy: number) => {
    sx = Math.max(0, Math.min(width - 1, sx));
    sy = Math.max(0, Math.min(height - 1, sy));
    const i = (sy * width + sx) * channels;
    return [data[i], data[i + 1], data[i + 2]];
  };

  // Draw each stitch as a filled square, with gap pixels blended
  for (let sy = 0; sy < height; sy++) {
    for (let sx = 0; sx < width; sx++) {
      const [r, g, b] = getStitch(sx, sy);

      for (let py = 0; py < previewScale; py++) {
        for (let px = 0; px < previewScale; px++) {
          const outX = sx * previewScale + px;
          const outY = sy * previewScale + py;
          if (outX >= scaledWidth || outY >= scaledHeight) continue;
          const outIdx = (outY * scaledWidth + outX) * outputChannels;

          const isGapX = px === stitchSize; // right edge gap
          const isGapY = py === stitchSize; // bottom edge gap

          if (!isGapX && !isGapY) {
            // Interior stitch pixel — solid color
            output[outIdx] = r;
            output[outIdx + 1] = g;
            output[outIdx + 2] = b;
          } else {
            // Gap pixel — blend stitch color with mesh color for subtle mesh look
            output[outIdx] = Math.round(r * (1 - meshBlend) + meshR * meshBlend);
            output[outIdx + 1] = Math.round(g * (1 - meshBlend) + meshG * meshBlend);
            output[outIdx + 2] = Math.round(b * (1 - meshBlend) + meshB * meshBlend);
          }
          output[outIdx + 3] = 255;
        }
      }
    }
  }

  // Draw subtle dots at mesh intersections (where 4 stitches meet)
  for (let sy = 1; sy < height; sy++) {
    for (let sx = 1; sx < width; sx++) {
      const px = sx * previewScale - 1;
      const py = sy * previewScale - 1;
      if (px >= 0 && px < scaledWidth && py >= 0 && py < scaledHeight) {
        const idx = (py * scaledWidth + px) * outputChannels;
        // Darken slightly for mesh hole effect
        output[idx] = Math.round(output[idx] * 0.7);
        output[idx + 1] = Math.round(output[idx + 1] * 0.7);
        output[idx + 2] = Math.round(output[idx + 2] * 0.7);
      }
    }
  }

  // Subtle guide lines every 10 stitches (for counting)
  for (let s = 10; s < width; s += 10) {
    const x = s * previewScale;
    if (x >= scaledWidth) continue;
    for (let y = 0; y < scaledHeight; y++) {
      const idx = (y * scaledWidth + x) * outputChannels;
      output[idx] = Math.round(output[idx] * 0.75);
      output[idx + 1] = Math.round(output[idx + 1] * 0.75);
      output[idx + 2] = Math.round(output[idx + 2] * 0.75);
    }
  }
  for (let s = 10; s < height; s += 10) {
    const y = s * previewScale;
    if (y >= scaledHeight) continue;
    for (let x = 0; x < scaledWidth; x++) {
      const idx = (y * scaledWidth + x) * outputChannels;
      output[idx] = Math.round(output[idx] * 0.75);
      output[idx + 1] = Math.round(output[idx + 1] * 0.75);
      output[idx + 2] = Math.round(output[idx + 2] * 0.75);
    }
  }

  let result = await sharp(output, {
    raw: { width: scaledWidth, height: scaledHeight, channels: outputChannels }
  }).png().toBuffer();

  // For round shapes, mask outside the circle
  if (shape === 'Round' || shape === 'round') {
    const cx = scaledWidth / 2;
    const cy = scaledHeight / 2;
    const r = Math.min(cx, cy);
    const maskSvg = `<svg width="${scaledWidth}" height="${scaledHeight}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="white"/>
    </svg>`;
    const circleMask = await sharp(Buffer.from(maskSvg)).png().toBuffer();

    // Apply circular outline
    const outlineSvg = `<svg width="${scaledWidth}" height="${scaledHeight}" xmlns="http://www.w3.org/2000/svg">
      <path d="M 0 0 L ${scaledWidth} 0 L ${scaledWidth} ${scaledHeight} L 0 ${scaledHeight} Z M ${cx} ${cy - r} A ${r} ${r} 0 1 0 ${cx} ${cy + r} A ${r} ${r} 0 1 0 ${cx} ${cy - r} Z" fill="rgba(255,255,255,0.9)" />
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(0,0,0,0.5)" stroke-width="2" stroke-dasharray="6,4"/>
    </svg>`;
    result = await sharp(result)
      .composite([{ input: Buffer.from(outlineSvg), blend: 'over' }])
      .png().toBuffer();
  }

  return result;
}

function computePrintGeometry(meshCount: number, designStitchesWide: number, designStitchesHigh: number, borderInchesEachSide: number) {
  // DPI must be an exact multiple of meshCount so every stitch boundary
  // lands on an exact pixel — zero cumulative drift when printing on canvas.
  const pixelsPerStitch = Math.ceil(300 / meshCount); // ≥300 DPI equivalent
  const effectiveDpi = meshCount * pixelsPerStitch;
  // 13 mesh → 24 pps → 312 DPI. 18 mesh → 17 pps → 306 DPI.

  const designWidthPx = designStitchesWide * pixelsPerStitch;
  const designHeightPx = designStitchesHigh * pixelsPerStitch;
  const borderPx = Math.round(borderInchesEachSide * effectiveDpi);

  const totalWidthPx = designWidthPx + (borderPx * 2);
  const totalHeightPx = designHeightPx + (borderPx * 2);

  return { pixelsPerStitch, effectiveDpi, designWidthPx, designHeightPx, borderPx, totalWidthPx, totalHeightPx };
}

async function renderPrintReadyCanvas(rawStitchData: Buffer, designStitchesWide: number, designStitchesHigh: number, meshCount: number, borderInchesEachSide: number) {
  const { pixelsPerStitch, effectiveDpi, designWidthPx, designHeightPx, borderPx, totalWidthPx, totalHeightPx } = computePrintGeometry(meshCount, designStitchesWide, designStitchesHigh, borderInchesEachSide);
  
  const designImage = await sharp(rawStitchData)
    .resize(designWidthPx, designHeightPx, { kernel: sharp.kernel.nearest })
    .toBuffer();
    
  // Build SVG overlay with registration marks, grid, and rulers
  const markLen = Math.round(0.25 * effectiveDpi); // 0.25 inch marks
  const centerMarkLen = Math.round(0.5 * effectiveDpi);
  const designCenterX = borderPx + Math.round(designWidthPx / 2);
  const designCenterY = borderPx + Math.round(designHeightPx / 2);

  let svgOverlay = `<svg width="${totalWidthPx}" height="${totalHeightPx}" xmlns="http://www.w3.org/2000/svg">`;

  // Corner registration marks (L-shaped at each corner of design area)
  const corners = [
    { x: borderPx, y: borderPx, dx: 1, dy: 1 },     // top-left
    { x: borderPx + designWidthPx, y: borderPx, dx: -1, dy: 1 },  // top-right
    { x: borderPx, y: borderPx + designHeightPx, dx: 1, dy: -1 }, // bottom-left
    { x: borderPx + designWidthPx, y: borderPx + designHeightPx, dx: -1, dy: -1 }  // bottom-right
  ];
  for (const c of corners) {
    svgOverlay += `<line x1="${c.x}" y1="${c.y}" x2="${c.x - c.dx * markLen}" y2="${c.y}" stroke="black" stroke-width="2"/>`;
    svgOverlay += `<line x1="${c.x}" y1="${c.y}" x2="${c.x}" y2="${c.y - c.dy * markLen}" stroke="black" stroke-width="2"/>`;
  }

  // Center crosshairs extending into border
  svgOverlay += `<line x1="${designCenterX}" y1="${borderPx - centerMarkLen}" x2="${designCenterX}" y2="${borderPx}" stroke="black" stroke-width="1" stroke-dasharray="4,4"/>`;
  svgOverlay += `<line x1="${designCenterX}" y1="${borderPx + designHeightPx}" x2="${designCenterX}" y2="${borderPx + designHeightPx + centerMarkLen}" stroke="black" stroke-width="1" stroke-dasharray="4,4"/>`;
  svgOverlay += `<line x1="${borderPx - centerMarkLen}" y1="${designCenterY}" x2="${borderPx}" y2="${designCenterY}" stroke="black" stroke-width="1" stroke-dasharray="4,4"/>`;
  svgOverlay += `<line x1="${borderPx + designWidthPx}" y1="${designCenterY}" x2="${borderPx + designWidthPx + centerMarkLen}" y2="${designCenterY}" stroke="black" stroke-width="1" stroke-dasharray="4,4"/>`;

  // Dashed border rectangle around design area
  svgOverlay += `<rect x="${borderPx}" y="${borderPx}" width="${designWidthPx}" height="${designHeightPx}" fill="none" stroke="black" stroke-width="1" stroke-dasharray="8,4"/>`;

  // Grid lines every 10 stitches (inside design area)
  for (let s = 10; s < designStitchesWide; s += 10) {
    const x = borderPx + s * pixelsPerStitch;
    svgOverlay += `<line x1="${x}" y1="${borderPx}" x2="${x}" y2="${borderPx + designHeightPx}" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>`;
  }
  for (let s = 10; s < designStitchesHigh; s += 10) {
    const y = borderPx + s * pixelsPerStitch;
    svgOverlay += `<line x1="${borderPx}" y1="${y}" x2="${borderPx + designWidthPx}" y2="${y}" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>`;
  }

  // Stitch count rulers along top and left edges (tick + number every 10 stitches)
  const fontSize = Math.max(8, Math.round(pixelsPerStitch * 0.8));
  for (let s = 10; s <= designStitchesWide; s += 10) {
    const x = borderPx + s * pixelsPerStitch;
    svgOverlay += `<line x1="${x}" y1="${borderPx - 10}" x2="${x}" y2="${borderPx}" stroke="black" stroke-width="1"/>`;
    svgOverlay += `<text x="${x}" y="${borderPx - 14}" text-anchor="middle" font-size="${fontSize}" font-family="sans-serif" fill="black">${s}</text>`;
  }
  for (let s = 10; s <= designStitchesHigh; s += 10) {
    const y = borderPx + s * pixelsPerStitch;
    svgOverlay += `<line x1="${borderPx - 10}" y1="${y}" x2="${borderPx}" y2="${y}" stroke="black" stroke-width="1"/>`;
    svgOverlay += `<text x="${borderPx - 14}" y="${y + fontSize / 3}" text-anchor="end" font-size="${fontSize}" font-family="sans-serif" fill="black">${s}</text>`;
  }

  svgOverlay += `</svg>`;
  const svgBuffer = Buffer.from(svgOverlay);

  return await sharp({
    create: {
      width: totalWidthPx,
      height: totalHeightPx,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
  .composite([
    { input: designImage, left: borderPx, top: borderPx },
    { input: svgBuffer, blend: 'over' }
  ])
  .withMetadata({ density: effectiveDpi })
  .png()
  .toBuffer();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Mock endpoint for generating concepts
  app.post("/api/generate-concepts", async (req, res) => {
    const { theme, style, meshCount, shape, finishedWidth, finishedHeight, complexity, maxColors, monogram, borderInches } = req.body;
    
    try {
      let apiKey = process.env.CUSTOM_API_KEY || process.env.GEMINI_API_KEY;
      if (apiKey) {
        // Strip quotes if the user accidentally included them in the Secrets panel
        apiKey = apiKey.replace(/^["']|["']$/g, '').trim();
      }
      
      const ai = new GoogleGenAI(apiKey ? { apiKey } : {});
      
      let monogramInstruction = "";
      let monogramImagePrompt = "";
      if (monogram && monogram.trim() !== "") {
        monogramInstruction = `
      CRITICAL: The user has requested the monogram "${monogram}". 
      You MUST incorporate this monogram visibly and clearly into the design concept.
      Favor placement that remains readable in needlepoint (e.g., bold, thick letters).
      If the canvas size (${finishedWidth}x${finishedHeight} inches) or mesh count (${meshCount}) makes the monogram too small to read, you MUST add a warning to the "warnings" array.`;
        monogramImagePrompt = ` prominently featuring the monogram "${monogram}" in bold, readable typography,`;
      }
      
      // Calculate stitch dimensions so the AI knows the actual resolution
      const designStitchesWide = Math.round(parseFloat(finishedWidth) * parseInt(meshCount));
      const designStitchesHigh = Math.round(parseFloat(finishedHeight) * parseInt(meshCount));
      const minDimension = Math.min(designStitchesWide, designStitchesHigh);
      const minShapeSize = Math.max(6, Math.round(minDimension * 0.12));

      const prompt = `You are an expert needlepoint canvas designer creating designs in the style of modern boutique needlepoint shops (like KC Needlepoint and Atlantic Blue Canvas).
      Generate 8 distinct design concepts for a needlepoint canvas based on the user's theme: "${theme}".
      Style: ${style}, Shape: ${shape}, Complexity: ${complexity}, Mesh: ${meshCount}, Max Colors: ${maxColors}.${monogramInstruction}

      CRITICAL RESOLUTION CONSTRAINT:
      The finished design will be only ${designStitchesWide} x ${designStitchesHigh} stitches (pixels).
      Think of this as a ${designStitchesWide} x ${designStitchesHigh} pixel image.
      Every recognizable element MUST be at least ${minShapeSize} stitches (pixels) across in BOTH dimensions.
      If an element cannot be drawn recognizably in a ${minShapeSize}x${minShapeSize} pixel area, either make it MUCH bigger or leave it out entirely.
      Do NOT include small garnishes, decorative accents, thin lines, or fine details — they will become unrecognizable blobs.

      AESTHETIC DIRECTION:
      - Contemporary preppy style with bold, saturated, high-contrast colors.
      - Think screen-printed poster art, cut-paper collage, or paint-by-number — every shape is one solid uniform color from edge to edge.
      - Large, chunky, extremely simplified shapes. Every element must be clearly recognizable at ${designStitchesWide}x${designStitchesHigh} pixel resolution.
      - Whimsical, graphic, and witty — modern and fun, not old-fashioned.
      - Clean white or solid-color background.
      - Fewer, bigger elements are ALWAYS better than many small ones.

      HARD RULES:
      - FLAT, SOLID color fills ONLY. NO gradients, NO shading, NO anti-aliasing, NO soft edges, NO textures.
      - Every color region must have HARD, CRISP boundaries — like cut paper with no blending.
      - NO visible grid lines, grid overlay, or crosshatch pattern.
      - NO small text, lettering, or signage — it will not be readable at needlepoint resolution.
      - NO photorealism, NO painterly effects.
      - NO small decorative details (garnishes, thin stems, small accessories) — they will be lost.

      Return a JSON array of 8 objects. Each object must have:
      - "title": A catchy title.
      - "imagePrompt": A detailed prompt for an image generation model. MUST start with: "A bold screen-printed poster illustration depicting...". MUST include: "rendered as flat cut-paper collage with exactly ${maxColors} solid saturated colors, every shape filled with one uniform color, hard crisp edges between all color regions, no gradients, no shading, no anti-aliasing, no soft edges, no textures, designed to be recognizable at ${designStitchesWide}x${designStitchesHigh} pixel resolution, extremely simplified chunky shapes (minimum ${minShapeSize} pixels wide), no small details or garnishes, high-contrast contemporary graphic design, clean white background, paint-by-number style with distinct color boundaries, no grid lines, no grid overlay, no crosshatch pattern, no visible pixel grid."${monogramImagePrompt ? ` MUST include: "${monogramImagePrompt.trim()}"` : ""}
      - "needlepointabilityScore": Integer 0-100. (Higher for simpler, bolder designs with large color blocks).
      - "warnings": Array of strings (e.g., "Details may be lost on 13 mesh").
      - "badges": Array of strings (choose 1-3 from: "Beginner Friendly", "Best on 13 Mesh", "Best on 18 Mesh", "High Contrast", "Detail Heavy").
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                imagePrompt: { type: Type.STRING },
                needlepointabilityScore: { type: Type.INTEGER },
                warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
                badges: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["title", "imagePrompt", "needlepointabilityScore", "warnings", "badges"]
            }
          }
        }
      });

      let rawText = response.text || "[]";
      // Strip markdown code blocks if present
      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const conceptsData = JSON.parse(rawText);
      
      // Calculate aspect ratio
      const targetRatio = parseFloat(finishedWidth) / parseFloat(finishedHeight);
      const supportedRatios = [
        { name: "1:1", value: 1.0 },
        { name: "3:4", value: 0.75 },
        { name: "4:3", value: 1.333 },
        { name: "9:16", value: 0.5625 },
        { name: "16:9", value: 1.777 }
      ];
      
      let closestRatio = supportedRatios[0];
      let minDiff = Math.abs(targetRatio - closestRatio.value);
      
      for (let i = 1; i < supportedRatios.length; i++) {
        const diff = Math.abs(targetRatio - supportedRatios[i].value);
        if (diff < minDiff) {
          minDiff = diff;
          closestRatio = supportedRatios[i];
        }
      }
      
      // Generate images in parallel
      const candidates = await Promise.all(conceptsData.map(async (c: any, i: number) => {
        let imageUrl = `https://picsum.photos/seed/${encodeURIComponent(c.title)}/512/512`;
        try {
          const imgRes = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: c.imagePrompt,
            config: {
              imageConfig: {
                aspectRatio: closestRatio.name
              }
            }
          });
          
          // Find the image part
          const parts = imgRes.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.inlineData) {
              imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
              break;
            }
          }
        } catch (e) {
          console.error("Image gen failed for concept", i, e);
        }
        
        return {
          id: `concept-${Date.now()}-${i}`,
          title: c.title,
          originalPrompt: theme,
          style,
          meshCount: parseInt(meshCount),
          finishedWidth: parseFloat(finishedWidth),
          finishedHeight: parseFloat(finishedHeight),
          maxColors: parseInt(maxColors),
          borderInchesEachSide: parseFloat(borderInches || '2'),
          imageUrl,
          needlepointabilityScore: c.needlepointabilityScore,
          warnings: c.warnings,
          badges: c.badges
        };
      }));

      res.json({ candidates });
    } catch (error: any) {
      console.error("Generate concepts error:", error);
      let errorMessage = "Failed to generate concepts";
      
      if (error.message && error.message.includes("API key not valid")) {
        errorMessage = "Your Gemini API key is invalid or missing. Please check the Secrets panel in AI Studio and ensure you have entered a valid API key.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      res.status(500).json({ error: errorMessage });
    }
  });

  // Endpoint to process a chosen concept into a stitch grid
  app.post("/api/process-design", async (req, res) => {
    try {
      const { concept } = req.body;
      
      // Calculate dimensions
      const designStitchesWide = Math.round(concept.finishedWidth * concept.meshCount);
      const designStitchesHigh = Math.round(concept.finishedHeight * concept.meshCount);
      
      // Fetch the image (in a real app, this might be a stored generated image)
      let buffer: Buffer;
      if (concept.imageUrl.startsWith('data:')) {
        const base64Data = concept.imageUrl.split(',')[1];
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        const imageResponse = await fetch(concept.imageUrl);
        const arrayBuffer = await imageResponse.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      }

      // Image processing pipeline:
      // 1. Median filter to remove noise at source resolution
      const simplifiedBuffer = await simplifyBeforeStitchConversion(buffer, designStitchesWide, designStitchesHigh);

      // 2. Posterize to eliminate subtle gradients before quantization
      // (normalize removed — it shifts hue balance too aggressively)
      const posterizeLevels = Math.max(16, concept.maxColors * 3);
      const posterizedBuffer = await posterizeImage(simplifiedBuffer, posterizeLevels);

      // 3. Resize to stitch dimensions and quantize colors
      const quantizedBuffer = await sharp(posterizedBuffer)
        .resize(designStitchesWide, designStitchesHigh, {
          kernel: sharp.kernel.nearest,
          fit: 'fill'
        })
        .png({ palette: true, colors: Math.max(2, Math.min(256, concept.maxColors)) })
        .toBuffer();

      // 5. Remap all colors to nearest DMC thread colors
      const { data: quantizedData, info: quantizedInfo } = await sharp(quantizedBuffer).raw().toBuffer({ resolveWithObject: true });
      const { remappedData, colorMap: dmcColorMap } = remapBufferToDmc(quantizedData, quantizedInfo.width, quantizedInfo.height, quantizedInfo.channels);

      // Clean stray/isolated pixels from the DMC-remapped stitch grid
      const cleanedData = cleanStrayPixels(remappedData, quantizedInfo.width, quantizedInfo.height, quantizedInfo.channels);

      // Rebuild the PNG from cleaned pixel data
      const resizedBuffer = await sharp(cleanedData, {
        raw: { width: quantizedInfo.width, height: quantizedInfo.height, channels: quantizedInfo.channels }
      }).png().toBuffer();

      // 6. Extract palette (now all colors are valid DMC colors)
      const paletteInfo = await extractPaletteFromIndexedImage(resizedBuffer);

      // Run deterministic checks
      const { data, info } = await sharp(resizedBuffer).raw().toBuffer({ resolveWithObject: true });
      const deterministicChecks = runNeedlepointChecks(data, info.width, info.height, info.channels, concept.shape, concept.maxColors, paletteInfo.actualColorCount);
      
      const totalPixels = info.width * info.height;
      const collapseAnalysis = analyzeDetailCollapse(deterministicChecks.checks, totalPixels, concept.meshCount, concept.finishedWidth, concept.finishedHeight);

      // 3. Create Stitch Grid Preview (enlarged with nearest neighbor)
      const previewScale = 10; // 10 pixels per stitch for preview
      const stitchGridPreviewBuffer = await sharp(resizedBuffer)
        .resize(designStitchesWide * previewScale, designStitchesHigh * previewScale, {
          kernel: sharp.kernel.nearest
        })
        .png()
        .toBuffer();

      // 4. Create Painted Canvas Preview
      const paintedCanvasPreviewBuffer = await renderPaintedCanvasPreview(resizedBuffer, designStitchesWide, designStitchesHigh, concept.shape);

      // Convert buffers to base64 for the frontend
      const stitchGridPreviewBase64 = `data:image/png;base64,${stitchGridPreviewBuffer.toString('base64')}`;
      const paintedCanvasPreviewBase64 = `data:image/png;base64,${paintedCanvasPreviewBuffer.toString('base64')}`;

      const border = concept.borderInchesEachSide || 2;
      const printGeometry = computePrintGeometry(concept.meshCount, designStitchesWide, designStitchesHigh, border);

      const processedDesign = {
        ...concept,
        designStitchesWide,
        designStitchesHigh,
        borderInchesEachSide: border,
        totalCanvasWidthInches: concept.finishedWidth + border * 2,
        totalCanvasHeightInches: concept.finishedHeight + border * 2,
        effectiveDpi: printGeometry.effectiveDpi,
        pixelsPerStitch: printGeometry.pixelsPerStitch,
        actualColorCount: paletteInfo.actualColorCount,
        palette: paletteInfo.designPalette, // backward compatibility
        fullPalette: paletteInfo.fullPalette,
        designPalette: paletteInfo.designPalette,
        backgroundColor: paletteInfo.backgroundColor,
        productionWarnings: deterministicChecks.warnings, // backward compatibility
        deterministicChecks,
        productionConfidenceScore: deterministicChecks.productionConfidenceScore,
        collapseWarnings: collapseAnalysis.collapseWarnings,
        detailPreservationScore: collapseAnalysis.detailPreservationScore,
        recommendedMinimumMesh: collapseAnalysis.recommendedMinimumMesh,
        recommendedMinimumSizeInches: collapseAnalysis.recommendedMinimumSizeInches,
        simplificationNotes: "Simplified to fit stitch grid.",
        stitchGridPreviewUrl: stitchGridPreviewBase64,
        paintedCanvasPreviewUrl: paintedCanvasPreviewBase64,
        // Store the raw small buffer for export generation
        rawStitchData: resizedBuffer.toString('base64')
      };

      res.json({ processedDesign });
    } catch (error: any) {
      console.error("Error processing design:", error);
      res.status(500).json({ error: error.message || "Failed to process design" });
    }
  });

  // Endpoint to export designs
  app.post("/api/export", async (req, res) => {
    try {
      const { designs, format } = req.body; // format: 'png', 'pdf', 'zip'
      
      if (!designs || designs.length === 0) {
        return res.status(400).json({ error: "No designs provided" });
      }

      if (format === 'zip') {
        res.attachment('needlepoint-designs.zip');
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);

        for (let i = 0; i < designs.length; i++) {
          const design = designs[i];
          const rawBuffer = Buffer.from(design.rawStitchData, 'base64');
          
          const printBuffer = await renderPrintReadyCanvas(rawBuffer, design.designStitchesWide, design.designStitchesHigh, design.meshCount, design.borderInchesEachSide);
            
          archive.append(printBuffer, { name: `${sanitizeFilename(design.title)}_${i}.png` });

          // Add metadata
          const metadata = JSON.stringify(design, null, 2);
          archive.append(metadata, { name: `${sanitizeFilename(design.title)}_${i}_metadata.json` });

          // Add thread shopping list
          const palette = design.fullPalette || design.designPalette || design.palette || [];
          const printGeo = computePrintGeometry(design.meshCount, design.designStitchesWide, design.designStitchesHigh, design.borderInchesEachSide);
          let shoppingList = `THREAD SHOPPING LIST\n`;
          shoppingList += `Design: ${design.title}\n`;
          shoppingList += `Size: ${design.finishedWidth}" × ${design.finishedHeight}" on ${design.meshCount} mesh\n`;
          shoppingList += `Print at: ${printGeo.effectiveDpi} DPI\n`;
          shoppingList += `${'—'.repeat(50)}\n\n`;
          shoppingList += `DMC #\tColor Name\t\tStitches\t%\n`;
          shoppingList += `${'—'.repeat(50)}\n`;
          for (const color of palette) {
            const dmcNum = (color.dmcNumber || '—').padEnd(8);
            const name = (color.name || '—').padEnd(24);
            const stitches = (color.stitchCount || 0).toLocaleString().padEnd(12);
            const pct = color.percentageOfDesign !== undefined ? `${color.percentageOfDesign}%` : '—';
            shoppingList += `${dmcNum}${name}${stitches}${pct}\n`;
          }
          archive.append(shoppingList, { name: `${sanitizeFilename(design.title)}_${i}_thread_list.txt` });
        }

        await archive.finalize();
        return;
      }

      // For single PNG or PDF, we'll just handle the first one for simplicity in this demo endpoint
      // A more robust implementation would handle multiple files differently or force ZIP
      const design = designs[0];
      const rawBuffer = Buffer.from(design.rawStitchData, 'base64');
      const printBuffer = await renderPrintReadyCanvas(rawBuffer, design.designStitchesWide, design.designStitchesHigh, design.meshCount, design.borderInchesEachSide);

      if (format === 'png') {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(design.title)}.png"`);
        res.send(printBuffer);
      } else if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(design.title)}.pdf"`);

        // PDF size in points (72 points per inch)
        const pdfWidthPoints = design.totalCanvasWidthInches * 72;
        const pdfHeightPoints = design.totalCanvasHeightInches * 72;

        const doc = new PDFDocument({ size: [pdfWidthPoints, pdfHeightPoints] });
        doc.pipe(res);

        // Page 1: Print-ready design with registration marks
        doc.image(printBuffer, 0, 0, { width: pdfWidthPoints, height: pdfHeightPoints });

        // Page 2: Thread Legend
        doc.addPage({ size: 'letter', margin: 50 });
        const margin = 50;
        let cursorY = margin;

        // Title
        doc.fontSize(18).font('Helvetica-Bold').text(design.title, margin, cursorY);
        cursorY += 28;

        // Design info
        doc.fontSize(10).font('Helvetica');
        doc.text(`Finished Size: ${design.finishedWidth}" × ${design.finishedHeight}"  |  Mesh: ${design.meshCount}  |  Stitches: ${design.designStitchesWide} × ${design.designStitchesHigh}`, margin, cursorY);
        cursorY += 16;

        const printGeo = computePrintGeometry(design.meshCount, design.designStitchesWide, design.designStitchesHigh, design.borderInchesEachSide);
        doc.text(`Print at: ${printGeo.effectiveDpi} DPI  |  Total Canvas Cut: ${design.totalCanvasWidthInches}" × ${design.totalCanvasHeightInches}"`, margin, cursorY);
        cursorY += 24;

        // Thread table header
        doc.fontSize(12).font('Helvetica-Bold').text('Thread Legend', margin, cursorY);
        cursorY += 20;

        const colX = { swatch: margin, dmc: margin + 30, name: margin + 90, stitches: margin + 300, pct: margin + 400 };
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('DMC #', colX.dmc, cursorY);
        doc.text('Color Name', colX.name, cursorY);
        doc.text('Stitches', colX.stitches, cursorY);
        doc.text('%', colX.pct, cursorY);
        cursorY += 16;
        doc.moveTo(margin, cursorY).lineTo(500, cursorY).stroke();
        cursorY += 6;

        // Thread rows
        const palette = design.fullPalette || design.designPalette || design.palette || [];
        let totalStitches = 0;
        doc.font('Helvetica').fontSize(9);
        for (const color of palette) {
          if (cursorY > 700) {
            doc.addPage({ size: 'letter', margin: 50 });
            cursorY = margin;
          }

          // Color swatch
          const hex = typeof color === 'string' ? color : color.hex;
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          doc.save().rect(colX.swatch, cursorY - 2, 18, 14).fill([r, g, b]).stroke([0, 0, 0]).restore();

          const dmcNum = color.dmcNumber || '—';
          const colorName = color.name || '—';
          const stitchCount = color.stitchCount || 0;
          const pct = color.percentageOfDesign !== undefined ? `${color.percentageOfDesign}%` : '—';
          totalStitches += stitchCount;

          doc.text(dmcNum, colX.dmc, cursorY);
          doc.text(colorName, colX.name, cursorY);
          doc.text(stitchCount.toLocaleString(), colX.stitches, cursorY);
          doc.text(pct, colX.pct, cursorY);
          cursorY += 18;
        }

        // Total
        cursorY += 4;
        doc.moveTo(margin, cursorY).lineTo(500, cursorY).stroke();
        cursorY += 8;
        doc.font('Helvetica-Bold');
        doc.text(`Total: ${palette.length} colors, ${totalStitches.toLocaleString()} stitches`, margin, cursorY);

        doc.end();
      } else {
        res.status(400).json({ error: "Unsupported format" });
      }

    } catch (error) {
      console.error("Error exporting:", error);
      res.status(500).json({ error: "Failed to export" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
