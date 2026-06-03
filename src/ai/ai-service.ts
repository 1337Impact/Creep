import {
  buildInlineQuestionPrompt,
  buildPageContentPrompt,
  buildSelectedTextPrompt,
  INLINE_SYSTEM_INSTRUCTION,
  SYSTEM_INSTRUCTION,
} from "./prompts";
import { resolveProviderForModel } from "./providers/factory";
import {
  DEFAULT_MODEL,
  DEFAULT_TRANSCRIPTION_MODEL,
} from "./models";
import type {
  ContentPart,
  InlineQuestionOptions,
  Message,
  PromptResult,
  StreamChatOptions,
  ToolConfig,
} from "./types";

export class AiService {
  prepareChatPrompt(
    message: string,
    selectedText?: string,
    pageContent?: string
  ): PromptResult {
    let fullPrompt = message;
    let displayText = message;

    if (selectedText) {
      const built = buildSelectedTextPrompt(message, selectedText);
      fullPrompt = built.fullPrompt;
      displayText = built.displayText;
    }

    if (pageContent) {
      fullPrompt = buildPageContentPrompt(fullPrompt, pageContent);
    }

    return { fullPrompt, displayText };
  }

  async *streamChat(options: StreamChatOptions): AsyncGenerator<string, void, unknown> {
    const { fullPrompt } = this.prepareChatPrompt(
      options.message,
      options.selectedText,
      options.pageContent
    );

    const userContent: ContentPart[] = [{ type: "text", text: fullPrompt }];

    if (options.screenshot) {
      userContent.push({
        type: "image",
        data: options.screenshot,
        mimeType: "image/png",
      });
    }

    if (options.audio) {
      userContent.push({
        type: "audio",
        data: options.audio,
        mimeType: "audio/wav",
      });
    }

    const messages: Message[] = [
      ...options.history,
      { role: "user", content: userContent },
    ];

    const tools: ToolConfig[] | undefined = options.enableSearch
      ? [{ type: "web_search" }]
      : undefined;

    const provider = resolveProviderForModel(options.modelId);

    yield* provider.stream({
      model: options.modelId,
      system: SYSTEM_INSTRUCTION,
      messages,
      tools,
    });
  }

  async sendInlineQuestion(
    selectedText: string,
    question: string,
    options?: InlineQuestionOptions
  ): Promise<string> {
    const modelId = options?.modelId ?? DEFAULT_MODEL.id;
    const prompt = buildInlineQuestionPrompt(selectedText, question);
    const provider = resolveProviderForModel(modelId);

    return provider.generate({
      model: modelId,
      system: INLINE_SYSTEM_INSTRUCTION,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      tools: options?.enableSearch ? [{ type: "web_search" }] : undefined,
    });
  }

  async transcribeAudio(
    audioBase64: string,
    modelId: string = DEFAULT_TRANSCRIPTION_MODEL
  ): Promise<string> {
    const provider = resolveProviderForModel(modelId);

    return provider.generate({
      model: modelId,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe the following audio exactly." },
            { type: "audio", data: audioBase64, mimeType: "audio/wav" },
          ],
        },
      ],
    });
  }
}

export const aiService = new AiService();
