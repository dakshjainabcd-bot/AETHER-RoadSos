/**
 * Offline Decision Tree — BystAI Phase 4
 *
 * When Claude Vision API is unavailable (no internet), this decision tree
 * guides the bystander through 5 yes/no questions to identify the injury
 * type and return the correct first-aid protocol.
 *
 * TREE STRUCTURE:
 *   Q1: Unconscious?
 *     YES → Q2: Breathing?
 *       YES → RESULT: recovery_position
 *       NO  → RESULT: cardiac_arrest  (CPR needed)
 *     NO  → Q3: Heavy bleeding?
 *       YES → RESULT: severe_bleeding
 *       NO  → Q4: Neck/spine risk?
 *         YES → RESULT: spinal_injury
 *         NO  → Q5: Burns?
 *           YES → RESULT: burns
 *           NO  → RESULT: general_trauma
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface DecisionQuestion {
  id: string;
  text: string;
  hint: string; // shown in smaller text to help bystander assess
  yesNext: string; // next question id OR result id
  noNext: string;
}

export interface InjuryProtocol {
  id: string;
  injuryType: string;
  severity: 1 | 2 | 3 | 4 | 5;
  cprNeeded: boolean;
  callAmbulance: boolean;
  steps: string[];
  doNots: string[];
  severityColor: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONS
// ─────────────────────────────────────────────────────────────────────────────

const QUESTIONS: DecisionQuestion[] = [
  {
    id: 'q1',
    text: 'Is the victim unconscious or unresponsive?',
    hint: 'Tap their shoulder and shout "Are you OK?" If no response → YES',
    yesNext: 'q2',
    noNext: 'q3',
  },
  {
    id: 'q2',
    text: 'Is the victim breathing?',
    hint: 'Look for chest rise, listen for breath sounds for 10 seconds',
    yesNext: 'result_recovery_position',
    noNext: 'result_cardiac_arrest',
  },
  {
    id: 'q3',
    text: 'Is there heavy bleeding (blood soaking clothes or pooling on ground)?',
    hint: 'Look for blood soaking through clothing or forming a pool',
    yesNext: 'result_severe_bleeding',
    noNext: 'q4',
  },
  {
    id: 'q4',
    text: 'Does the victim have neck/back pain, or is the spine at an unusual angle?',
    hint: 'Ask if conscious. Assume YES if they were in a high-speed or rollover crash.',
    yesNext: 'result_spinal_injury',
    noNext: 'q5',
  },
  {
    id: 'q5',
    text: 'Are there visible burns on the skin?',
    hint: 'Look for red/blistered/charred skin — especially if there was a fire or explosion',
    yesNext: 'result_burns',
    noNext: 'result_general_trauma',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PROTOCOLS
// ─────────────────────────────────────────────────────────────────────────────

const PROTOCOLS: Record<string, InjuryProtocol> = {
  result_cardiac_arrest: {
    id: 'result_cardiac_arrest',
    injuryType: 'Cardiac Arrest / Not Breathing',
    severity: 5,
    cprNeeded: true,
    callAmbulance: true,
    severityColor: '#CC0000',
    steps: [
      'Call 108 immediately — tell them the victim is not breathing.',
      'Place the victim on their back on a firm, flat surface.',
      'Kneel beside them. Place the heel of your hand on the centre of their chest (between the nipples).',
      'Place your other hand on top and interlace your fingers.',
      'Press down HARD and FAST — at least 5 cm deep at 100–120 times per minute.',
      'After every 30 compressions: tilt head back, lift chin, pinch nose, give 2 rescue breaths (1 second each).',
      'Repeat 30 compressions → 2 breaths until the ambulance arrives or the victim starts breathing.',
    ],
    doNots: [
      'Do NOT stop CPR until ambulance arrives.',
      'Do NOT leave the victim alone.',
      'Do NOT give food or water.',
    ],
  },

  result_recovery_position: {
    id: 'result_recovery_position',
    injuryType: 'Unconscious but Breathing',
    severity: 4,
    cprNeeded: false,
    callAmbulance: true,
    severityColor: '#FF3B30',
    steps: [
      'Call 108 immediately.',
      'Place the victim in the RECOVERY POSITION: roll them gently onto their side.',
      'Bend their upper knee forward to prevent them from rolling further.',
      'Tilt their head back slightly to keep the airway open.',
      'Do NOT move them if you suspect a neck or back injury — use this position only if airway is blocked.',
      'Check breathing every 1 minute.',
      'Keep them warm with a jacket or blanket.',
    ],
    doNots: [
      'Do NOT give anything to eat or drink.',
      'Do NOT leave them alone.',
      'Do NOT move them if neck/spine injury is possible.',
    ],
  },

  result_severe_bleeding: {
    id: 'result_severe_bleeding',
    injuryType: 'Severe Bleeding',
    severity: 4,
    cprNeeded: false,
    callAmbulance: true,
    severityColor: '#FF3B30',
    steps: [
      'Call 108 immediately.',
      'Use gloves if available. If not, use a plastic bag or cloth between your hand and the wound.',
      'Apply firm, direct pressure to the wound using a clean cloth or item of clothing.',
      'Do NOT remove the cloth — if it soaks through, add MORE cloth on top and press harder.',
      'If the bleeding is on an arm or leg and life-threatening, tie a tight improvised tourniquet above the wound using cloth or a belt.',
      'Keep the victim lying down and elevate the injured limb above heart level if possible.',
      'Talk to the victim calmly — keep them awake and still.',
    ],
    doNots: [
      'Do NOT remove any object embedded in the wound.',
      'Do NOT remove the blood-soaked cloth — add more on top.',
      'Do NOT give food or water.',
    ],
  },

  result_spinal_injury: {
    id: 'result_spinal_injury',
    injuryType: 'Suspected Spinal Injury',
    severity: 5,
    cprNeeded: false,
    callAmbulance: true,
    severityColor: '#CC0000',
    steps: [
      'Call 108 immediately — say "possible spinal injury."',
      'DO NOT MOVE THE VICTIM unless they are in immediate danger (fire, rising water, traffic).',
      'Hold the head STILL in a neutral position — aligned with the spine. Do not allow any bending.',
      'Ask bystanders to kneel on each side and hold the head and shoulders in place.',
      'If victim must be moved: use a log-roll (3+ people) keeping head, neck and spine aligned.',
      'Monitor breathing continuously.',
      'Keep the victim calm and warm.',
    ],
    doNots: [
      'Do NOT bend, twist or rotate the head or neck.',
      'Do NOT try to remove a helmet.',
      'Do NOT give food or water.',
      'Do NOT let the victim "walk it off."',
    ],
  },

  result_burns: {
    id: 'result_burns',
    injuryType: 'Burns',
    severity: 3,
    cprNeeded: false,
    callAmbulance: true,
    severityColor: '#FF9500',
    steps: [
      'Call 108 if burns are large, on the face/hands/genitals, or caused by chemicals/electricity.',
      'Cool the burn under COOL (not cold/iced) running water for at least 20 minutes.',
      'Remove clothing or jewellery near the burn — ONLY if it is not stuck to the skin.',
      'Cover loosely with a clean, non-fluffy material: cling film or a clean plastic bag work well.',
      'Keep the victim warm (cool water can cause shock in large burns).',
    ],
    doNots: [
      'Do NOT use ice or iced water.',
      'Do NOT apply butter, toothpaste or cream.',
      'Do NOT remove clothing stuck to a burn.',
      'Do NOT burst any blisters.',
    ],
  },

  result_general_trauma: {
    id: 'result_general_trauma',
    injuryType: 'General Trauma / Fractures',
    severity: 2,
    cprNeeded: false,
    callAmbulance: true,
    severityColor: '#FF9500',
    steps: [
      'Call 108 if the pain is severe or you suspect a bone fracture.',
      'Keep the victim still and calm — do not let them try to stand or walk.',
      'Support any suspected broken limb in the exact position found — do not try to straighten it.',
      'Pad around the limb with rolled clothing to stop movement.',
      'Watch for signs of shock: pale skin, fast shallow breathing, confusion, cold sweating.',
      'Keep the victim warm and talk to them until help arrives.',
    ],
    doNots: [
      'Do NOT try to straighten a bent or deformed limb.',
      'Do NOT give food or water if surgery might be needed.',
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED API
// ─────────────────────────────────────────────────────────────────────────────

export function getFirstQuestion(): DecisionQuestion {
  return QUESTIONS[0];
}

export function getQuestion(id: string): DecisionQuestion | null {
  return QUESTIONS.find((q) => q.id === id) ?? null;
}

export function getProtocol(resultId: string): InjuryProtocol | null {
  return PROTOCOLS[resultId] ?? null;
}

export function isResultId(id: string): boolean {
  return id.startsWith('result_');
}

export function getTotalQuestions(): number {
  return QUESTIONS.length;
}

export function getQuestionIndex(id: string): number {
  return QUESTIONS.findIndex((q) => q.id === id);
}