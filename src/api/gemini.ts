import { GoogleGenAI } from '@google/genai';

const API_KEY = 'AIzaSyDJT8T71jeD6f6argJVfpiCsWEDsE_ti0s';
const ai = new GoogleGenAI({ apiKey: API_KEY });

const SYSTEM_INSTRUCTION = `You are a helpful AI browser assistant embedded in a small chat widget overlay on web pages.

IMPORTANT FORMATTING RULES:
- Keep responses concise and scannable - users are browsing, not reading essays
- Use short paragraphs (2-3 sentences max)
- Prefer bullet points over long prose
- AVOID large tables - use simple lists instead
- AVOID long code blocks - show only essential snippets (max 10 lines)
- If code is needed, break it into small chunks with brief explanations
- Use bold for key terms, but sparingly
- When summarizing content, be brief and highlight only the most important points

YOUR CAPABILITIES:
- Help users understand webpage content
- Answer questions about what's on the current page
- Assist with research, writing, and general knowledge
- Analyze screenshots when provided
- Search the web for current information when enabled

Be friendly, direct, and efficient. Users want quick answers, not lengthy explanations.`;

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export async function transcribeAudio(audioBase64: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'models/gemini-1.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: "Transcribe the following audio exactly." },
            {
              inlineData: {
                mimeType: "audio/wav",
                data: audioBase64
              }
            }
          ]
        }
      ]
    });
    
    if (response.text) {
        return response.text;
    }
    // Fallback if text is accessed differently or empty
    return '';
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}

export async function* sendChatMessageStream(
  history: ChatMessage[], 
  newMessage: string, 
  imageBase64?: string,
  model: string = 'models/gemini-2.5-flash',
  useGoogleSearch?: boolean
): AsyncGenerator<string, void, unknown> {
  // Convert history to SDK format
  const contents: any[] = history.map(msg => ({
    role: msg.role,
    parts: msg.parts.map(p => ({ text: p.text }))
  }));

  const newParts: any[] = [{ text: newMessage }];
  
  if (imageBase64) {
    newParts.push({
      inlineData: {
        mimeType: "image/png",
        data: imageBase64
      }
    });
  }

  contents.push({
    role: 'user',
    parts: newParts
  });

  try {
    // Log available models to console for debugging
    // const models = await ai.models.list();
    // console.log("Available models:", models);

    const config: any = {
      systemInstruction: SYSTEM_INSTRUCTION
    };
    
    if (useGoogleSearch) {
      config.tools = [{
        googleSearch: {}
      }];
    }

    const response = await ai.models.generateContentStream({
      model: model,
      contents: contents,
      config
    });

    for await (const chunk of response) {
      const chunkText = chunk.text;
      if (chunkText) {
        yield chunkText;
      }
    }
  } catch (error) {
    console.error('Chat error:', error);
    throw error;
  }
}

export async function sendInlineQuestion(
  selectedText: string,
  question: string,
  useGoogleSearch?: boolean
): Promise<string> {
  const INLINE_SYSTEM_INSTRUCTION = `You are a helpful assistant providing quick answers about selected text on a webpage.
  
  RULES:
  - Keep answers extremely concise (1-2 sentences unless detailed explanation is requested).
  - Focus directly on the question asked about the selection.
  - If translating, provide only the translation.
  - If fact-checking, clearly state if the information is accurate, inaccurate, or unverifiable, with a brief explanation.
  `;

  const prompt = `[SELECTED TEXT]\n"${selectedText}"\n[END SELECTED TEXT]\n\nQuestion: ${question}`;

  try {
     const config: any = {
      systemInstruction: INLINE_SYSTEM_INSTRUCTION
    };
    
    if (useGoogleSearch) {
      config.tools = [{
        googleSearch: {}
      }];
    }

    const response = await ai.models.generateContent({
      model: 'models/gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      config
    });

    return response.text || '';
  } catch (error) {
    console.error('Inline question error:', error);
    throw error;
  }
}
