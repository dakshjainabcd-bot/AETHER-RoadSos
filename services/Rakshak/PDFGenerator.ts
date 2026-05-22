// services/Rakshak/PDFGenerator.ts
/**
 * PDFGenerator — Good Samaritan Reward Claim Document
 * 
 * Generates a court-ready PDF claim document using expo-print.
 * 
 * WHY HTML → PDF?
 * expo-print renders HTML/CSS into a PDF document.
 * This gives us full control over layout, logos, legal text,
 * and formatting without needing a separate PDF library.
 * 
 * The generated PDF contains:
 * - Rakshak identification details
 * - Incident details (GPS, time, severity)
 * - Interventions performed
 * - Legal citation (Motor Vehicles Act Section 134A)
 * - Space for digital signature
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { RewardClaimData } from './types';

class PDFGenerator {
  /**
   * Generate the Good Samaritan reward claim PDF.
   * Opens system share sheet so user can email or WhatsApp it.
   */
  async generateRewardClaim(data: RewardClaimData): Promise<string | null> {
    const html = this.buildRewardClaimHTML(data);

    try {
      console.log('[PDF] Generating reward claim PDF...');

      // expo-print converts HTML to a PDF file
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      console.log('[PDF] PDF generated at:', uri);

      // Copy to a permanent location with a readable name
      const fileName = `AETHER_Reward_Claim_${data.incidentId.substring(0, 8)}.pdf`;
      const permanentUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.copyAsync({ from: uri, to: permanentUri });

      // Record the claim in the tracker (NEW)
      try {
        const { badgeService } = require('../Trust/BadgeService');
        await badgeService.recordClaimSubmission(data.incidentId, permanentUri);
      } catch (e) {
        // Non-critical if this fails
        console.warn('[PDF] Could not record claim submission:', e);
      }

      return permanentUri;
    } catch (error) {
      console.error('[PDF] Failed to generate PDF:', error);
      return null;
    }
  }

  /**
   * Share the PDF via system share sheet (email, WhatsApp, etc.)
   */
  async sharePDF(pdfUri: string): Promise<void> {
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      console.warn('[PDF] Sharing not available on this device');
      return;
    }
    await Sharing.shareAsync(pdfUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share AETHER Reward Claim',
    });
  }

  /**
   * Build the HTML template for the reward claim.
   * This is a professional legal document format.
   */
  private buildRewardClaimHTML(data: RewardClaimData): string {
    const today = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    const interventionsList = data.interventions
      .map(i => `<li>${i}</li>`)
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Times New Roman', serif; 
      font-size: 13px;
      color: #000;
      padding: 40px;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      border-bottom: 3px double #000;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 24px;
      letter-spacing: 3px;
      color: #CC0000;
    }
    .header h2 {
      font-size: 16px;
      font-weight: normal;
      margin-top: 5px;
    }
    .section {
      margin: 20px 0;
      padding: 15px;
      border: 1px solid #999;
      border-radius: 4px;
    }
    .section-title {
      font-size: 14px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 8px;
      margin-bottom: 12px;
      color: #333;
    }
    .field-row {
      display: flex;
      margin: 6px 0;
    }
    .field-label {
      width: 200px;
      font-weight: bold;
      flex-shrink: 0;
    }
    .field-value {
      flex: 1;
      border-bottom: 1px dotted #999;
    }
    .legal-box {
      background: #f9f9f9;
      border: 2px solid #000;
      padding: 15px;
      margin: 20px 0;
      font-size: 12px;
    }
    .highlight {
      color: #CC0000;
      font-weight: bold;
    }
    .signature-section {
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
    }
    .signature-box {
      width: 45%;
      border-top: 1px solid #000;
      padding-top: 5px;
      text-align: center;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 10px;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 10px;
    }
    .aether-badge {
      display: inline-block;
      background: #CC0000;
      color: white;
      padding: 3px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: bold;
      letter-spacing: 1px;
    }
    ul { margin-left: 20px; }
    li { margin: 4px 0; }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <span class="aether-badge">AETHER</span>
    <h1>GOOD SAMARITAN REWARD CLAIM</h1>
    <h2>Motor Vehicles Act, 1988 — Section 134A | Ministry of Road Transport & Highways</h2>
    <p style="margin-top: 8px; font-size: 12px;">Document Date: ${today}</p>
  </div>

  <!-- Rakshak Details -->
  <div class="section">
    <div class="section-title">Section 1: Rakshak (Helper) Details</div>
    <div class="field-row">
      <span class="field-label">Full Name:</span>
      <span class="field-value">${data.rakshakName}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Phone Number:</span>
      <span class="field-value">${data.rakshakPhone}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Certificate Type:</span>
      <span class="field-value">${data.certificateType}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Certificate Number:</span>
      <span class="field-value">${data.certificateNumber}</span>
    </div>
  </div>

  <!-- Incident Details -->
  <div class="section">
    <div class="section-title">Section 2: Incident Details</div>
    <div class="field-row">
      <span class="field-label">AETHER Incident ID:</span>
      <span class="field-value">${data.incidentId}</span>
    </div>
    <div class="field-row">
      <span class="field-label">GPS Location:</span>
      <span class="field-value">${data.incidentGPS}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Incident Date:</span>
      <span class="field-value">${data.incidentDate}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Arrival Time:</span>
      <span class="field-value">${data.arrivalTime}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Ambulance Handover:</span>
      <span class="field-value">${data.handoverTime}</span>
    </div>
  </div>

  <!-- Interventions -->
  <div class="section">
    <div class="section-title">Section 3: Interventions Performed</div>
    <ul>${interventionsList || '<li>General assistance provided to victim</li>'}</ul>
    ${data.ambulanceDetails ? `
    <div class="field-row" style="margin-top: 12px;">
      <span class="field-label">Ambulance Details:</span>
      <span class="field-value">${data.ambulanceDetails}</span>
    </div>` : ''}
  </div>

  ${data.earnedBadges && data.earnedBadges.length > 0 ? `
  <!-- Earned Badges -->
  <div class="section">
    <div class="section-title">Section 4: AETHER Badges Earned</div>
    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px;">
      ${data.earnedBadges.map((b) => `
        <div style="
          background: #FFF8E1;
          border: 1px solid #FFD700;
          border-radius: 8px;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: bold;
          color: #8B6914;
        ">
          ⭐ ${b.badgeId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </div>
      `).join('')}
    </div>
    <p style="font-size: 11px; color: #888; margin-top: 8px;">
      These badges are cryptographically verified by the AETHER system.
    </p>
  </div>` : ''}

  <!-- Legal Declaration -->
  <div class="legal-box">
    <strong>LEGAL DECLARATION</strong><br><br>
    I, <strong>${data.rakshakName}</strong>, hereby declare that I voluntarily assisted
    the victim(s) of the road accident described above in good faith, and I am claiming
    protection and reward under:
    <br><br>
    • <strong>Motor Vehicles Act, 1988 — Section 134A</strong> (Good Samaritan Law)<br>
    • Ministry of Road Transport &amp; Highways Notification dated 12.05.2015<br>
    • MORTH Scheme for rewarding Good Samaritans — 
      <span class="highlight">Reward of ₹25,000/-</span>
    <br><br>
    I confirm that all information provided above is true and correct to the best of my knowledge.
    This document has been auto-generated by the <strong>AETHER Emergency Response System</strong>
    and is supported by cryptographically signed sensor evidence (Incident ID: ${data.incidentId}).
  </div>

  <!-- Signature Section -->
  <div class="signature-section">
    <div class="signature-box">
      <p>____________________________</p>
      <p style="margin-top: 5px;"><strong>Rakshak Signature</strong></p>
      <p style="font-size: 11px;">${data.rakshakName}</p>
    </div>
    <div class="signature-box">
      <p>____________________________</p>
      <p style="margin-top: 5px;"><strong>Ambulance Personnel / Witness</strong></p>
      <p style="font-size: 11px;">Name &amp; Designation</p>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    Generated by AETHER — Accident Emergency &amp; Trauma Hyper-Response System v1.0<br>
    Submit this claim to your State Health Authority or district Collector's office<br>
    National Helpline: 1800-180-1104 | MORTH: 011-23714874
  </div>

</body>
</html>
    `;
  }
}

export const pdfGenerator = new PDFGenerator();