import type { GenerateRequest, ProviderCapabilities, ProviderId } from "../types";

export interface AiProvider {
  readonly id: ProviderId;
  getCapabilities(model: string): ProviderCapabilities;
  generate(request: GenerateRequest): Promise<string>;
  stream(request: GenerateRequest): AsyncGenerator<string, void, unknown>;
}
