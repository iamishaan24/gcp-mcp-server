/**
 * Google Cloud Compute service for MCP
 */
import { InstancesClient } from "@google-cloud/compute";

export * from './types.js';
export { registerComputeResources } from './resources.js';
export { registerComputeTools } from './tools.js';

export async function discoverCompute(projectId: string) {
  const client = new InstancesClient();
  const nodes: string[] = [];

  for await (const zone of client.listAsync({ project: projectId })) {
    if (zone) {
      nodes.push("COMPUTE");
      break;
    }
  }

  return nodes.length > 0;
}