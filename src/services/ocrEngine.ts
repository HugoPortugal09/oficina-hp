import { createWorker } from 'tesseract.js';
import { db, STORAGE_KEYS } from './dbService';
import type { Equipamento, PecaCatalogo } from '../types';
import { findBestMatchingEquipment, findBestMatchingPart, formatPlate, normalizePlate } from './ollamaService';

let workerPromise: Promise<any> | null = null;

async function getOCRWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      try {
        const worker = await createWorker('eng');
        return worker;
      } catch (err) {
        console.warn('[OCR Worker Init Failed]', err);
        return null;
      }
    })();
  }
  return workerPromise;
}

/**
 * Creates rotated canvas versions (0 deg and 90 deg) with contrast enhancement
 */
async function getRotatedCanvasBase64(base64Str: string, rotateDeg: number): Promise<string> {
  if (typeof window === 'undefined' || !base64Str.startsWith('data:image')) {
    return base64Str;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      const maxDim = 1200;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      if (rotateDeg === 90 || rotateDeg === 270) {
        canvas.width = h;
        canvas.height = w;
      } else {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.save();
      if (rotateDeg === 90) {
        ctx.translate(h, 0);
        ctx.rotate((90 * Math.PI) / 180);
      } else if (rotateDeg === 270) {
        ctx.translate(0, w);
        ctx.rotate((270 * Math.PI) / 180);
      } else if (rotateDeg === 180) {
        ctx.translate(w, h);
        ctx.rotate((180 * Math.PI) / 180);
      }
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(base64Str);
    img.src = base64Str;
  });
}

export interface LocalOCRResult {
  rawText: string;
  detectedPlate?: string;
  matchedEquipment?: Equipamento;
  detectedPartRef?: string;
  detectedPartName?: string;
  matchedPart?: PecaCatalogo;
  odometerKm?: number;
  confidence: number;
}

