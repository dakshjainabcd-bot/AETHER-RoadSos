/**
 * PocketRAGService — Online + Offline First-Aid AI
 *
 * FLOW:
 * 1. User asks a question
 * 2. OfflineRAG finds top 3 relevant knowledge entries
 * 3. If ONLINE: build prompt with those entries as context → call Gemini → return answer
 * 4. If OFFLINE: return the top matching entry's answer directly
 *
 * WHY SEND KNOWLEDGE ENTRIES TO GEMINI (not just the raw question)?
 * This is the "RAG" (Retrieval-Augmented Generation) technique.
 * Instead of asking Gemini to answer from memory (which may be wrong),
 * we GIVE it the correct answer and ask it to rephrase it more naturally.
 * The result is accurate (from our verified knowledge base) AND readable.
 */

import NetInfo from '@react-native-community/netinfo';
import { findTopMatches } from './OfflineRAG';
import { RAGResponse, KnowledgeEntry } from './types';
import { GEMINI_API_KEY, GEMINI_STT_MODEL } from '../../utils/constants';

// Gemini API endpoint — text-only generation (no image)
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_STT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Timeout for Gemini API call (4 seconds — fast enough for emergency use)
const API_TIMEOUT_MS = 4000;

/**
 * Build a RAG prompt for Gemini.
 * The context (knowledge entries) is injected so Gemini answers from them,
 * not from general internet knowledge (which may be unreliable for first aid).
 */
function buildPrompt(query: string, entries: KnowledgeEntry[]): string {
  const contextLines = entries
    .filter((e) => e !== undefined)
    .map((e, i) => `ENTRY ${i + 1}:\nQ: ${e.question}\nA: ${e.answer}`)
    .join('\n\n');

  return `You are an emergency first-aid AI for road accident bystanders in India.
Answer ONLY using the provided context entries below.
Keep your answer under 100 words.
Be direct and actionable — this is an emergency.
End your answer with: "When in doubt, call 108 immediately."

CONTEXT:
${contextLines}

QUESTION: ${query}

ANSWER:`;
}

/**
 * Check if the device has internet connectivity.
 */
async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return !!(state.isConnected && state.isInternetReachable);
  } catch {
    return false;
  }
}

/**
 * Call the Gemini API with a RAG prompt.
 * Returns the generated answer, or null if the call fails.
 */
async function callGemini(prompt: string): Promise<string | null> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('YOUR_')) {
    console.log('[PocketRAG] Gemini API key not configured — using offline mode');
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,   // Low temperature = consistent, safe medical advice
          maxOutputTokens: 200,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn('[PocketRAG] Gemini API error:', response.status);
      return null;
    }

    const data = await response.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return text.trim() || null;
  } catch (error) {
    clearTimeout(timeout);
    if ((error as Error).name === 'AbortError') {
      console.warn('[PocketRAG] Gemini API timed out — using offline fallback');
    } else {
      console.warn('[PocketRAG] Gemini API error:', error);
    }
    return null;
  }
}

/**
 * Answer a first-aid question using the hybrid RAG approach.
 *
 * @param query  The user's question in any language
 * @returns      RAGResponse with the answer and metadata
 */
export async function answerQuestion(query: string): Promise<RAGResponse> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return {
      answer: 'Please type your first-aid question.',
      isOffline: true,
      confidence: 0,
      matchedCategory: 'general',
    };
  }

  // Step 1: Find top 3 matching knowledge entries (always runs offline, very fast)
  const topMatches = findTopMatches(trimmedQuery, 3);
  const bestMatch = topMatches[0];

  // Step 2: If no match at all, return a safe fallback
  if (!bestMatch || bestMatch.score === 0) {
    return {
      answer:
        'I do not have specific information about that situation. ' +
        'Call 108 immediately. Stay with the victim and keep them calm until help arrives.',
      isOffline: true,
      confidence: 0,
      matchedCategory: 'general',
    };
  }

  // Calculate normalized confidence (score relative to maximum possible)
  const maxScore = topMatches[0].score;
  const confidence = Math.min(maxScore / 5, 1.0);

  // Step 3: Try online Gemini if connected
  const online = await isOnline();
  if (online && GEMINI_API_KEY && !GEMINI_API_KEY.startsWith('YOUR_')) {
    const validEntries = topMatches
      .filter((m) => m.score > 0)
      .map((m) => m.entry);

    const prompt = buildPrompt(trimmedQuery, validEntries);
    const geminiAnswer = await callGemini(prompt);

    if (geminiAnswer) {
      return {
        answer: geminiAnswer,
        isOffline: false,
        confidence,
        matchedCategory: bestMatch.entry.category,
      };
    }
  }

  // Step 4: Offline fallback — return the best matching entry's answer
  return {
    answer: bestMatch.entry.answer + '\n\nWhen in doubt, call 108 immediately.',
    isOffline: true,
    confidence,
    matchedCategory: bestMatch.entry.category,
  };
}