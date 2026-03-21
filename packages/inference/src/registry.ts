import fs from "node:fs";
import path from "node:path";
import type { ModelInfo } from "./types";

/** A single quantization/size variant inside a registry model entry */
export interface RegistryVariant {
  variant: string;
  repo: string;
  fileName: string | null;
  /** Download strategy: "file" for single GGUF files, "repo" for entire HuggingFace repos (STT/TTS) */
  downloadMethod: "file" | "repo";
  sizeBytes: number;
  minRamGb: number | null;
  recommendedVramGb: number | null;
}

/** Raw model entry as stored in models.json (with a variants array) */
export interface RegistryModel {
  name: string;
  displayName: string;
  type: "llm" | "stt" | "tts" | "embedding";
  format: "gguf" | "whisper" | "kokoro";
  description: string;
  tags: string[];
  variants: RegistryVariant[];
}

/** Root structure of models.json */
interface RegistryFile {
  version: number;
  models: RegistryModel[];
}

/**
 * Reads and queries the models.json registry.
 *
 * Provides search, resolution, and variant listing for models
 * defined in the curated model index.
 */
export class Registry {
  private models: RegistryModel[] = [];
  private loaded = false;

  /**
   * Load the model registry from a JSON file.
   * @param registryPath - Path to models.json. Defaults to `<project-root>/models.json`.
   */
  async load(registryPath?: string): Promise<void> {
    const filePath =
      registryPath ?? this.findRegistryFile();

    const content = fs.readFileSync(filePath, "utf-8");
    const data: RegistryFile = JSON.parse(content);

    if (!data.models || !Array.isArray(data.models)) {
      throw new Error(
        `Invalid registry file: expected "models" array in ${filePath}`,
      );
    }

    this.models = data.models;
    this.loaded = true;
  }

  /**
   * Walk up from cwd to find models.json (supports monorepo subpackage usage).
   */
  private findRegistryFile(): string {
    let dir = process.cwd();
    const root = path.parse(dir).root;

    while (dir !== root) {
      const candidate = path.join(dir, "models.json");
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      dir = path.dirname(dir);
    }

    throw new Error(
      "Could not find models.json. Provide an explicit path via load(path).",
    );
  }

  /**
   * Ensure the registry has been loaded before querying.
   */
  private ensureLoaded(): void {
    if (!this.loaded) {
      throw new Error("Registry not loaded. Call load() first.");
    }
  }

  /**
   * Convert a registry model + variant into a flat ModelInfo object.
   */
  private toModelInfo(
    model: RegistryModel,
    variant: RegistryVariant,
  ): ModelInfo {
    return {
      name: model.name,
      displayName: model.displayName,
      description: model.description,
      type: model.type,
      format: model.format,
      variant: variant.variant,
      repo: variant.repo,
      fileName: variant.fileName,
      downloadMethod: variant.downloadMethod ?? "file",
      localPath: null,
      sizeBytes: variant.sizeBytes,
      minRamGb: variant.minRamGb,
      recommendedVramGb: variant.recommendedVramGb,
      status: "available",
    };
  }

  /**
   * Resolve a model name to its full registry information.
   *
   * Supports the following formats:
   * - `"qwen2.5:7b"` — matches model name, returns first variant
   * - `"qwen2.5:7b:q4_k_m"` — matches model name + specific variant
   *
   * @param name - Model name or name:variant to resolve
   * @returns Full model info, or null if not found
   */
  async resolve(name: string): Promise<ModelInfo | null> {
    this.ensureLoaded();

    // Try to split off a trailing variant qualifier.
    // Model names can contain colons (e.g. "qwen2.5:7b"), so we need to be
    // careful: check if removing the last segment after ":" matches a model name,
    // and if the removed segment matches a variant.
    let model: RegistryModel | undefined;
    let variantName: string | undefined;

    // First try exact match on full string as model name
    model = this.models.find(
      (m) => m.name.toLowerCase() === name.toLowerCase(),
    );

    if (!model) {
      // Try splitting off the last colon-separated segment as variant
      const lastColonIdx = name.lastIndexOf(":");
      if (lastColonIdx > 0) {
        const baseName = name.substring(0, lastColonIdx);
        const candidate = name.substring(lastColonIdx + 1);

        model = this.models.find(
          (m) => m.name.toLowerCase() === baseName.toLowerCase(),
        );

        if (model) {
          // Verify that the candidate is actually a variant name
          const matchedVariant = model.variants.find(
            (v) => v.variant.toLowerCase() === candidate.toLowerCase(),
          );
          if (matchedVariant) {
            variantName = candidate;
          } else {
            // The candidate isn't a valid variant, so this isn't a name:variant pattern
            model = undefined;
          }
        }
      }
    }

    if (!model) {
      return null;
    }

    // Pick the requested variant, or fall back to the first one
    const variant = variantName
      ? model.variants.find(
          (v) => v.variant.toLowerCase() === variantName!.toLowerCase(),
        )
      : model.variants[0];

    if (!variant) {
      return null;
    }

    return this.toModelInfo(model, variant);
  }

  /**
   * Search models by name or query string.
   *
   * Performs case-insensitive matching against model name, displayName,
   * description, and tags. Optionally filters by model type.
   *
   * @param query - Search query to match against model names and descriptions
   * @param type - Optional filter by model type (llm, stt, tts, embedding)
   * @returns Array of matching model info entries (first variant of each match)
   */
  async search(query: string, type?: string): Promise<ModelInfo[]> {
    this.ensureLoaded();

    const q = query.toLowerCase();

    const filtered = this.models.filter((model) => {
      // Type filter
      if (type && model.type !== type) {
        return false;
      }

      // Text search across multiple fields
      const searchable = [
        model.name,
        model.displayName,
        model.description,
        ...model.tags,
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(q);
    });

    // Return the first variant for each matching model
    return filtered
      .map((model) => {
        const variant = model.variants[0];
        return variant ? this.toModelInfo(model, variant) : null;
      })
      .filter((info): info is ModelInfo => info !== null);
  }

  /**
   * Get all available quantization variants for a model.
   *
   * @param name - Base model name (e.g. "qwen2.5:7b")
   * @returns Array of model info entries for each variant
   */
  async getVariants(name: string): Promise<ModelInfo[]> {
    this.ensureLoaded();

    const model = this.models.find(
      (m) => m.name.toLowerCase() === name.toLowerCase(),
    );

    if (!model) {
      return [];
    }

    return model.variants.map((variant) => this.toModelInfo(model, variant));
  }

  /**
   * Get all models in the registry.
   *
   * @returns Array of all model info entries (first variant of each)
   */
  async listAll(): Promise<ModelInfo[]> {
    this.ensureLoaded();

    return this.models
      .map((model) => {
        const variant = model.variants[0];
        return variant ? this.toModelInfo(model, variant) : null;
      })
      .filter((info): info is ModelInfo => info !== null);
  }
}
