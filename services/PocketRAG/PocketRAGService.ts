/**
 * PocketRAGService — Online + Offline First-Aid AI
 *
 * FIXES IN THIS VERSION:
 *
 * Fix 1 — isInternetReachable null bug:
 *   NetInfo.isInternetReachable returns null (not false) while the OS
 *   is still checking. Treating null as "offline" means Gemini was NEVER
 *   called even on WiFi. Fix: treat null as "possibly online" by checking
 *   isInternetReachable !== false instead of !!isInternetReachable.
 *
 * Fix 2 — Timeout too short:
 *   4 seconds is not enough for Gemini on mobile networks. Increased to
 *   15 seconds — still fast enough for emergencies, reliable on 3G+.
 *
 * Fix 3 — Fallback connectivity check:
 *   If NetInfo still returns null, we do a lightweight HEAD request to
 *   Google's generate endpoint to confirm reachability before giving up.
 *
 * FLOW:
 * 1. User asks a question
 * 2. OfflineRAG finds top 3 relevant knowledge entries (always fast, offline)
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

// FIX 2: Increased from 4000ms to 15000ms.
// Gemini cold-start on a phone network can take 5–8 seconds.
// 4s was causing silent timeouts even when internet was perfectly fine.
const API_TIMEOUT_MS = 15000;

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
 * FIX 1: Check internet connectivity correctly.
 *
 * THE BUG THAT CAUSED ALWAYS-OFFLINE:
 *   NetInfo.isInternetReachable returns THREE values:
 *     true  → confirmed internet access
 *     false → confirmed NO internet access
 *     null  → OS hasn't finished checking yet (unknown)
 *
 *   The old code did:  return !!(state.isConnected && state.isInternetReachable)
 *   When null:         return !!(true && null) = !!(null) = false  ← WRONG
 *
 *   The fix:           return !!(state.isConnected && state.isInternetReachable !== false)
 *   When null:         return !!(true && true) = true  ← Correct: treat unknown as possibly online
 *
 * We also do a real HTTP ping as a secondary check when NetInfo is inconclusive,
 * because on some Android devices isInternetReachable stays null indefinitely.
 */
async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();

    // Definitely no connection
    if (!state.isConnected) {
      console.log('[PocketRAG] isOnline: no connection');
      return false;
    }

    // Definitely has internet
    if (state.isInternetReachable === true) {
      console.log('[PocketRAG] isOnline: confirmed reachable');
      return true;
    }

    // isInternetReachable is null or false
    // FIX: Do a real lightweight check instead of giving up
    // We use a HEAD request to the Gemini base URL with a 3s timeout
    if (state.isConnected && state.isInternetReachable !== false) {
      console.log('[PocketRAG] isOnline: isInternetReachable=null, doing HTTP ping...');
      try {
        const pingController = new AbortController();
        const pingTimeout = setTimeout(() => pingController.abort(), 3000);
        const pingResponse = await fetch(
          'https://generativelanguage.googleapis.com/',
          { method: 'HEAD', signal: pingController.signal }
        );
        clearTimeout(pingTimeout);
        console.log('[PocketRAG] isOnline: HTTP ping returned', pingResponse.status);
        // Any HTTP response (even 404) means the network is reachable
        return true;
      } catch {
        console.log('[PocketRAG] isOnline: HTTP ping failed — truly offline');
        return false;
      }
    }

    console.log('[PocketRAG] isOnline: isInternetReachable=false');
    return false;
  } catch (err) {
    console.warn('[PocketRAG] isOnline check error:', err);
    return false;
  }
}

/**
 * Call the Gemini API with a RAG prompt.
 * Returns the generated answer, or null if the call fails.
 */
async function callGemini(prompt: string): Promise<string | null> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('YOUR_')) {
    console.warn('[PocketRAG] Gemini API key not configured in utils/constants.ts');
    return null;
  }

  const controller = new AbortController();
  // FIX 2: Use the increased timeout
  const timeout = setTimeout(() => {
    console.warn('[PocketRAG] Gemini request aborted after', API_TIMEOUT_MS / 1000, 's timeout');
    controller.abort();
  }, API_TIMEOUT_MS);

  try {
    console.log('[PocketRAG] Calling Gemini API...');

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
      const errText = await response.text().catch(() => '');
      console.warn('[PocketRAG] Gemini API HTTP error:', response.status, errText.slice(0, 100));
      return null;
    }

    const data = await response.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    console.log('[PocketRAG] Gemini responded successfully');
    return text.trim() || null;
  } catch (error) {
    clearTimeout(timeout);
    const errName = (error as Error).name;
    if (errName === 'AbortError') {
      console.warn('[PocketRAG] Gemini API timed out — using offline fallback');
    } else {
      console.warn('[PocketRAG] Gemini API network error:', error);
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

  // Step 3: Check API key before even testing connectivity
  const hasApiKey = !!(GEMINI_API_KEY && !GEMINI_API_KEY.startsWith('YOUR_'));

  if (!hasApiKey) {
    console.log('[PocketRAG] No Gemini API key — using offline mode');
  } else {
    // Step 4: FIX 1 — use the corrected isOnline() that handles null
    const online = await isOnline();
    console.log('[PocketRAG] Online status:', online);

    if (online) {
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

      console.log('[PocketRAG] Gemini returned null — falling back to offline answer');
    } else {
      console.log('[PocketRAG] Device is offline — using knowledge base directly');
    }
  }

  // Step 5: Offline fallback — return the best matching entry's answer
  return {
    answer: bestMatch.entry.answer + '\n\nWhen in doubt, call 108 immediately.',
    isOffline: true,
    confidence,
    matchedCategory: bestMatch.entry.category,
  };
}