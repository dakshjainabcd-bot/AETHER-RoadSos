/**
 * PsychAidService — Psychological First Aid Script Provider
 *
 * WHY DIFFERENT SCRIPTS FOR DIFFERENT INJURIES?
 *
 * Cardiac Arrest: The victim is UNCONSCIOUS. The scripts here are for
 *   ENCOURAGING THE BYSTANDER doing CPR — not for the victim.
 *   Doing CPR alone is exhausting and frightening. Coaching the helper
 *   is critical.
 *
 * Head Trauma / Spinal / Burns: Victim may be conscious and AFRAID.
 *   Clear, calm reassurance prevents panic.
 *
 * Fractures: Victim is often in severe pain.
 *   Reassurance about ETA and distraction reduces pain perception.
 */

import { PsychAidConfig, PsychAidScript, BystAIInjuryType } from './types';

// Ambulance ETA placeholder — replaced at runtime with actual ETA
const ETA_PLACEHOLDER = '{ETA}';

/**
 * Replace the ETA placeholder in a script with the actual ETA.
 */
function injectETA(script: string, etaMinutes: number | null): string {
  const etaText =
    etaMinutes != null ? `${etaMinutes} minutes` : 'a few minutes';
  return script.replace(ETA_PLACEHOLDER, etaText);
}

// ─── Script definitions ────────────────────────────────────────────────────────

const SCRIPTS: Record<BystAIInjuryType | 'unknown', PsychAidConfig> = {
  cardiac_arrest: {
    bystanderNote:
      'The victim is unconscious. These scripts are for YOU — to help you stay calm and keep going.',
    scripts: [
      {
        phase: 'connect',
        phaseLabel: 'You Are Doing Great',
        scriptForVictim: 'You are doing the right thing. Every compression matters. Keep going.',
        coachNote: 'Say this to yourself out loud to stay focused.',
      },
      {
        phase: 'assess',
        phaseLabel: 'Ask for Help',
        scriptForVictim:
          'Someone — point at a specific person — you, help me count. One, two, three...',
        coachNote: 'Having someone count compressions helps maintain rhythm and shares the mental load.',
      },
      {
        phase: 'reassure',
        phaseLabel: 'Ambulance Is Coming',
        scriptForVictim:
          'The ambulance is on its way. You are keeping this person alive right now. Do not stop.',
        coachNote: 'Remind yourself that imperfect CPR is better than no CPR.',
      },
      {
        phase: 'breathe',
        phaseLabel: 'Swap If You Can',
        scriptForVictim:
          'If anyone is nearby — point at them — can you take over for two minutes? I will guide you.',
        coachNote: 'Swapping every 2 minutes maintains compression quality. Guide the new helper.',
      },
    ],
  },

  head_trauma: {
    bystanderNote:
      'The victim may be confused or frightened. Speak slowly and clearly.',
    scripts: [
      {
        phase: 'connect',
        phaseLabel: 'Make Contact',
        scriptForVictim:
          'I am right here with you. My name is [your name]. You are safe. I am not going to leave.',
        coachNote: 'Touch their arm or hand gently if they are conscious. Physical contact is reassuring.',
      },
      {
        phase: 'assess',
        phaseLabel: 'Check In',
        scriptForVictim:
          'Can you hear my voice? I want you to stay as still as possible. Tell me where it hurts most.',
        coachNote:
          'Do NOT let them try to sit up or look around. Keep them very still if spinal risk exists.',
      },
      {
        phase: 'reassure',
        phaseLabel: 'Help Is Coming',
        scriptForVictim:
          `The ambulance will be here in about ${ETA_PLACEHOLDER}. You are doing really well. Just keep breathing normally.`,
        coachNote: 'If you do not know the ETA, say: Help is on the way and will be here very soon.',
      },
      {
        phase: 'breathe',
        phaseLabel: 'Breathe Together',
        scriptForVictim:
          'Let us breathe together. Breathe in slowly with me... two... three... now breathe out slowly... two... three. Good.',
        coachNote:
          'Slow breathing reduces pain perception and keeps them calm. Do it yourself too.',
      },
    ],
  },

  fracture: {
    bystanderNote:
      'The victim is in pain and may be scared. Calm, confident presence reduces pain perception.',
    scripts: [
      {
        phase: 'connect',
        phaseLabel: 'I Am Here',
        scriptForVictim:
          'I am here with you. I am going to help you. You are going to be okay. Just try not to move.',
        coachNote: 'Your presence and calm voice are medicine. Speak quietly and confidently.',
      },
      {
        phase: 'assess',
        phaseLabel: 'Stay Still',
        scriptForVictim:
          'I know it hurts. Can you stay as still as possible? Moving can make it worse. Help is very close.',
        coachNote:
          'Do not downplay their pain — acknowledge it. This builds trust and cooperation.',
      },
      {
        phase: 'reassure',
        phaseLabel: 'Ambulance ETA',
        scriptForVictim:
          `Paramedics will be here in about ${ETA_PLACEHOLDER}. They will give you pain relief as soon as they arrive.`,
        coachNote:
          'Knowing pain relief is coming in a specific time dramatically reduces anxiety.',
      },
      {
        phase: 'breathe',
        phaseLabel: 'Guided Breathing',
        scriptForVictim:
          'Try this with me: breathe in slowly through your nose... hold... now breathe out through your mouth. Each breath helps your body stay calm.',
        coachNote:
          'Controlled breathing is a clinically proven pain management technique.',
      },
    ],
  },

  burns: {
    bystanderNote:
      'Burns are extremely painful. The victim may panic. Water must keep flowing for the full 20 minutes.',
    scripts: [
      {
        phase: 'connect',
        phaseLabel: 'You Are Safe',
        scriptForVictim:
          'The fire is out. You are safe now. I am cooling your burn with water. This is the most important thing I can do right now.',
        coachNote:
          'Burns victims often do not know the fire is out. Confirm this clearly and calmly.',
      },
      {
        phase: 'assess',
        phaseLabel: 'Stay Still for Water',
        scriptForVictim:
          'I need to keep water running on the burn for the next 20 minutes. Can you help me by staying as still as you can?',
        coachNote:
          'Give them a JOB — staying still. This channels their energy and keeps them engaged.',
      },
      {
        phase: 'reassure',
        phaseLabel: 'Count Down Together',
        scriptForVictim:
          `We are going to do this together. About ${ETA_PLACEHOLDER} more of water, then the ambulance will be here to take over.`,
        coachNote: 'Counting down gives them a goal. It makes the wait feel manageable.',
      },
      {
        phase: 'breathe',
        phaseLabel: 'Focus on Breathing',
        scriptForVictim:
          'Focus on your breathing with me. Slowly in... and slowly out. Your body heals faster when you breathe calmly.',
        coachNote: 'Shallow rapid breathing in burns patients worsens shock. Guided breathing is critical.',
      },
    ],
  },

  spinal: {
    bystanderNote:
      'The victim MUST NOT move. Your most important job is preventing movement.',
    scripts: [
      {
        phase: 'connect',
        phaseLabel: 'Do Not Move',
        scriptForVictim:
          'Do not move. I am right here. I am holding your head still. This is very important — stay exactly as you are.',
        coachNote:
          'Say this with authority. The victim must trust you enough to overcome the instinct to move.',
      },
      {
        phase: 'assess',
        phaseLabel: 'Talk, Do Not Move',
        scriptForVictim:
          'I can hear you. Keep talking to me — but please, do not turn your head or try to sit up. Tell me your name.',
        coachNote:
          'Asking their name serves two purposes: assesses consciousness AND keeps them engaged.',
      },
      {
        phase: 'reassure',
        phaseLabel: 'Ambulance Coming',
        scriptForVictim:
          `Paramedics are coming in about ${ETA_PLACEHOLDER}. They have a special board to move you safely. You are doing exactly the right thing by staying still.`,
        coachNote:
          'Telling them about the special equipment reduces fear of being stuck in this position.',
      },
      {
        phase: 'breathe',
        phaseLabel: 'Breathe Slowly',
        scriptForVictim:
          'Just focus on breathing slowly and steadily. In... and out. You are handling this really well. Stay still.',
        coachNote:
          'Every few minutes confirm they are still breathing normally. Watch the chest.',
      },
    ],
  },

  unknown: {
    bystanderNote:
      'Injury type unclear. Use these general calming scripts while assessing the situation.',
    scripts: [
      {
        phase: 'connect',
        phaseLabel: 'I Am Here',
        scriptForVictim:
          'I am here with you. You are safe. Help is on the way. Can you hear me?',
        coachNote: 'Establish contact before doing anything else.',
      },
      {
        phase: 'assess',
        phaseLabel: 'Ask Gently',
        scriptForVictim:
          'I am going to help you. Can you tell me where it hurts? Try to stay as still as possible.',
        coachNote:
          'Their answer tells you the injury type. Stay still is universal advice until you know more.',
      },
      {
        phase: 'reassure',
        phaseLabel: 'Help Is Coming',
        scriptForVictim:
          'The ambulance has been called and is on its way. I will stay with you the whole time.',
        coachNote:
          'Commit to staying with them. Abandonment fear is a major source of panic.',
      },
      {
        phase: 'breathe',
        phaseLabel: 'Breathe Together',
        scriptForVictim:
          'Breathe with me. In slowly... hold... out slowly. Good. Again. In... hold... out. You are doing well.',
        coachNote:
          'Guided breathing works for all injury types. It keeps both of you calmer.',
      },
    ],
  },
};

