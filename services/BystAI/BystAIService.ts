/**
 * BystAI Vision Service — Powered by Google Gemini 1.5 Flash
 *
 * Replaces the Anthropic Claude Vision API with Gemini.
 * Same capability: multimodal image + text → injury analysis JSON.
 *
 * WHY GEMINI INSTEAD OF ANTHROPIC?
 * - You already have a Gemini key set up (used for STT)
 * - One API key for both STT and Vision = simpler
 * - Free tier: 15 requests/min, 1M tokens/day
 * - Gemini 1.5 Flash is fast and accurate for medical triage
 */

import { GEMINI_API_KEY, GEMINI_STT_MODEL } from '../../utils/constants';

// Reuse the same model for vision (Flash supports multimodal)
const GEMINI_VISION_MODEL = GEMINI_STT_MODEL; // 'gemini-1.5-flash'
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

export interface InjuryAnalysis {
  injury_type: string;         // e.g. "head_trauma", "fracture", "burns", "cardiac"
  severity_1_to_5: number;     // 1 = minor, 5 = critical
  first_aid_steps: string[];   // Step-by-step instructions
  do_not_do: string[];         // Things bystander must avoid
  call_ambulance: boolean;     // Always true for severity >= 3
}

/**
 * Analyse an accident victim photo using Gemini Vision API.
 *
 * @param base64Image - Base64-encoded image string (no data: prefix)
 * @param mimeType    - 'image/jpeg' | 'image/png' | 'image/webp'
 * @returns Structured injury analysis, or null if offline / API fails
 */
export async function analyseInjuryPhoto(
  base64Image: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
): Promise<InjuryAnalysis | null> {
  const prompt = `You are an emergency medical triage AI. Analyse this accident victim photo.
Return ONLY valid JSON (no markdown, no backticks) in this exact format:
{
  "injury_type": "one of: head_trauma | fracture | burns | cardiac | spinal | bleeding | unconscious | unknown",
  "severity_1_to_5": <number 1-5>,
  "first_aid_steps": ["step 1", "step 2", "step 3"],
  "do_not_do": ["do not move if spinal injury", ...],
  "call_ambulance": true
}
Be concise. Steps must be actionable for an untrained bystander.`;

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Image,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,      // Low temperature = consistent medical advice
          maxOutputTokens: 512,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[BystAI] Gemini API error:', response.status, err);
      return null;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!text) {
      console.error('[BystAI] Empty response from Gemini');
      return null;
    }

    // Parse JSON — Gemini Flash reliably returns clean JSON with temperature 0.1
    const analysis = JSON.parse(text.trim()) as InjuryAnalysis;
    console.log('[BystAI] Analysis:', analysis.injury_type, 'severity:', analysis.severity_1_to_5);
    return analysis;

  } catch (error) {
    console.error('[BystAI] Vision analysis failed:', error);
    return null; // Caller falls back to offline decision tree
  }
}

/**
 * Offline fallback — decision tree when no internet available.
 * Bystander answers 5 yes/no questions to determine injury type.
 *
 * @param answers - Array of 5 booleans: [bleeding, conscious, breathing, spinalRisk, burns]
 */
export function offlineInjuryTriage(answers: {
  isVisibleBleeding: boolean;
  isConscious: boolean;
  isBreathing: boolean;
  isSpinalRisk: boolean;
  hasBurns: boolean;
}): InjuryAnalysis {
  const { isVisibleBleeding, isConscious, isBreathing, isSpinalRisk, hasBurns } = answers;

  if (!isBreathing) {
    return {
      injury_type: 'cardiac',
      severity_1_to_5: 5,
      first_aid_steps: [
        'Call 108 immediately',
        'Place victim flat on their back on a hard surface',
        'Place heel of hand on centre of chest',
        'Push hard and fast — 2 compressions per second',
        'Continue until ambulance arrives',
      ],
      do_not_do: ['Do not stop CPR until ambulance takes over'],
      call_ambulance: true,
    };
  }

  if (!isConscious) {
    return {
      injury_type: 'head_trauma',
      severity_1_to_5: 4,
      first_aid_steps: [
        'Call 108 immediately',
        'Do NOT move the victim',
        'Keep airway open — tilt head back gently if no spinal risk',
        'Monitor breathing continuously',
      ],
      do_not_do: ['Do not move the head or neck', 'Do not give water or food'],
      call_ambulance: true,
    };
  }

  if (hasBurns) {
    return {
      injury_type: 'burns',
      severity_1_to_5: 3,
      first_aid_steps: [
        'Cool the burn with running water for 10 minutes',
        'Do NOT use ice, butter, or toothpaste',
        'Cover loosely with clean cloth',
        'Call 108',
      ],
      do_not_do: ['Do not apply ice', 'Do not pop blisters', 'Do not remove stuck clothing'],
      call_ambulance: true,
    };
  }

  if (isSpinalRisk) {
    return {
      injury_type: 'spinal',
      severity_1_to_5: 4,
      first_aid_steps: [
        'Call 108 immediately',
        'Do NOT move the victim under any circumstances',
        'Keep victim still and calm',
        'Support head and neck in current position',
      ],
      do_not_do: ['Do not move the victim', 'Do not bend or twist the spine'],
      call_ambulance: true,
    };
  }

  if (isVisibleBleeding) {
    return {
      injury_type: 'bleeding',
      severity_1_to_5: 3,
      first_aid_steps: [
        'Apply firm pressure with a clean cloth',
        'Do not remove the cloth — add more on top if soaked',
        'Elevate the bleeding limb above heart level if possible',
        'Call 108',
      ],
      do_not_do: ['Do not remove the first cloth', 'Do not apply a tourniquet unless trained'],
      call_ambulance: true,
    };
  }

  // Default — minor injury
  return {
    injury_type: 'unknown',
    severity_1_to_5: 2,
    first_aid_steps: [
      'Keep victim calm and still',
      'Check for any hidden bleeding',
      'Call 108 if any doubt',
      'Monitor until ambulance arrives',
    ],
    do_not_do: ['Do not leave the victim alone'],
    call_ambulance: false,
  };
}