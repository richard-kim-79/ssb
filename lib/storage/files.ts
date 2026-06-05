/**
 * File storage adapter (Supabase Storage, with a local-disk fallback for dev).
 *
 * Backend selection:
 *  - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set -> Supabase Storage (production)
 *  - otherwise                                    -> ./uploads on local disk (dev only)
 *
 * Files are addressed by a stable relative "key" stored in the DB, e.g.
 *   permanent/sessions/{id}/문제.txt
 *   permanent/submissions/{id}/답안.docx
 *   blog/{postId}/123-image.png
 */
import * as fs from "fs";
import * as path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "uploads";
const LOCAL_ROOT = "uploads";

let _supabase: SupabaseClient | null | undefined;

function getSupabase(): SupabaseClient | null {
  if (_supabase !== undefined) return _supabase;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  _supabase = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;
  return _supabase;
}

export function usingSupabase(): boolean {
  return getSupabase() !== null;
}

function localPath(key: string): string {
  return path.join(LOCAL_ROOT, key);
}

/** Save a buffer at `key`. Returns the key (to store in the database). */
export async function saveBuffer(key: string, buffer: Buffer, contentType?: string): Promise<string> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
      contentType: contentType || "application/octet-stream",
      upsert: true,
    });
    if (error) throw new Error(`Supabase 업로드 실패: ${error.message}`);
    return key;
  }
  const target = localPath(key);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, buffer);
  return key;
}

/** Read the file at `key` into a Buffer. */
export async function readBuffer(key: string): Promise<Buffer> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.storage.from(BUCKET).download(key);
    if (error || !data) throw new Error(`Supabase 다운로드 실패: ${error?.message || "no data"}`);
    return Buffer.from(await data.arrayBuffer());
  }
  return fs.promises.readFile(localPath(key));
}

/** Whether a file exists at `key`. */
export async function exists(key: string): Promise<boolean> {
  const supabase = getSupabase();
  if (supabase) {
    const dir = path.posix.dirname(key);
    const base = path.posix.basename(key);
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(dir === "." ? "" : dir, { search: base });
    if (error) return false;
    return !!data?.some((f) => f.name === base);
  }
  return fs.promises
    .access(localPath(key))
    .then(() => true)
    .catch(() => false);
}

/** Delete the file at `key` (best effort). */
export async function deleteFile(key: string): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    await supabase.storage.from(BUCKET).remove([key]);
    return;
  }
  await fs.promises.unlink(localPath(key)).catch(() => {});
}

interface ServeOptions {
  filename?: string;
  mimeType?: string;
  disposition?: "attachment" | "inline";
}

/** Build a download/inline Response for the file at `key` with proper headers. */
export async function fileResponse(key: string, opts: ServeOptions = {}): Promise<Response> {
  const { filename, mimeType, disposition = "attachment" } = opts;
  const buffer = await readBuffer(key);
  const headers = new Headers();
  headers.set("Content-Type", mimeType || "application/octet-stream");
  headers.set("Content-Length", String(buffer.length));
  if (filename) {
    const encoded = encodeURIComponent(filename);
    const ascii = filename.replace(/[^\x00-\x7F]/g, "_");
    headers.set("Content-Disposition", `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`);
  }
  // Cast for the Web Response body type across Node/Edge.
  return new Response(new Uint8Array(buffer), { status: 200, headers });
}
