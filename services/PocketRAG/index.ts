/**
 * PocketRAG Barrel Export — Phase 11
 */
export { answerQuestion } from './PocketRAGService';
export { findTopMatches, findBestMatch, getKnowledgeBaseSize } from './OfflineRAG';
export type { KnowledgeEntry, ChatMessage, RAGResponse, ScoredEntry } from './types';
export { SUGGESTED_QUESTIONS } from './types';