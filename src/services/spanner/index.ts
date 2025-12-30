/**
 * Google Cloud Spanner service for MCP
 *
 * This module exports all Spanner-related functionality
 */
import { Spanner } from "@google-cloud/spanner";
// Export types and utilities
export * from "./types.js";
export * from "./schema.js";

// Export resources and tools
export { registerSpannerResources } from "./resources.js";
export { registerSpannerTools } from "./tools.js";
export { registerSpannerQueryCountTool } from "./query-count.js";

export async function discoverSpanner(projectId: string) {
  const spanner = new Spanner({ projectId });
  const [instances] = await spanner.getInstances();
  return instances.length > 0;
}