async function doOCRScan(base64Image: string): Promise<LocalOCRResult> {
  const knownEquipments = db.get<Equipamento>(STORAGE_KEYS.EQUIPAMENTOS);
  const knownCatalog = db.get<PecaCatalogo>(STORAGE_KEYS.PECAS_CATALOGO);

  try {
    const worker = await getOCRWorker();
    if (!worker) {
      return { rawText: '', confidence: 0 };
    }

    // 1. Try normal orientation 0 deg
    const img0 = await getRotatedCanvasBase64(base64Image, 0);
    const res0 = await worker.recognize(img0);
    let fullText = res0.data.text || '';

    // 2. If no clear plate or part ref found, try 90 deg rotation (essential for vertical labels & cylinders)
    const hasClearCode = /(?:[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z0-9]{2}|HA-\d+|REF|FIL|GRAUMP|CAVILHA|INDICADOR)/i.test(fullText);
    if (!hasClearCode) {
      const img90 = await getRotatedCanvasBase64(base64Image, 90);
      const res90 = await worker.recognize(img90);
      const text90 = res90.data.text || '';
      fullText = `${fullText}\n${text90}`;
    }

    const lines: string[] = fullText.split('\n').map((l: string) => l.trim()).filter(Boolean);

    let foundPlate: string | undefined = undefined;
    let foundPartRef: string | undefined = undefined;
    let foundPartName: string | undefined = undefined;
    let foundOdo: number | undefined = undefined;

    // A. Search for Part References First: e.g. HA-149-617, HA-106-074, FIL-1029, BOSCH-123
    const partRefRegex = /\b([A-Z]{1,5}-\d{2,4}-\d{2,4}|[A-Z]{2,5}-\d{3,8}|[A-Z]{2,4}\d{4,8})\b/gi;
    const refMatches = fullText.match(partRefRegex);
    if (refMatches && refMatches.length > 0) {
      foundPartRef = refMatches[0].toUpperCase();
    }

    // B. Search for Part Names (e.g. CAVILHA SISTEMA 3 ESCOVAS, INDICADOR NIVEL AGUA, FILTRO)
    for (const line of lines) {
      const upper = line.toUpperCase();
      if (
        (upper.includes('CAVILHA') ||
          upper.includes('INDICADOR') ||
          upper.includes('FILTRO') ||
          upper.includes('PASTILHA') ||
          upper.includes('ESCOVA') ||
          upper.includes('CORREIA') ||
          upper.includes('BOMBA') ||
          upper.includes('OLEO') ||
          upper.includes('ÓLEO') ||
          upper.includes('VALVULA') ||
          upper.includes('VÁLVULA')) &&
        !upper.includes('GRAUMP') &&
        upper.length >= 4
      ) {
        foundPartName = line.replace(/GRAUMP[^a-zA-Z0-9]*/gi, '').trim();
        break;
      }
    }

    // C. Search for Portuguese Plate Pattern: e.g. 72-TZ-38, 00-AA-00, AA-00-AA, etc.
    const isStrictPtPlate = (s?: string): boolean => {
      if (!s) return false;
      const clean = s.replace(/[^A-Z0-9]/g, '').toUpperCase();
      if (clean.length !== 6) return false;
      return /^(?:[A-Z]{2}\d{4}|\d{4}[A-Z]{2}|\d{2}[A-Z]{2}\d{2}|[A-Z]{2}\d{2}[A-Z]{2}|\d{2}[A-Z]{2}[A-Z]{2})$/.test(clean);
    };

    const plateRegex = /\b([0-9A-Z]{2}[-\s.][0-9A-Z]{2}[-\s.][0-9A-Z]{2})\b/gi;
    const plateMatches = fullText.match(plateRegex);
    if (plateMatches && plateMatches.length > 0) {
      for (const m of plateMatches) {
        const clean = m.replace(/[\s.]/g, '-').toUpperCase();
        if (clean.length === 8 && isStrictPtPlate(clean)) {
          // Make sure this plate match isn't just part of a part code like HA-106-074
          if (!foundPartRef || !foundPartRef.includes(clean.replace(/-/g, ''))) {
            foundPlate = clean;
            break;
          }
        }
      }
    }

    // If part reference is detected on a sticker/label (and no equipment matches the plate directly), prioritize part
    const matchedEquip = foundPlate ? findBestMatchingEquipment(foundPlate, knownEquipments) : undefined;
    const matchedPart = (foundPartRef || foundPartName) ? findBestMatchingPart(foundPartRef, foundPartName, knownCatalog) : undefined;

    // If it's a part label with HA-xxx-xxx or part name, clear false plate
    if ((foundPartRef || foundPartName) && !matchedEquip) {
      foundPlate = undefined;
    }

    return {
      rawText: fullText,
      detectedPlate: matchedEquip?.matricula || (foundPlate ? formatPlate(foundPlate) : undefined),
      matchedEquipment: matchedEquip,
      detectedPartRef: matchedPart?.referencia || foundPartRef,
      detectedPartName: matchedPart?.designacao || foundPartName,
      matchedPart: matchedPart,
      odometerKm: foundOdo,
      confidence: matchedEquip || matchedPart ? 0.98 : 0.85
    };
  } catch (err: any) {
    console.warn('[Local OCR Worker Error]', err);
    return {
      rawText: '',
      confidence: 0
    };
  }
}

/**
 * Extracts license plates and part references with multi-orientation OCR (0 deg & 90 deg)
 * Safely wraps with a 6-second timeout to prevent any UI blocking.
 */
export async function runLocalOCROnImage(base64Image: string): Promise<LocalOCRResult> {
  const timeoutPromise = new Promise<LocalOCRResult>((resolve) =>
    setTimeout(() => resolve({ rawText: '', confidence: 0 }), 6000)
  );
  return Promise.race([doOCRScan(base64Image), timeoutPromise]);
}
