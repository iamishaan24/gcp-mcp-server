/**
 * Types and helpers for Compute service
 */
import { InstancesClient } from '@google-cloud/compute';
import { getProjectId } from '../../utils/auth.js';

export function getComputeClient(): InstancesClient {
  return new InstancesClient();
}

export function formatInstance(instance: any): string {
  const name = instance.name || 'unknown';
  const zone = (instance.zone || '').split('/').pop() || 'unknown';
  const status = instance.status || 'UNKNOWN';
  const machineType = (instance.machineType || '').split('/').pop() || 'unknown';
  const network = instance.networkInterfaces
    ? instance.networkInterfaces.map((n: any) => n.network || '').join(', ')
    : 'none';

  const externalIps = instance.networkInterfaces
    ? instance.networkInterfaces.flatMap((n: any) => (n.accessConfigs || []).map((ac: any) => ac.natIP).filter(Boolean))
    : [];
  const ipsText = externalIps.length > 0 ? externalIps.join(', ') : 'none';

  const sshHint = externalIps.length > 0 ? `\n    SSH (gcloud): ` + `\`gcloud compute ssh ${name} --zone ${zone}\`` + `\n    SSH (direct): ` + `\`ssh <USERNAME>@${externalIps[0]}\`` : '';

  return `- **${name}** (${zone}) — ${status} — ${machineType} — networks: ${network} — external IPs: ${ipsText}${sshHint}`;
}

export async function getProjectOrDefault(): Promise<string> {
  return await getProjectId();
}
