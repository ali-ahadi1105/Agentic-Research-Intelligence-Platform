/**
 * Knowledge Extraction Agents (per PROJECT.md § 34-43)
 *
 * Each agent has a clearly defined responsibility, input, output, and execution lifecycle.
 * These agents are coordinated by the orchestrator in services/research-pipeline.ts.
 */
import "server-only";
import { chatCompletion, chatCompletionJson } from "./client";
import { PROMPTS } from "../prompts/templates";
import { db } from "../db";
import type { ProviderConfig } from "./providers/types";

// Optional provider override — passed from API routes that resolve user's provider
let _providerOverride: ProviderConfig | null = null;

export function setProviderOverride(config: ProviderConfig | null) {
  _providerOverride = config;
}

function providerConfig(): ProviderConfig | undefined {
  return _providerOverride || undefined;
}

// ============================================================
// Type Definitions for Agent Inputs/Outputs
// ============================================================

export interface ExtractedEntity {
  name: string;
  type: string;
  aliases: string[];
  description: string;
  attributes: Record<string, unknown>;
  confidence: number;
}

export interface ExtractedClaim {
  statement: string;
  excerpt: string;
  entityNames: string[];
  type: string;
  confidence: number;
  eventDate: string | null;
}

export interface ExtractedRelationship {
  sourceEntityName: string;
  targetEntityName: string;
  type: string;
  confidence: number;
  excerpt: string;
}

export interface ExtractedTimelineEvent {
  title: string;
  description: string;
  eventDate: string | null;
  eventDateStr: string | null;
  type: string;
  entityNames: string[];
}

// ============================================================
// Chunking Utility
// ============================================================

/**
 * Split text into overlapping chunks for processing.
 */
export function chunkText(
  text: string,
  chunkSize: number = 2000,
  overlap: number = 200
): string[] {
  if (text.length <= chunkSize) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start >= text.length - overlap) break;
  }
  return chunks;
}

// ============================================================
// Entity Extraction Agent (§ 34)
// ============================================================

export async function extractEntities(text: string): Promise<ExtractedEntity[]> {
  if (!text || text.trim().length < 50) return [];

  // Clean text: remove problematic Unicode control chars that confuse LLMs
  const cleaned = text
    .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, "") // ZWJ/ZWNJ/LRM/RLM/BOM
    .replace(/\u0000/g, "") // null chars
    .trim();
  // Use first 8000 chars for entity extraction
  const truncated = cleaned.slice(0, 8000);

  const result = await chatCompletionJson<{ entities: ExtractedEntity[] }>({
    messages: [
      { role: "system", content: PROMPTS.entityExtraction.system },
      {
        role: "user",
        content: `Extract all notable entities from the following text:\n\n---\n${truncated}\n---`,
      },
    ],
    temperature: 0.1,
    maxTokens: 3000,
    model: "bzl/auto:free",
  }, providerConfig());

  return result.entities || [];
}

// ============================================================
// Claim Extraction Agent (§ 36)
// ============================================================

export async function extractClaims(
  text: string,
  knownEntityNames: string[] = []
): Promise<ExtractedClaim[]> {
  if (!text || text.trim().length < 50) return [];

  // Clean text: remove problematic Unicode control chars that confuse LLMs
  const cleaned = text
    .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, "")
    .replace(/\u0000/g, "")
    .trim();
  const truncated = cleaned.slice(0, 8000);

  const result = await chatCompletionJson<{ claims: ExtractedClaim[] }>({
    messages: [
      { role: "system", content: PROMPTS.claimExtraction.system },
      {
        role: "user",
        content: `Extract factual claims from the following text.
${knownEntityNames.length > 0 ? `\nKnown entities (use these exact names when applicable): ${knownEntityNames.join(", ")}` : ""}

Return JSON: { "claims": [{ "statement": "...", "excerpt": "...", "entityNames": [...], "type": "fact|assertion|prediction|opinion", "confidence": 0.9 }] }

Text:
---
${truncated}
---`,
      },
    ],
    temperature: 0.1,
    maxTokens: 3000,
    model: "bzl/auto:free",
  }, providerConfig());

  return result.claims || [];
}

// ============================================================
// Relationship Extraction Agent (§ 35)
// ============================================================

