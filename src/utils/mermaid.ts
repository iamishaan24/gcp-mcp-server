export type MermaidNodeClass =
  | "project"
  | "compute"
  | "database"
  | "storage"
  | "network"
  | "iam"
  | "observability";

export function node(
  id: string,
  label: string,
  cls: MermaidNodeClass
) {
  return `${id}["${label}"]:::${cls}`;
}

export function edge(from: string, to: string, label?: string) {
  return label ? `${from} -->|${label}| ${to}` : `${from} --> ${to}`;
}

export function buildDiagram(
  nodes: string[],
  edges: string[]
): string {
  return `
flowchart LR
%% =========================
%% Google Cloud Architecture
%% =========================

${nodes.join("\n")}

${edges.join("\n")}

%% =========================
%% GCP Styles
%% =========================
classDef project fill:#1a73e8,color:#fff,stroke:#174ea6,stroke-width:2px
classDef compute fill:#e8f0fe,stroke:#1a73e8
classDef database fill:#fce8e6,stroke:#d93025
classDef storage fill:#e8f0fe,stroke:#1967d2
classDef network fill:#e6f4ea,stroke:#188038
classDef iam fill:#ede7f6,stroke:#673ab7
classDef observability fill:#fff3e0,stroke:#ef6c00
`;
}
