import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { AppConfig, ModelCatalogEntry, ModelCatalogSnapshot, NativeChatAccess } from "../types";

const execFileAsync = promisify(execFile);
const NATIVE_CHAT_BASE_PATH = "/__native-chat";

interface OpenClawConfigFile {
  gateway?: {
    port?: number;
    auth?: {
      token?: string;
    };
  };
  models?: {
    mode?: string;
    providers?: Record<string, OpenClawProviderConfig>;
  };
  agents?: {
    defaults?: {
      model?: {
        primary?: string;
        fallbacks?: string[];
      };
    };
  };
}

interface OpenClawProviderConfig {
  baseUrl?: string;
  api?: string;
  models?: OpenClawModelConfig[];
}

interface OpenClawModelConfig {
  id?: string;
  name?: string;
  api?: string;
  reasoning?: boolean;
  contextWindow?: number;
  maxTokens?: number;
  input?: string[];
  cost?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
  compat?: {
    supportsStore?: boolean;
  };
}

interface OpenClawConfigBundle {
  path: string;
  config: OpenClawConfigFile;
}

export interface AddConfiguredModelInput {
  providerKey: string;
  modelId: string;
  name?: string;
  api?: string;
  reasoning?: boolean;
  contextWindow?: number;
  maxTokens?: number;
  setPrimary?: boolean;
}

export async function loadModelCatalog(config: AppConfig): Promise<ModelCatalogSnapshot> {
  const bundle = await loadConfigBundle(config);
  if (!bundle) {
    return {
      connected: false,
      fallbackModels: [],
      providers: [],
      models: [],
      note: "未找到 OpenClaw 配置文件，模型目录暂不可用。",
    };
  }

  return buildModelCatalogSnapshot(bundle);
}

export async function loadNativeChatAccess(config: AppConfig): Promise<NativeChatAccess> {
  const bundle = await loadConfigBundle(config);
  if (!bundle) {
    return {
      enabled: false,
      basePath: NATIVE_CHAT_BASE_PATH,
      framePath: `${NATIVE_CHAT_BASE_PATH}/chat`,
      note: "未找到 OpenClaw 配置文件，原生聊天页暂不可用。",
    };
  }

  const token = bundle.config.gateway?.auth?.token?.trim();
  if (!token) {
    return {
      enabled: false,
      basePath: NATIVE_CHAT_BASE_PATH,
      framePath: `${NATIVE_CHAT_BASE_PATH}/chat`,
      note: "Gateway token 未配置，无法自动接入原生聊天页。",
    };
  }

  return {
    enabled: true,
    basePath: NATIVE_CHAT_BASE_PATH,
    framePath: `${NATIVE_CHAT_BASE_PATH}/chat`,
    gatewayToken: token,
  };
}

export async function setPrimaryModel(config: AppConfig, modelRef: string): Promise<ModelCatalogSnapshot> {
  const bundle = await requireConfigBundle(config);
  const normalizedModel = normalizeText(modelRef);
  if (!normalizedModel) throw new Error("missing_model_ref");

  const snapshot = buildModelCatalogSnapshot(bundle);
  if (!snapshot.models.some((item) => item.id === normalizedModel)) {
    throw new Error("model_not_found");
  }

  const modelConfig = ensureDefaultModelConfig(bundle.config);
  const currentPrimary = normalizeText(modelConfig.primary);
  modelConfig.primary = normalizedModel;
  modelConfig.fallbacks = uniqueStrings(
    [currentPrimary, ...(modelConfig.fallbacks ?? [])].filter((item) => item && item !== normalizedModel),
  );

  await saveConfigBundle(bundle);
  await restartGatewayProcess();
  return loadModelCatalog(config);
}

export async function addConfiguredModel(
  config: AppConfig,
  input: AddConfiguredModelInput,
): Promise<ModelCatalogSnapshot> {
  const bundle = await requireConfigBundle(config);
  const providerKey = normalizeText(input.providerKey);
  const modelId = normalizeText(input.modelId);
  if (!providerKey || !modelId) throw new Error("invalid_model_input");

  const providers = ensureProviders(bundle.config);
  const provider = providers[providerKey];
  if (!provider) throw new Error("provider_not_found");

  const nextModel = buildModelConfig(provider, input, modelId);
  const existingIndex = (provider.models ?? []).findIndex((item) => normalizeText(item.id) === modelId);
  if (!provider.models) provider.models = [];
  if (existingIndex >= 0) provider.models.splice(existingIndex, 1, nextModel);
  else provider.models.push(nextModel);

  if (input.setPrimary) {
    const modelConfig = ensureDefaultModelConfig(bundle.config);
    const currentPrimary = normalizeText(modelConfig.primary);
    modelConfig.primary = modelId;
    modelConfig.fallbacks = uniqueStrings([currentPrimary, ...(modelConfig.fallbacks ?? [])].filter((item) => item && item !== modelId));
  }

  await saveConfigBundle(bundle);
  await restartGatewayProcess();
  return loadModelCatalog(config);
}