export async function extractRelationships(
  text: string,
  entities: ExtractedEntity[] = []
): Promise<ExtractedRelationship[]> {
  if (!text || entities.length < 2) return [];

  const cleaned = text
    .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, "")
    .replace(/\u0000/g, "")
    .trim();
  const truncated = cleaned.slice(0, 6000);
  const entityList = entities.map((e) => `- ${e.name} (${e.type})`).join("\n");

  const result = await chatCompletionJson<{
    relationships: ExtractedRelationship[];
  }>({
    messages: [
      { role: "system", content: PROMPTS.relationshipExtraction.system },
      {
        role: "user",
        content: `Based on the text and the list of entities, identify relationships between them.

Entities found:
${entityList}

Text:
---
${truncated}
---`,
      },
    ],
    temperature: 0.1,
    maxTokens: 3000,
    model: "bzl/auto:free",
  }, providerConfig());

  return result.relationships || [];
}

// ============================================================
// Timeline Extraction Agent (§ 40)
// ============================================================

export async function extractTimelineEvents(
  text: string,
  knownEntityNames: string[] = []
): Promise<ExtractedTimelineEvent[]> {
  if (!text || text.trim().length < 50) return [];

  const cleaned = text
    .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, "")
    .replace(/\u0000/g, "")
    .trim();
  const truncated = cleaned.slice(0, 8000);

  const result = await chatCompletionJson<{ events: ExtractedTimelineEvent[] }>({
    messages: [
      { role: "system", content: PROMPTS.timelineExtraction.system },
      {
        role: "user",
        content: `Extract chronological events from the following text.
${knownEntityNames.length > 0 ? `\nKnown entities (use these exact names when applicable): ${knownEntityNames.join(", ")}` : ""}

Text:
---
${truncated}
---`,
      },
    ],
    temperature: 0.1,
    maxTokens: 3000,
    model: "bzl/auto:free",
  }, providerConfig());

  return result.events || [];
}

// ============================================================
// Research Planning Agent (§ 31)
// ============================================================

export interface ResearchPlan {
  researchQuestions: string[];
  keywords: string[];
  priorityTopics: string[];
  suggestedSources: string[];
  hypotheses: string[];
  estimatedDuration: number;
  estimatedCost: number;
}

export async function generateResearchPlan(
  goal: string,
  context?: string
): Promise<ResearchPlan> {
  const result = await chatCompletionJson<ResearchPlan>({
    messages: [
      { role: "system", content: PROMPTS.researchPlanning.system },
      {
        role: "user",
        content: `Research goal: ${goal}
${context ? `\nAdditional context: ${context}` : ""}

Generate a comprehensive research plan in JSON.`,
      },
    ],
    temperature: 0.4,
    maxTokens: 1500,
  }, providerConfig());

  return {
    researchQuestions: result.researchQuestions || [],
    keywords: result.keywords || [],
    priorityTopics: result.priorityTopics || [],
    suggestedSources: result.suggestedSources || [],
    hypotheses: result.hypotheses || [],
    estimatedDuration: result.estimatedDuration || 4,
    estimatedCost: result.estimatedCost || 0,
  };
}

// ============================================================
// Report Generation Agent (§ 42)
// ============================================================

export interface ReportContext {
  workspaceName: string;
  researchGoal: string;
  entities: { name: string; type: string; description: string | null }[];
  relationships: {
    source: string;
    target: string;
    type: string;
    confidence: number;
  }[];
  claims: { statement: string; confidence: number; status: string }[];
  evidence: { excerpt: string; sourceTitle: string }[];
  timelineEvents: { title: string; description: string | null; eventDate: string | null }[];
  sources: { title: string; type: string }[];
  relevantChunks?: { content: string; sourceTitle: string; score: number }[];
}

