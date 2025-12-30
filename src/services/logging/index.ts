/**
 * Google Cloud Logging service for MCP
 *
 * This module exports all Logging-related functionality
 */

// Export types and utilities
export * from "./types.js";

// Export resources and tools
export { registerLoggingResources } from "./resources.js";
export { registerLoggingTools } from "./tools.js";

export async function discoverLogging() {
  // Logging is enabled by default if project exists
  return true;
}