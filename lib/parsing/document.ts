import * as path from "path";
import mammoth from "mammoth";

export interface DocumentContent {
  text: string;
  filename: string;
  fileType: string;
  extractedAt: string;
}

export const ALLOWED_EXTENSIONS = [".txt", ".docx", ".pdf", ".jpg", ".jpeg", ".png", ".webp"];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const IMAGE_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Fix Korean filenames that arrive latin1-encoded from multipart parsing. */
export function decodeFilename(name: string): string {
  try {
    const decoded = Buffer.from(name, "latin1").toString("utf8");
    // If decoding produced valid Hangul, prefer it; otherwise keep original.
    return /[가-힣]/.test(decoded) ? decoded : name;
  } catch {
    return name;
  }
}

export function cleanText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/ {3,}/g, "  ")
    .trim();
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  if (result.messages?.length) console.warn("DOCX 파싱 경고:", result.messages);
  return result.value;
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  // Dynamic import: pdf-parse reads a test fixture at module init when bundled.
  const mod = (await import("pdf-parse")) as unknown as {
    default?: (b: Buffer) => Promise<{ text: string }>;
  };
  const parse = mod.default ?? (mod as unknown as (b: Buffer) => Promise<{ text: string }>);

  if (buffer.length < 100) throw new Error("PDF 파일이 너무 작거나 비어있습니다.");
  if (!buffer.subarray(0, 5).toString().startsWith("%PDF")) throw new Error("유효하지 않은 PDF 파일 형식입니다.");

  try {
    const data = await parse(buffer);
    if (!data.text || data.text.trim().length === 0)
      throw new Error("PDF에서 텍스트를 추출할 수 없습니다. 파일이 손상되었거나 텍스트가 없을 수 있습니다.");
    return data.text;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (/XRef|Invalid PDF structure/.test(msg))
      throw new Error("PDF 파일이 손상되었거나 지원되지 않는 형식입니다. 다른 PDF 파일을 사용해주세요.");
    if (/password|encrypted/.test(msg)) throw new Error("PDF 파일이 암호로 보호되어 있습니다. 암호가 없는 PDF 파일을 사용해주세요.");
    throw error instanceof Error ? error : new Error("PDF 파일 처리 중 오류가 발생했습니다.");
  }
}

function extractFromImage(buffer: Buffer, mimeType: string): string {
  // OCR is handled downstream by Gemini multimodal. Encode the requested mime type.
  return `[IMAGE_DATA:${mimeType};base64,${buffer.toString("base64")}]`;
}

/** Extract text from an in-memory buffer based on the original filename's extension. */
export async function extractTextFromBuffer(buffer: Buffer, originalName: string): Promise<DocumentContent> {
  const ext = path.extname(originalName).toLowerCase();
  const fileType = ext.slice(1);
  try {
    let text = "";
    switch (ext) {
      case ".txt":
        text = buffer.toString("utf-8");
        break;
      case ".docx":
        text = await extractFromDocx(buffer);
        break;
      case ".pdf":
        text = await extractFromPdf(buffer);
        break;
      case ".jpg":
      case ".jpeg":
      case ".png":
      case ".webp":
        text = extractFromImage(buffer, IMAGE_MIME[ext]);
        break;
      default:
        throw new Error(`지원하지 않는 파일 형식입니다: ${ext}`);
    }

    if (!text.startsWith("[IMAGE_DATA:")) {
      text = cleanText(text);
      if (text.length < 5) throw new Error("추출된 텍스트가 너무 짧습니다. 파일 내용을 확인해주세요.");
    }
    return { text, filename: originalName, fileType, extractedAt: new Date().toISOString() };
  } catch (error) {
    console.error(`문서 파싱 오류 (${originalName}):`, error);
    throw new Error(`문서를 읽을 수 없습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
  }
}

/** Lightweight content validation (mirrors the original implementation). */
export function validateContent(content: DocumentContent, expectedType: "prompt" | "criteria" | "essay"): boolean {
  const { text } = content;
  if (text.startsWith("[IMAGE_DATA:")) return text.length > 20;

  const minLengths = { prompt: 20, criteria: 30, essay: 50 };
  if (text.length < minLengths[expectedType]) return false;

  const uniqueChars = new Set(text.toLowerCase().replace(/\s/g, ""));
  if (uniqueChars.size < 10) return false;

  switch (expectedType) {
    case "prompt":
      return /[?？]|논하|서술하|설명하|분석하|비교하|평가하|토론하|작성하|쓰시오|하시오|제시하|의견|생각|주장|견해|관점|문제|주제|상황|글을|답안/.test(text);
    case "criteria":
      return /점수|평가|채점|기준|평점|등급|점|배점/.test(text);
    case "essay":
      return true;
  }
}
