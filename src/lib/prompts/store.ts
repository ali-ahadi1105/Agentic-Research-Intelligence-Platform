/**
 * Prompt Store (per PROJECT.md § 48, 69)
 *
 * Versioned prompt templates stored in database.
 * Supports: versioning, variables, templates, rollback.
 *
 * Seeds default prompts on first use.
 */
import "server-only";
import { db } from "../db";
import { PROMPTS } from "./templates";

export interface PromptTemplateData {
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
  createdAt: Date;
  updatedAt: Date;
}

const PROMPT_SEEDS: Array<{
  key: string;
  name: string;
  description: string;
  systemPrompt: string;
  variables: string[];
}> = [
  {
    key: "entity_extraction",
    name: "استخراج موجودیت‌ها",
    description: "استخراج موجودیت‌ها (اشخاص، شرکت‌ها، سازمان‌ها) از متن",
    systemPrompt: PROMPTS.entityExtraction.system,
    variables: ["text"],
  },
  {
    key: "claim_extraction",
    name: "استخراج ادعاها",
    description: "استخراج ادعاها و گزاره‌های قابل اعتبارسنجی از متن",
    systemPrompt: PROMPTS.claimExtraction.system,
    variables: ["text", "knownEntityNames"],
  },
  {
    key: "relationship_extraction",
    name: "استخراج روابط",
    description: "استخراج روابط بین موجودیت‌ها",
    systemPrompt: PROMPTS.relationshipExtraction.system,
    variables: ["text", "entities"],
  },
  {
    key: "timeline_extraction",
    name: "استخراج رویدادهای زمانی",
    description: "استخراج رویدادهای دارای تاریخ از متن",
    systemPrompt: PROMPTS.timelineExtraction.system,
    variables: ["text", "knownEntityNames"],
  },
  {
    key: "chat",
    name: "گفتگوی هوشمند",
    description: "پاسخ به سؤالات کاربر بر اساس دانش‌نامه",
    systemPrompt: PROMPTS.chat.system,
    variables: ["question", "context"],
  },
  {
    key: "report_executive",
    name: "گزارش اجرایی",
    description: "تولید گزارش خلاصه اجرایی",
    systemPrompt: PROMPTS.reportExecutive.system,
    variables: ["context"],
  },
  {
    key: "research_planning",
    name: "برنامه پژوهش",
    description: "تولید برنامه پژوهش ساختاریافته",
    systemPrompt: PROMPTS.researchPlanning.system,
    variables: ["goal", "context"],
  },
];

let seeded = false;

/**
 * Seed default prompts to database (runs once).
 */
export async function seedPrompts(): Promise<void> {
  if (seeded) return;
  seeded = true;

  const existingCount = await db.promptTemplate.count();
  if (existingCount > 0) return;

  for (const seed of PROMPT_SEEDS) {
    await db.promptTemplate.create({
      data: {
        key: seed.key,
        version: 1,
        name: seed.name,
        description: seed.description,
        systemPrompt: seed.systemPrompt,
        userTemplate: null,
        variables: JSON.stringify(seed.variables),
        model: "default",
        temperature: 0.3,
        maxTokens: 2000,
        isActive: true,
      },
    });
  }
}

/**
 * List all active prompts (latest version of each).
 */
export async function listPrompts(): Promise<PromptTemplateData[]> {
  await seedPrompts();

  const prompts = await db.promptTemplate.findMany({
    where: { isActive: true },
    orderBy: { key: "asc" },
  });

  return prompts.map(toData);
}

/**
 * List all versions of a prompt.
 */
export async function listPromptVersions(key: string): Promise<PromptTemplateData[]> {
  const prompts = await db.promptTemplate.findMany({
    where: { key },
    orderBy: { version: "desc" },
  });

  return prompts.map(toData);
}

/**
 * Get the active version of a prompt by key.
 */
export async function getPrompt(key: string): Promise<PromptTemplateData | null> {
  await seedPrompts();

  const prompt = await db.promptTemplate.findFirst({
    where: { key, isActive: true },
    orderBy: { version: "desc" },
  });

  return prompt ? toData(prompt) : null;
}

/**
 * Update a prompt — creates a new version and deactivates the previous one.
 */
export async function updatePrompt(
  key: string,
  updates: {
    systemPrompt?: string;
    userTemplate?: string | null;
    description?: string;
    temperature?: number;
    maxTokens?: number;
  },
  createdBy?: string
): Promise<PromptTemplateData> {
  const current = await db.promptTemplate.findFirst({
    where: { key, isActive: true },
    orderBy: { version: "desc" },
  });

  if (!current) {
    throw new Error(`Prompt not found: ${key}`);
  }

  // Deactivate old version
  await db.promptTemplate.update({
    where: { id: current.id },
    data: { isActive: false },
  });

  // Create new version
  const newVersion = await db.promptTemplate.create({
    data: {
      key,
      version: current.version + 1,
      name: current.name,
      description: updates.description ?? current.description,
      systemPrompt: updates.systemPrompt ?? current.systemPrompt,
      userTemplate: updates.userTemplate ?? current.userTemplate,
      variables: current.variables,
      model: current.model,
      temperature: updates.temperature ?? current.temperature,
      maxTokens: updates.maxTokens ?? current.maxTokens,
      isActive: true,
      createdBy,
    },
  });

  return toData(newVersion);
}

/**
 * Rollback to a specific version.
 */
export async function rollbackPrompt(key: string, version: number): Promise<PromptTemplateData> {
  // Deactivate all versions
  await db.promptTemplate.updateMany({
    where: { key },
    data: { isActive: false },
  });

  // Activate the target version
  await db.promptTemplate.update({
    where: { key_version: { key, version } },
    data: { isActive: true },
  });

  const prompt = await db.promptTemplate.findUnique({
    where: { key_version: { key, version } },
  });

  return toData(prompt!);
}

function toData(p: {
  id: string;
  key: string;
  version: number;
  name: string;
  description: string | null;
  systemPrompt: string;
  userTemplate: string | null;
  variables: string;
  model: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PromptTemplateData {
  return {
    ...p,
    variables: JSON.parse(p.variables || "[]"),
  };
}
