import { node, edge, buildDiagram } from "../../utils/mermaid.js";

import { discoverCompute } from "../compute/index.js";
import { discoverSpanner } from "../spanner/index.js";
import { discoverLogging } from "../logging/index.js";
import { discoverMonitoring } from "../monitoring/index.js";
import { discoverIam } from "../iam/index.js";
export { registerDiagramTools } from "./tools.js";

export async function generateGcpMermaidDiagram(projectId: string) {
  const nodes: string[] = [];
  const edges: string[] = [];

  nodes.push(node("PROJECT", `GCP Project<br/>${projectId}`, "project"));

  if (await discoverCompute(projectId)) {
    nodes.push(node("COMPUTE", "Compute Engine", "compute"));
    edges.push(edge("PROJECT", "COMPUTE"));
  }

  if (await discoverSpanner(projectId)) {
    nodes.push(node("SPANNER", "Cloud Spanner", "database"));
    edges.push(edge("PROJECT", "SPANNER"));
  }

  if (await discoverIam()) {
    nodes.push(node("IAM", "IAM", "iam"));
    edges.push(edge("PROJECT", "IAM"));
  }

  if (await discoverLogging()) {
    nodes.push(node("LOGGING", "Cloud Logging", "observability"));
    edges.push(edge("PROJECT", "LOGGING"));
  }

  if (await discoverMonitoring()) {
    nodes.push(node("MONITORING", "Cloud Monitoring", "observability"));
    edges.push(edge("PROJECT", "MONITORING"));
  }

  return buildDiagram(nodes, edges);
}
