/**
 * Diagram tools for Google Cloud MCP
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateGcpMermaidDiagram } from "./index.js";
import { logger } from "../../utils/logger.js";

export function registerDiagramTools(server: McpServer): void {
  server.registerTool(
    "generate_gcp_mermaid_diagram",
    {
      title: "Generate GCP Mermaid Diagram",
      description: "Generate a Mermaid architecture diagram for a GCP project",
      inputSchema: {
        projectId: z.string().describe("GCP project ID"),
      },
    },
    async ({ projectId }) => {
      try {
        const diagram = await generateGcpMermaidDiagram(projectId);
        return { content: [{ type: "text", text: diagram }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error(`Error generating mermaid diagram for ${projectId}: ${message}`);
        return {
          content: [{ type: "text", text: `# Error Generating Diagram\n\n${message}` }],
          isError: true,
        };
      }
    },
  );
}
