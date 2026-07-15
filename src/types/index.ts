// Domain types (mirrors Prisma schema)

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  researchGoal: string | null;
  status: string;
  tags: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    sources: number;
    entities: number;
    claims: number;
    reports: number;
  };
}

export interface Source {
  id: string;
  workspaceId: string;
  title: string;
  type: string;
  sourceUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  status: "pending" | "processing" | "processed" | "failed" | "reprocessing";
  processingProgress: number;
  processingError: string | null;
  language: string | null;
  createdAt: string;
  updatedAt: string;
  document?: {
    id: string;
    wordCount: number;
    language: string | null;
  } | null;
  _count?: { evidence: number };
}

export interface Entity {
  id: string;
  workspaceId: string;
  name: string;
  type: string;
  aliases: string;
  description: string | null;
  attributes: string;
  confidence: number;
  status: "pending" | "verified" | "rejected" | "disputed" | "merged";
  sourceCount: number;
  createdAt: string;
  _count?: {
    claimEntities: number;
    sourceRelations: number;
    targetRelations: number;
  };
}

export interface Relationship {
  id: string;
  workspaceId: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: string;
  confidence: number;
  status: string;
  sourceEntity?: Entity;
  targetEntity?: Entity;
}

export interface Claim {
  id: string;
  workspaceId: string;
  statement: string;
  type: string;
  confidence: number;
  status: "pending" | "verified" | "rejected" | "disputed" | "archived";
  notes: string | null;
  authoredBy: string;
  createdAt: string;
  entities?: { entity: Entity }[];
  evidence?: Evidence[];
}

export interface Evidence {
  id: string;
  claimId: string;
  sourceId: string | null;
  documentId: string | null;
  chunkId: string | null;
  excerpt: string;
  confidence: number;
  authoredBy: string;
  createdAt: string;
  claim?: { id: string; statement: string };
  source?: { id: string; title: string; type: string } | null;
}

export interface TimelineEvent {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  eventDate: string | null;
  eventDateStr: string | null;
  type: string;
  confidence: number;
  entityId: string | null;
  entity?: { id: string; name: string; type: string } | null;
}

export interface Report {
  id: string;
  workspaceId: string;
  title: string;
  type: string;
  contentMarkdown: string;
  status: string;
  createdAt: string;
}

export interface Opportunity {
  id: string;
  workspaceId: string;
  title: string;
  type: string;
  summary: string;
  contentMarkdown: string;
  status: string;
  confidence: number | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
  messages?: { content: string; role: string; createdAt: string }[];
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: Citation[];
  relatedEntities: string[];
  confidence: number | null;
  createdAt: string;
}

export interface Citation {
  index: number;
  claimId: string;
  statement: string;
  excerpt: string;
  sourceTitle: string;
  confidence: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    typeBreakdown: Record<string, number>;
  };
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  description: string | null;
  confidence: number;
  status: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  confidence: number;
}

export interface WorkspaceStats {
  counts: {
    sources: number;
    entities: number;
    relationships: number;
    claims: number;
    evidence: number;
    timeline: number;
    reports: number;
    conversations: number;
  };
  claims: { pending: number; verified: number; rejected: number };
  sourceStats: { status: string; _count: number }[];
  entityByType: { type: string; _count: number }[];
  recentActivity: Source[];
}

export interface ResearchPlan {
  researchQuestions: string[];
  keywords: string[];
  priorityTopics: string[];
  suggestedSources: string[];
  hypotheses: string[];
  estimatedDuration: number;
  estimatedCost: number;
}

// ============================================================
// ADMIN TYPES
// ============================================================

export interface AuditLog {
  id: string;
  userId: string | null;
  organizationId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  details: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user?: { name: string | null; email: string } | null;
}

export interface ApiKey {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string;
  lastUsedAt: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  user?: { name: string | null; email: string };
  key?: string; // Only on creation
  message?: string;
}

export interface PromptTemplate {
  id: string;
  key: string;
  version: number;
  name: string;
  description: string | null;
  systemPrompt: string;
  userTemplate: string | null;
  variables: string[];
  model: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data: string;
  isRead: boolean;
  createdAt: string;
}

export interface OrgMember {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    isActive: boolean;
    lastLoginAt: string | null;
    createdAt: string;
  };
}

export interface GraphAnalytics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  avgDegree: number;
  topEntitiesByDegree: {
    entityId: string;
    name: string;
    type: string;
    degree: number;
    inDegree: number;
    outDegree: number;
  }[];
  topEntitiesByBetweenness: { entityId: string; name: string; betweenness: number }[];
  communities: { id: number; entities: { id: string; name: string; type: string }[] }[];
  isolatedEntities: { id: string; name: string; type: string }[];
}

export interface ShortestPathResult {
  path: { entityId: string; name: string; type: string }[];
  edges: { type: string; direction: "forward" | "backward" }[];
  length: number;
}

export type ShortestPath = ShortestPathResult | null;

export interface ContinuousUpdateResult {
  mergedEntities: number;
  totalEntities: number;
  removedRelationships: number;
  indexRebuilt: boolean;
  message?: string;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  errors?: { code: string; message: string; field?: string }[];
}