/**
 * Get PsychAid scripts for a specific injury type.
 *
 * @param injuryType  The injury type from BystAI assessment
 * @param etaMinutes  Ambulance ETA in minutes (from hospital pre-alert)
 * @returns           PsychAidConfig with scripts ready to display
 */
export function getPsychAidConfig(
  injuryType: string,
  etaMinutes: number | null = null
): PsychAidConfig {
  const key = injuryType as BystAIInjuryType;
  const config = SCRIPTS[key] ?? SCRIPTS.unknown;

  // Inject actual ETA into script text
  const scriptsWithETA: PsychAidScript[] = config.scripts.map((script) => ({
    ...script,
    scriptForVictim: injectETA(script.scriptForVictim, etaMinutes),
  }));

  return {
    ...config,
    scripts: scriptsWithETA,
  };
}

/**
 * Get a specific script by phase for a given injury type.
 */
export function getScriptByPhase(
  injuryType: string,
  phaseIndex: number,
  etaMinutes: number | null = null
): PsychAidScript | null {
  const config = getPsychAidConfig(injuryType, etaMinutes);
  return config.scripts[phaseIndex] ?? null;
}

/**
 * Get the number of script phases available for an injury type.
 */
export function getPhaseCount(injuryType: string): number {
  const key = injuryType as BystAIInjuryType;
  return (SCRIPTS[key] ?? SCRIPTS.unknown).scripts.length;
}