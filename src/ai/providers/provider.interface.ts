import type {
  GenerateRequest,
  ProviderCapabilities,
  ProviderId,
  TranscribeAudioInput,
  TranscribeAudioOptions,
} from "../types";

export interface AiProvider {
  readonly id: ProviderId;
  getCapabilities(model: string): ProviderCapabilities;
  generate(request: GenerateRequest): Promise<string>;
  stream(request: GenerateRequest): AsyncGenerator<string, void, unknown>;
  transcribeAudio?(
    audio: TranscribeAudioInput,
    options?: TranscribeAudioOptions
  ): Promise<string>;
}
