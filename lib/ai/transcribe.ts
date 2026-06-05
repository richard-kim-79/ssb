import { GoogleGenAI } from "@google/genai";
import { isRetryableError, sleep, withTimeout } from "./retry";

/**
 * Multimodal transcription (OCR) for PDF + image uploads.
 *
 * Most users upload PDFs or photos of handwritten/printed answers. To keep the
 * rest of the pipeline text-based (async grading, inline 첨삭 anchoring, diff/재채점
 * all operate on plain text + char offsets), we transcribe those files to verbatim
 * text at ingest time with Gemini multimodal, then store/grade/annotate that text.
 */

const MAX_RETRIES = Number(process.env.AI_MAX_RETRIES) || Number(process.env.GEMINI_MAX_RETRIES) || 3;
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || Number(process.env.GEMINI_TIMEOUT_MS) || 85_000;

/** Vision-capable model for OCR. Cheap Flash by default; override with TRANSCRIBE_MODEL. */
function transcribeModel(): string {
  return process.env.TRANSCRIBE_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

const TRANSCRIBE_PROMPT = `다음 파일(PDF 또는 사진)에 적힌 글을 그대로 텍스트로 옮겨 적으세요.

규칙:
- 보이는 글자를 빠짐없이, 원문 그대로 옮길 것 (요약·해석·교정·추가 금지)
- 줄바꿈과 문단 구분을 최대한 원본과 비슷하게 유지할 것
- 손글씨도 최대한 정확히 판독해서 옮길 것
- 맞춤법/띄어쓰기 오류가 있어도 고치지 말고 원문 그대로 옮길 것
- 표지·머리글 등 답안과 무관한 인쇄 문구는 제외하고 실제 작성된 내용만 옮길 것
- 설명이나 안내 문구 없이 옮겨 적은 본문 텍스트만 출력할 것`;

/**
 * Transcribe a single PDF/image buffer to verbatim plain text via Gemini multimodal.
 * Retries transient failures with backoff and enforces a per-attempt timeout.
 */
export async function transcribeFile(buffer: Buffer, mimeType: string): Promise<string> {
  const ai = getClient();
  const model = transcribeModel();
  const inlineData = { data: buffer.toString("base64"), mimeType };

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: [{ text: TRANSCRIBE_PROMPT }, { inlineData }],
        }),
        TIMEOUT_MS,
      );
      const text = (response.text || "").trim();
      if (!text) throw new Error("파일에서 글자를 인식하지 못했습니다.");
      return text;
    } catch (error) {
      lastError = error;
      console.error(`전사 오류 (${model}, ${mimeType}, attempt ${attempt}/${MAX_RETRIES}):`, error);
      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      break;
    }
  }

  if (lastError instanceof Error) {
    if (lastError.message.includes("API key")) throw new Error("AI 서비스 설정이 올바르지 않습니다. 관리자에게 문의하세요.");
    if (/quota|rate.?limit|\b429\b/i.test(lastError.message))
      throw new Error("AI 서비스 사용 한도가 초과되었습니다. 잠시 후 다시 시도해주세요.");
    throw lastError;
  }
  throw new Error("파일 전사 중 오류가 발생했습니다. 다시 시도해주세요.");
}
