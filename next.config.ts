import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't auto-write a managed block into AGENTS.md (this repo manages it itself).
  agentRules: false,
};

export default nextConfig;