export async function generateReport(
  type: string,
  context: ReportContext
): Promise<string> {
  const entitiesText = context.entities
    .slice(0, 20)
    .map((e) => `- ${e.name} (${e.type}): ${e.description || "بدون توضیحات"}`)
    .join("\n");

  const relsText = context.relationships
    .slice(0, 20)
    .map(
      (r) => `- ${r.source} → [${r.type}] → ${r.target} (اطمینان: ${Math.round(r.confidence * 100)}%)`
    )
    .join("\n");

  const claimsText = context.claims
    .slice(0, 20)
    .map(
      (c) =>
        `- [${c.status}] ${c.statement} (اطمینان: ${Math.round(c.confidence * 100)}%)`
    )
    .join("\n");

  const evidenceText = context.evidence
    .slice(0, 15)
    .map((e, i) => `[E:${i + 1}] ${e.excerpt} — از: ${e.sourceTitle}`)
    .join("\n");

  const timelineText = context.timelineEvents
    .slice(0, 15)
    .map(
      (t) =>
        `- ${t.eventDate ? new Date(t.eventDate).toLocaleDateString("fa-IR") : "بدون تاریخ"}: ${t.title}${t.description ? " — " + t.description : ""}`
    )
    .join("\n");

  const sourcesText = context.sources
    .map((s) => `- ${s.title} (${s.type})`)
    .join("\n");

  const chunksText = context.relevantChunks
    ?.slice(0, 5)
    .map(
      (ch, i) =>
        `[متن منبع ${i + 1}] (سند: "${ch.sourceTitle}", شباهت: ${Math.round(ch.score * 100)}%)\n${ch.content.slice(0, 1500)}`
    )
    .join("\n\n") || "";

  const report = await chatCompletion({
    messages: [
      { role: "system", content: getReportPrompt(type) },
      {
        role: "user",
        content: `Generate a ${type.replace(/_/g, " ")} report in Persian Markdown for the following research workspace.

Research goal: ${context.researchGoal || "تعیین نشده"}

ENTITIES:
${entitiesText || "موجودیتی ثبت نشده است."}

RELATIONSHIPS:
${relsText || "رابطه‌ای ثبت نشده است."}

CLAIMS:
${claimsText || "ادعایی ثبت نشده است."}

EVIDENCE:
${evidenceText || "شواهدی ثبت نشده است."}

SOURCE TEXTS (بخش‌هایی از اسناد):
${chunksText || "متن مبدأی در دسترس نیست."}

TIMELINE EVENTS:
${timelineText || "رویدادی ثبت نشده است."}

SOURCES:
${sourcesText || "منبعی ثبت نشده است."}

Generate the full report now.`,
      },
    ],
    temperature: 0.5,
    maxTokens: 3500,
  }, providerConfig());

  return report;
}

// ============================================================
// Chat Agent (§ 44) — Answer using knowledge base
// ============================================================

export interface ChatContext {
  workspaceName: string;
  researchGoal: string;
  relevantClaims: { id: string; statement: string; confidence: number; excerpt: string; sourceTitle: string }[];
  relevantEntities: { id: string; name: string; type: string; description: string | null }[];
  relevantRelationships: { source: string; target: string; type: string }[];
  timelineEvents: { title: string; eventDate: string | null; description: string | null }[];
  conversationHistory: { role: string; content: string }[];
  relevantChunks?: { content: string; sourceTitle: string; score: number }[];
}

export async function answerWithKnowledgeBase(
  question: string,
  context: ChatContext
): Promise<string> {
  const claimsText = context.relevantClaims
    .map(
      (c, i) =>
        `[E:${i + 1}] (id=${c.id}, confidence=${Math.round(c.confidence * 100)}%) ${c.statement}
   شاهد: "${c.excerpt}" — از: ${c.sourceTitle}`
    )
    .join("\n");

  const chunksText = context.relevantChunks
    ?.map(
      (ch, i) =>
        `[متن منبع ${i + 1}] (سند: "${ch.sourceTitle}", شباهت: ${Math.round(ch.score * 100)}%)\n${ch.content.slice(0, 1000)}`
    )
    .join("\n\n") || "";

  const entitiesText = context.relevantEntities
    .map((e) => `- ${e.name} (${e.type}): ${e.description || ""}`)
    .join("\n");

  const relsText = context.relevantRelationships
    .map((r) => `- ${r.source} → [${r.type}] → ${r.target}`)
    .join("\n");

  const timelineText = context.timelineEvents
    .map(
      (t) =>
        `- ${t.eventDate ? new Date(t.eventDate).toLocaleDateString("fa-IR") : "تاریخ نامشخص"}: ${t.title}${t.description ? " — " + t.description : ""}`
    )
    .join("\n");

  const historyText = context.conversationHistory
    .slice(-6)
    .map((m) => `${m.role === "user" ? "کاربر" : "دستیار"}: ${m.content}`)
    .join("\n");

  const answer = await chatCompletion({
    messages: [
      { role: "system", content: PROMPTS.chat.system },
      {
        role: "user",
        content: `You are answering questions about the research workspace: "${context.workspaceName}".
Research goal: ${context.researchGoal || "تعیین نشده"}

=== KNOWLEDGE BASE CONTEXT ===

CLAIMS AND EVIDENCE:
${claimsText || "ادعایی در دسترس نیست."}

SOURCE TEXTS (بخش‌هایی از اسناد):
${chunksText || "متن مبدأی در دسترس نیست."}

ENTITIES:
${entitiesText || "موجودیتی در دسترس نیست."}

RELATIONSHIPS:
${relsText || "رابطه‌ای در دسترس نیست."}

TIMELINE EVENTS:
${timelineText || "رویدادی در دسترس نیست."}

=== CONVERSATION HISTORY ===
${historyText || "تاریخچه‌ای وجود ندارد."}

=== USER QUESTION ===
${question}

Answer the question using ONLY the knowledge base context above. If the context is insufficient, say so explicitly.`,
      },
    ],
    temperature: 0.3,
    maxTokens: 2000,
  }, providerConfig());

  return answer;
}

