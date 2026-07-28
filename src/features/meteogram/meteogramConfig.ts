export function normalizeMeteogramModelId(modelId: string): string {
  return modelId.trim().toUpperCase();
}

/**
 * Returns the deployment ID to use for the meteogram widget config API.
 * The deployment ID is the normalized model ID — whether a model actually
 * has a meteogram configuration is determined by the backend (a 404 from
 * the config endpoint means no config exists for that model).
 */
export function resolveMeteogramClientName(modelId: string): string {
  return normalizeMeteogramModelId(modelId);
}
