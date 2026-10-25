/** One message in an AI chat thread (AI Video, AI Thumbnail and AI Image). */
export interface AIChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, unknown> | null;
  inserted_at: string;
}