function buildModelCatalogSnapshot(bundle: OpenClawConfigBundle): ModelCatalogSnapshot {
  const primaryModel = normalizeText(bundle.config.agents?.defaults?.model?.primary);
  const fallbackModels = uniqueStrings(bundle.config.agents?.defaults?.model?.fallbacks ?? []);
  const providers = Object.entries(bundle.config.models?.providers ?? {});
  const models: ModelCatalogEntry[] = [];

  for (const [providerKey, provider] of providers) {
    for (const model of provider.models ?? []) {
      const id = normalizeText(model.id);
      if (!id) continue;
      models.push({
        providerKey,
        id,
        name: normalizeText(model.name) || id,
        api: normalizeText(model.api) || normalizeText(provider.api),
        reasoning: Boolean(model.reasoning),
        contextWindow: toPositiveNumber(model.contextWindow),
        maxTokens: toPositiveNumber(model.maxTokens),
        isPrimary: primaryModel === id,
        isFallback: fallbackModels.includes(id),
      });
    }
  }

  models.sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
    if (left.isFallback !== right.isFallback) return left.isFallback ? -1 : 1;
    return (
      left.providerKey.localeCompare(right.providerKey, "zh-Hans-CN") ||
      left.id.localeCompare(right.id, "zh-Hans-CN")
    );
  });

  return {
    connected: true,
    configPath: bundle.path,
    primaryModel: primaryModel || undefined,
    fallbackModels,
    providers: providers
      .map(([key, provider]) => ({
        key,
        api: normalizeText(provider.api),
        baseUrl: normalizeText(provider.baseUrl),
        modelCount: provider.models?.length ?? 0,
      }))
      .sort((left, right) => left.key.localeCompare(right.key, "zh-Hans-CN")),
    models,
  };
}

function buildModelConfig(
  provider: OpenClawProviderConfig,
  input: AddConfiguredModelInput,
  modelId: string,
): OpenClawModelConfig {
  return {
    id: modelId,
    name: normalizeText(input.name) || modelId,
    api: normalizeText(input.api) || normalizeText(provider.api) || "openai-completions",
    reasoning: Boolean(input.reasoning),
    input: ["text"],
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: toPositiveNumber(input.contextWindow),
    maxTokens: toPositiveNumber(input.maxTokens) ?? 8192,
    compat: {
      supportsStore: false,
    },
  };
}

async function loadConfigBundle(config: AppConfig): Promise<OpenClawConfigBundle | undefined> {
  const configPath = resolveConfigPath(config);
  if (!configPath) return undefined;
  try {
    const raw = await readFile(configPath, "utf8");
    return {
      path: configPath,
      config: JSON.parse(raw) as OpenClawConfigFile,
    };
  } catch {
    return undefined;
  }
}

async function requireConfigBundle(config: AppConfig): Promise<OpenClawConfigBundle> {
  const bundle = await loadConfigBundle(config);
  if (!bundle) throw new Error("openclaw_config_not_found");
  return bundle;
}

async function saveConfigBundle(bundle: OpenClawConfigBundle): Promise<void> {
  await writeFile(bundle.path, `${JSON.stringify(bundle.config, null, 2)}\n`, "utf8");
}

function resolveConfigPath(config: AppConfig): string | undefined {
  if (!config.openclawHome) return undefined;
  return join(config.openclawHome, "openclaw.json");
}

function ensureProviders(config: OpenClawConfigFile): Record<string, OpenClawProviderConfig> {
  if (!config.models) config.models = {};
  if (!config.models.providers) config.models.providers = {};
  return config.models.providers;
}

function ensureDefaultModelConfig(config: OpenClawConfigFile) {
  if (!config.agents) config.agents = {};
  if (!config.agents.defaults) config.agents.defaults = {};
  if (!config.agents.defaults.model) config.agents.defaults.model = {};
  if (!config.agents.defaults.model.fallbacks) config.agents.defaults.model.fallbacks = [];
  return config.agents.defaults.model;
}

async function restartGatewayProcess(): Promise<void> {
  try {
    const { stdout } = await execFileAsync("pgrep", ["-x", "openclaw-gateway"]);
    const pids = stdout
      .split(/\s+/)
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (pids.length === 0) return;
    for (const pid of pids) process.kill(pid, "SIGUSR1");
    await sleep(1400);
  } catch {
    // Model changes still persist even if the gateway restart signal fails.
  }
}

function normalizeText(value: string | undefined | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function toPositiveNumber(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = normalizeText(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