/**
 * Select the right system prompt based on report type.
 */
function getReportPrompt(type: string): string {
  switch (type) {
    case "company_report":
      return PROMPTS.reportCompany.system;
    case "person_report":
      return PROMPTS.reportPerson.system;
    case "organization_report":
      return PROMPTS.reportOrganization.system;
    case "investment_report":
      return PROMPTS.reportInvestment.system;
    case "market_report":
      return PROMPTS.reportMarket.system;
    case "research_summary":
      return PROMPTS.reportResearch.system;
    default:
      return PROMPTS.reportExecutive.system;
  }
}

// ============================================================
// Opportunity Analysis (Module 19)
// ============================================================

export interface OpportunityContext {
  workspaceName: string;
  researchGoal: string;
  entities: { name: string; type: string; description: string | null }[];
  relationships: { source: string; target: string; type: string; confidence: number }[];
  claims: { statement: string; confidence: number; status: string }[];
  evidence: { excerpt: string; sourceTitle: string }[];
  timelineEvents: { title: string; description: string | null; eventDate: string | null }[];
  sources: { title: string; type: string }[];
  relevantChunks?: { content: string; sourceTitle: string; score: number }[];
}

/**
 * Generate an opportunity analysis based on workspace knowledge.
 */
export async function generateOpportunityAnalysis(
  type: string,
  context: OpportunityContext
): Promise<string> {
  const entitiesText = context.entities
    .slice(0, 20)
    .map((e) => `- ${e.name} (${e.type}): ${e.description || "بدون توضیحات"}`)
    .join("\n");

  const relsText = context.relationships
    .slice(0, 20)
    .map(
      (r) =>
        `- ${r.source} → [${r.type}] → ${r.target} (اطمینان: ${Math.round(r.confidence * 100)}%)`
    )
    .join("\n");

  const claimsText = context.claims
    .slice(0, 20)
    .map(
      (c) =>
        `- [${c.status}] ${c.statement} (اطمینان: ${Math.round(c.confidence * 100)}%)`
    )
    .join("\n");

  const evidenceText = context.evidence
    .slice(0, 15)
    .map((e, i) => `[E:${i + 1}] ${e.excerpt} — از: ${e.sourceTitle}`)
    .join("\n");

  const timelineText = context.timelineEvents
    .slice(0, 15)
    .map(
      (t) =>
        `- ${t.eventDate ? new Date(t.eventDate).toLocaleDateString("fa-IR") : "بدون تاریخ"}: ${t.title}${t.description ? " — " + t.description : ""}`
    )
    .join("\n");

  const sourcesText = context.sources
    .map((s) => `- ${s.title} (${s.type})`)
    .join("\n");

  const chunksText = context.relevantChunks
    ?.slice(0, 5)
    .map(
      (ch, i) =>
        `[متن منبع ${i + 1}] (سند: "${ch.sourceTitle}", شباهت: ${Math.round(ch.score * 100)}%)\n${ch.content.slice(0, 1500)}`
    )
    .join("\n\n") || "";

  const analysis = await chatCompletion({
    messages: [
      { role: "system", content: PROMPTS.opportunityAnalysis.system },
      {
        role: "user",
        content: `Generate a ${type.replace(/_/g, " ")} opportunity analysis in Persian Markdown for the following workspace.

Workspace: ${context.workspaceName}
Research goal: ${context.researchGoal || "تعیین نشده"}

ENTITIES:
${entitiesText || "موجودیتی ثبت نشده است."}

RELATIONSHIPS:
${relsText || "رابطه‌ای ثبت نشده است."}

CLAIMS:
${claimsText || "ادعایی ثبت نشده است."}

EVIDENCE:
${evidenceText || "شواهدی ثبت نشده است."}

SOURCE TEXTS (بخش‌هایی از اسناد):
${chunksText || "متن مبدأی در دسترس نیست."}

TIMELINE EVENTS:
${timelineText || "رویدادی ثبت نشده است."}

SOURCES:
${sourcesText || "منبعی ثبت نشده است."}

Generate the analysis now based on type: ${type}.`,
      },
    ],
    temperature: 0.5,
    maxTokens: 4000,
  }, providerConfig());

  return analysis;
}
