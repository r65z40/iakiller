import QRCode from "qrcode";
import { appUrl } from "@/lib/config";

/** URL stable encodée dans le QR code. */
export function qrTargetUrl(publicToken: string) {
  return `${appUrl()}/r/${publicToken}`;
}

/** QR contrasté (noir sur blanc), marge de 4 modules (zone de silence recommandée), correction M. */
export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 4, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#FFFFFF" } });
}

export async function qrPng(url: string, width = 1024): Promise<Buffer> {
  return QRCode.toBuffer(url, { type: "png", width, margin: 4, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#FFFFFF" } });
}
