export type LlmProvider = 'claude' | 'openai' | 'gemini';
export interface LlmMessage { role: 'user' | 'assistant'; content: string; }
export interface LlmRequest { messages: LlmMessage[]; provider?: LlmProvider; model?: string; responseFormat?: 'text' | 'json'; }
export interface LlmResponse { content: string; provider: LlmProvider; model: string; }
