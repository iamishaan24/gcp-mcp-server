/**
 * Minimal resource registration for Compute
 */
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InstancesClient, ZonesClient } from '@google-cloud/compute';
import { getProjectId } from '../../utils/auth.js';

export function registerComputeResources(server: McpServer): void {
  // Resource for listing instances via resource discovery
  server.resource(
    'gcp-compute-instances',
    new ResourceTemplate('gcp-compute://{projectId}/instances', { list: undefined }),
    async (uri, { projectId }) => {
      try {
        const project = Array.isArray(projectId) ? projectId[0] : projectId || (await getProjectId());
        const instancesClient = new InstancesClient();
        const zonesClient = new ZonesClient();

        // Get zones for the project
        const [zones] = await zonesClient.list({ project });
        const zoneNames = (zones || []).map((z: any) => z.name).filter(Boolean);

        const allInstances: any[] = [];
        for (const z of zoneNames) {
          const [listResp] = await instancesClient.list({ project, zone: z });
          const items = (listResp || []) as any[];
          allInstances.push(...items);
        }

        if (allInstances.length === 0) {
          return {
            contents: [
              { uri: uri.href, text: `# Instances\n\nNo compute instances found in project ${project}` },
            ],
          };
        }

        const body = allInstances
          .map((inst) => `- ${inst.name || 'unknown'} (${(inst.zone || '').split('/').pop() || 'unknown'}) — ${inst.status || 'UNKNOWN'}`)
          .join('\n');

        return {
          contents: [{ uri: uri.href, text: `# Instances\n\nProject: ${project}\n\n${body}` }],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          contents: [
            {
              uri: uri.href,
              text: `# Error Fetching Instances\n\nAn error occurred while fetching instances: ${message}`,
            },
          ],
        };
      }
    },
  );
}
