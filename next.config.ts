import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / heavy Node deps that must not be bundled by the server compiler.
  // pdf-parse in particular reads a test fixture at import time when bundled.
  serverExternalPackages: ["pdf-parse", "mammoth", "archiver", "postgres", "bcryptjs"],
};

export default nextConfig;
