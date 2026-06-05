import * as path from "path";
import {
  extractTextFromBuffer,
  decodeFilename,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
} from "@/lib/parsing/document";
import { saveBuffer } from "@/lib/storage/files";
import { ApiError } from "@/lib/http";

export interface ProcessedUpload {
  text: string; // combined extracted text from all files
  filenames: string[]; // decoded original filenames
  paths: string[]; // storage keys
}

/** Pull all File entries for a multipart form field (supports multiple files). */
export function filesFromForm(form: FormData, field: string): File[] {
  return form.getAll(field).filter((v): v is File => v instanceof File && v.size > 0);
}

/** Validate, parse, and persist uploaded files under `keyPrefix`. */
export async function processUploads(files: File[], keyPrefix: string): Promise<ProcessedUpload> {
  const texts: string[] = [];
  const filenames: string[] = [];
  const paths: string[] = [];

  let index = 0;
  for (const file of files) {
    if (file.size === 0) continue;
    if (file.size > MAX_FILE_SIZE) {
      throw new ApiError(400, `파일이 너무 큽니다 (최대 10MB): ${file.name}`, "file_too_large");
    }
    const filename = decodeFilename(file.name);
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new ApiError(400, `지원하지 않는 파일 형식입니다: ${ext}`, "unsupported_file");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { text } = await extractTextFromBuffer(buffer, filename);
    const key = `${keyPrefix}/${index}-${filename}`;
    await saveBuffer(key, buffer, file.type || undefined);

    texts.push(text);
    filenames.push(filename);
    paths.push(key);
    index++;
  }

  return { text: texts.join("\n\n"), filenames, paths };
}
