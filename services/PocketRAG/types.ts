/**
 * PocketRAG Types — Phase 11
 *
 * WHY THESE TYPES?
 * KnowledgeEntry = one row in our first_aid_knowledge.json
 * ChatMessage    = one message bubble in the chat UI
 * RAGResponse    = what PocketRAGService returns to the UI
 */

export interface KnowledgeEntry {
  id: string;
  category: string;
  keywords: string[];
  question: string;
  answer: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  isOffline: boolean;
}

export interface RAGResponse {
  answer: string;
  isOffline: boolean;
  confidence: number; // 0 to 1 — how well the query matched the knowledge base
  matchedCategory: string;
}

export interface ScoredEntry {
  entry: KnowledgeEntry;
  score: number;
}

// Pre-written questions shown as suggestion chips in the chat UI
export const SUGGESTED_QUESTIONS = [
  'How do I perform CPR?',
  'Can I move someone with a neck injury?',
  'How do I stop severe bleeding?',
  'What do I do for burns?',
  'Am I legally protected for helping?',
  'There are multiple injured people. Who do I help first?',
] as const;