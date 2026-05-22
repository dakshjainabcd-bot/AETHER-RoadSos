import * as Print   from 'expo-print';
import * as Sharing  from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { RewardClaimData } from './types';

class PDFGenerator {
  /**
   * Generate the Good Samaritan reward claim PDF (Form MV-134A).
   * Now async to support embedding proof images as base64.
   */
  async generateRewardClaim(data: RewardClaimData): Promise<string | null> {
    try {
      console.log('[PDF] Building government-format claim PDF…');
      const html = await this.buildRewardClaimHTML(data); // ← now awaited

      const { uri } = await Print.printToFileAsync({ html, base64: false });

      const fileName = `AETHER_Claim_MV134A_${data.incidentId.substring(0, 8).toUpperCase()}.pdf`;
      const permanentUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.copyAsync({ from: uri, to: permanentUri });

      console.log('[PDF] Generated:', permanentUri);
      return permanentUri;
    } catch (error) {
      console.error('[PDF] Generation failed:', error);
      return null;
    }
  }

  async sharePDF(pdfUri: string): Promise<void> {
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      console.warn('[PDF] Sharing not available on this device');
      return;
    }
    await Sharing.shareAsync(pdfUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share AETHER Claim — Form MV-134A',
    });
  }

  // ── Private: build proof image HTML section ──────────────────────────────

  private async buildProofImagesSection(data: RewardClaimData): Promise<string> {
    const uris    = data.proofImageBase64 ?? [];
    const labels  = data.proofImageLabels ?? [];

    if (uris.length === 0) {
      return `
        <p style="font-style:italic;color:#666;font-size:10px;padding:8px 0;">
          No photographic evidence was uploaded with this claim.
          Please attach supporting documents separately when submitting physically.
        </p>`;
    }

    const items = uris.map((b64, i) => {
      const label = labels[i] ?? `Evidence Photo ${i + 1}`;
      return `
        <div style="border:1px solid #ccc;padding:4px;text-align:center;break-inside:avoid;">
          <img src="data:image/jpeg;base64,${b64}"
               style="width:100%;height:150px;object-fit:cover;display:block;" />
          <p style="font-size:9px;color:#555;margin-top:4px;font-style:italic;">
            Photo ${i + 1}: ${label}
          </p>
        </div>`;
    }).join('');

    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px;">
        ${items}
      </div>`;
  }

  // ── Private: build full government-format HTML ───────────────────────────

  private async buildRewardClaimHTML(data: RewardClaimData): Promise<string> {
    const today = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric',
    });

    // Auto-generated application reference number
    const appNo = `MV134A-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 9999)
                    .toString().padStart(4, '0')}`;

    // Intervention checkboxes for PDF
    const ALL_INTERVENTIONS = [
      'CPR performed',
      'Bleeding controlled with direct pressure',
      'Recovery position applied',
      'Airways cleared',
      'Called ambulance (108)',
      'Spinal precaution maintained',
      'Burns cooled with water',
      'Fracture immobilized',
      'Victim kept calm and still',
      'Crowd managed for ambulance access',
      'Vital signs monitored',
      'First aid kit applied',
    ];

    const interventionsHTML = ALL_INTERVENTIONS.map(item => {
      const checked = data.interventions?.includes(item) ?? false;
      return `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;font-size:10px;">
          <div style="width:13px;height:13px;border:1.5px solid #000;display:inline-flex;
                      align-items:center;justify-content:center;font-size:10px;flex-shrink:0;">
            ${checked ? '✓' : ''}
          </div>
          <span>${item}</span>
        </div>`;
    }).join('');

    const proofImagesHTML = await this.buildProofImagesSection(data);

    const notesHTML = data.additionalNotes
      ? `<div style="margin-top:10px;padding:8px;background:#f9f9f9;border:1px solid #ddd;border-radius:3px;">
           <span style="font-weight:bold;font-size:10px;">Additional Notes:</span>
           <p style="margin-top:4px;font-size:10px;line-height:1.6;">${data.additionalNotes}</p>
         </div>`
      : '';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: #000;
    padding: 22px 28px;
    line-height: 1.5;
    background: #fff;
  }

  /* ── Header ── */
  .gov-header {
    text-align: center;
    border: 3px double #000;
    padding: 12px 8px;
    margin-bottom: 0;
  }
  .emblem       { font-size: 26px; margin-bottom: 3px; }
  .gov-top      { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  .gov-mid      { font-size: 11px; margin-top: 1px; }
  .gov-bot      { font-size: 10px; color: #444; margin-top: 1px; }

  .form-title-bar {
    background: #1a1a1a;
    color: #fff;
    text-align: center;
    padding: 6px;
    font-size: 12px;
    font-weight: bold;
    letter-spacing: 1px;
  }
  .form-subtitle {
    text-align: center;
    padding: 5px 8px;
    font-size: 9px;
    color: #333;
    border-bottom: 2px solid #000;
    margin-bottom: 12px;
    line-height: 1.6;
  }

  /* ── Reference table ── */
  .ref-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px; }
  .ref-table td { border: 1px solid #888; padding: 4px 8px; }
  .ref-table td:nth-child(odd)  { font-weight: bold; background: #f0f0f0; width: 30%; }

  /* ── Warning bar ── */
  .warn-bar {
    background: #fffde7;
    border: 1px solid #f0b429;
    padding: 4px 10px;
    font-size: 9px;
    text-align: center;
    margin-bottom: 12px;
    color: #555;
  }

  /* ── Sections ── */
  .section      { margin-bottom: 12px; page-break-inside: avoid; }
  .sec-header   {
    display: flex; align-items: center; gap: 8px;
    background: #e0e0e0;
    padding: 4px 8px;
    font-weight: bold;
    font-size: 10px;
    border: 1px solid #000;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .sec-letter {
    width: 20px; height: 20px; border-radius: 50%;
    background: #1a1a1a; color: #fff;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: bold; flex-shrink: 0;
  }
  .sec-body { border: 1px solid #000; border-top: none; padding: 10px 12px; }

  /* ── Field rows ── */
  .field-row { display: flex; margin-bottom: 7px; min-height: 18px; }
  .field-label {
    font-weight: bold; width: 200px; font-size: 10px;
    flex-shrink: 0; padding-right: 8px; color: #222;
  }
  .field-value {
    flex: 1; border-bottom: 1px solid #999;
    font-size: 10px; padding-left: 4px; min-width: 0;
  }

  /* ── Signature ── */
  .sig-row { display: flex; justify-content: space-between; margin-top: 28px; }
  .sig-box { width: 44%; border-top: 1px solid #000; padding-top: 4px; text-align: center; font-size: 10px; }

  /* ── Official use box ── */
  .official-box {
    border: 2px solid #000; padding: 10px;
    margin-top: 14px; background: #f8f8f8;
  }
  .official-title {
    font-weight: bold; font-size: 10px;
    border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 8px;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .reward-box {
    margin-top: 8px; padding: 6px 8px;
    background: #e8f5e9; border: 1px solid #4caf50;
    font-size: 10px;
  }

  /* ── Footer ── */
  .footer {
    margin-top: 18px; padding-top: 8px;
    border-top: 1px solid #ccc;
    font-size: 9px; color: #666; text-align: center; line-height: 1.7;
  }

  .red   { color: #c00; }
  .bold  { font-weight: bold; }
  .small { font-size: 9px; }
</style>
</head>
<body>

<!-- ── GOVERNMENT HEADER ── -->
<div class="gov-header">
  <div class="emblem">🇮🇳</div>
  <div class="gov-top">Government of India</div>
  <div class="gov-mid">Ministry of Road Transport and Highways (MoRTH)</div>
  <div class="gov-bot">National Road Safety Board · Directorate of Road Safety</div>
</div>

<div class="form-title-bar">
  FORM MV-134A &nbsp;—&nbsp; GOOD SAMARITAN REWARD CLAIM APPLICATION
</div>

<div class="form-subtitle">
  Under Section 134A of the Motor Vehicles Act, 1988 (Amendment 2019) &nbsp;|&nbsp;
  MoRTH Circular No. RT-25036/38/2015-MVL dated 12.05.2015 &nbsp;|&nbsp;
  National Reward Scheme for Good Samaritans
</div>

<!-- ── REFERENCE INFO ── -->
<table class="ref-table">
  <tr>
    <td>Application Reference No.</td>
    <td class="bold">${appNo}</td>
    <td>AETHER Incident ID</td>
    <td class="bold">${data.incidentId}</td>
  </tr>
  <tr>
    <td>Date of Application</td>
    <td>${today}</td>
    <td>Processing Status</td>
    <td class="red bold">PENDING OFFICIAL VERIFICATION</td>
  </tr>
</table>

<div class="warn-bar">
  ⚠ THIS IS A COMPUTER-GENERATED DOCUMENT — VERIFY ALL DETAILS BEFORE SUBMISSION.
  FALSE CLAIMS ARE PUNISHABLE UNDER IPC SECTION 420. SUBMIT TO YOUR STATE TRANSPORT AUTHORITY.
</div>

<!-- ── SECTION A: CLAIMANT ── -->
<div class="section">
  <div class="sec-header">
    <span class="sec-letter">A</span>
    Section A — Claimant (Good Samaritan) Details
  </div>
  <div class="sec-body">
    <div class="field-row">
      <span class="field-label">Full Name (as per ID):</span>
      <span class="field-value bold">${data.rakshakName}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Mobile Number:</span>
      <span class="field-value">${data.rakshakPhone}</span>
    </div>
    <div class="field-row">
      <span class="field-label">First Aid Certificate Type:</span>
      <span class="field-value">${data.certificateType}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Certificate Number:</span>
      <span class="field-value">${data.certificateNumber || '______________________________'}</span>
    </div>
    <div class="field-row">
      <span class="field-label">AETHER Rakshak ID:</span>
      <span class="field-value">AETH-RK-${data.incidentId.substring(0, 6).toUpperCase()}</span>
    </div>
  </div>
</div>

<!-- ── SECTION B: INCIDENT ── -->
<div class="section">
  <div class="sec-header">
    <span class="sec-letter">B</span>
    Section B — Incident Information
  </div>
  <div class="sec-body">
    <div class="field-row">
      <span class="field-label">AETHER Incident ID:</span>
      <span class="field-value bold">${data.incidentId.toUpperCase()}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Date of Incident:</span>
      <span class="field-value">${data.incidentDate}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Location / Address:</span>
      <span class="field-value">${data.incidentGPS}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Claimant's Arrival Time:</span>
      <span class="field-value">${data.arrivalTime}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Ambulance Handover Time:</span>
      <span class="field-value">${data.handoverTime}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Ambulance / EMS Details:</span>
      <span class="field-value">${data.ambulanceDetails || 'Not recorded'}</span>
    </div>
  </div>
</div>

<!-- ── SECTION C: INTERVENTIONS ── -->
<div class="section">
  <div class="sec-header">
    <span class="sec-letter">C</span>
    Section C — Interventions and Assistance Provided
  </div>
  <div class="sec-body">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;">
      ${interventionsHTML}
    </div>
    ${notesHTML}
  </div>
</div>

<!-- ── SECTION D: PROOF IMAGES ── -->
<div class="section">
  <div class="sec-header">
    <span class="sec-letter">D</span>
    Section D — Documentary Evidence (Proof Photographs)
  </div>
  <div class="sec-body">
    <p style="font-size:10px;margin-bottom:6px;color:#444;">
      The following photographs were uploaded by the claimant as evidence of assistance rendered at the incident scene.
      Each photo is time-stamped and geo-tagged via AETHER.
    </p>
    ${proofImagesHTML}
  </div>
</div>

<!-- ── SECTION E: DECLARATION ── -->
<div class="section">
  <div class="sec-header">
    <span class="sec-letter">E</span>
    Section E — Statutory Declaration (Affidavit)
  </div>
  <div class="sec-body">
    <p style="font-size:10px;margin-bottom:8px;">
      I, <strong>${data.rakshakName}</strong>, hereby solemnly affirm and declare as follows:
    </p>
    <ol style="margin:0 0 8px 18px;font-size:10px;line-height:1.8;">
      <li>I voluntarily provided first aid and emergency assistance to the victim(s) of the road accident described in Section B, in good faith, without expectation of reward prior to rendering such assistance.</li>
      <li>I hold a valid first-aid qualification (${data.certificateType}) and am registered as a Rakshak volunteer on the AETHER Emergency Response Platform.</li>
      <li>I am claiming the statutory reward under Section 134A of the Motor Vehicles Act, 1988, and the MoRTH notification dated 12.05.2015 (₹25,000 per rescue).</li>
      <li>All information and documentary evidence submitted in this form is true, correct, and genuine to the best of my knowledge. I understand that any misrepresentation constitutes a criminal offence under the Indian Penal Code.</li>
      <li>I have not filed any parallel claim for this incident with any other authority.</li>
      <li>I consent to my claim details being verified with the concerned EMS agency, hospital, and the AETHER cloud system.</li>
    </ol>
    <p style="font-size:9px;color:#555;font-style:italic;">
      This document was auto-generated by the AETHER Emergency Response System v1.0.
      Application Reference: <strong>${appNo}</strong> | 
      Verify at: <strong>verify.aether.gov.in</strong>
    </p>
  </div>
</div>

<!-- ── SIGNATURES ── -->
<div class="sig-row">
  <div class="sig-box">
    <p style="height:36px;"></p>
    <p>_______________________________</p>
    <p class="bold" style="margin-top:4px;">Signature of Claimant</p>
    <p class="small" style="color:#555;margin-top:2px;">${data.rakshakName}</p>
    <p class="small" style="color:#555;">Date: ${today}</p>
  </div>
  <div class="sig-box">
    <p style="height:36px;"></p>
    <p>_______________________________</p>
    <p class="bold" style="margin-top:4px;">EMS Personnel / Witness Signature</p>
    <p class="small" style="color:#555;margin-top:2px;">Name &amp; Designation</p>
    <p class="small" style="color:#555;">Ambulance Reg.: ${data.ambulanceDetails || '__________'}</p>
  </div>
</div>

<!-- ── OFFICIAL USE BOX ── -->
<div class="official-box">
  <div class="official-title">Section F — For Official Use Only (Do Not Fill — Authority Use)</div>
  <div class="field-row">
    <span class="field-label">Received By (Name &amp; Designation):</span>
    <span class="field-value">_______________________________</span>
  </div>
  <div class="field-row">
    <span class="field-label">Office / Department:</span>
    <span class="field-value">_______________________________</span>
  </div>
  <div class="field-row">
    <span class="field-label">Date of Receipt:</span>
    <span class="field-value">_______________________________</span>
  </div>
  <div class="field-row" style="align-items:flex-start;">
    <span class="field-label">Official Seal &amp; Stamp:</span>
    <span class="field-value" style="height:60px;"></span>
  </div>
  <div class="reward-box">
    <span class="bold">Payment Sanction:</span>
    Reward Amount: <span class="bold">₹ 25,000/-</span> &nbsp;|&nbsp;
    Mode: Bank Transfer / Demand Draft &nbsp;|&nbsp;
    Sanction Order No.: ________________ &nbsp;|&nbsp;
    Date: ____________
  </div>
</div>

<!-- ── FOOTER ── -->
<div class="footer">
  <p>Submit this completed form, along with a copy of your first-aid certificate and a valid government photo ID, to your District/State Transport Authority
  or the nearest NHAI Regional Office.</p>
  <p style="margin-top:3px;">National Helpline: <strong>1800-180-1104</strong> &nbsp;|&nbsp; NHAI: <strong>1033</strong> &nbsp;|&nbsp; MoRTH: <strong>011-23714874</strong></p>
  <p style="margin-top:3px;">
    Generated by AETHER Emergency Response System v1.0 &nbsp;|&nbsp;
    Ref: <strong>${appNo}</strong> &nbsp;|&nbsp;
    Verify: <strong>verify.aether.gov.in/${appNo}</strong>
  </p>
</div>

</body>
</html>`;
  }
}

export const pdfGenerator = new PDFGenerator();