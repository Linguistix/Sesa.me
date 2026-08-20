import QRCode from "qrcode";

export interface QrOptions {
  /** Foreground (dark module) colour, `#rrggbb`. */
  dark: string;
  /** Background colour, `#rrggbb`, or "transparent" for SVG. */
  light: string;
  /** Pixel width of the PNG. Ignored by the SVG renderer, which is scalable. */
  size: number;
  margin: number;
}

export const DEFAULT_QR_OPTIONS: QrOptions = {
  dark: "#000000",
  light: "#FFFFFF",
  size: 1024,
  margin: 2,
};

/**
 * Error correction is fixed at M: high enough to survive a phone camera at an
 * angle, low enough to keep the module count (and so the printed size) sane.
 */
const ERROR_CORRECTION = "M" as const;

export async function qrToSvg(text: string, options: Partial<QrOptions> = {}): Promise<string> {
  const opts = { ...DEFAULT_QR_OPTIONS, ...options };
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: ERROR_CORRECTION,
    margin: opts.margin,
    color: { dark: opts.dark, light: opts.light },
  });
}

export async function qrToPngBuffer(
  text: string,
  options: Partial<QrOptions> = {},
): Promise<Buffer> {
  const opts = { ...DEFAULT_QR_OPTIONS, ...options };
  return QRCode.toBuffer(text, {
    type: "png",
    errorCorrectionLevel: ERROR_CORRECTION,
    width: opts.size,
    margin: opts.margin,
    color: { dark: opts.dark, light: opts.light },
  });
}

export async function qrToDataUrl(
  text: string,
  options: Partial<QrOptions> = {},
): Promise<string> {
  const opts = { ...DEFAULT_QR_OPTIONS, ...options };
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: ERROR_CORRECTION,
    width: opts.size,
    margin: opts.margin,
    color: { dark: opts.dark, light: opts.light },
  });
}
