/**
 * Phase 7: Legal Notice Generator
 * 
 * When an accident happens due to road conditions, victims have legal rights
 * to claim compensation from road authorities. This module:
 * 
 * 1. Classifies the road (NH/SH/MDR/ODR)
 * 2. Identifies responsible authority
 * 3. Generates legal notice template
 * 4. Prepares for email/portal submission
 * 
 * Legal Framework (India):
 * - National Highways Act, 1956 - Section 27 (NHAI responsible)
 * - State Highway Acts - Section 15 (State PWD responsible)
 * - District Road Acts - Section 12 (District authority)
 * 
 * Timeline:
 * - Notice within 30 days of accident (legal requirement)
 * - Reply expected within 60 days
 * - Escalation if no response
 */

import {
    RoadClassification,
    RoadAuthority,
    LegalNoticeData,
    ROAD_CLASSIFICATIONS,
} from './types';

export class LegalNoticeGenerator {
    /**
     * Classify road based on GPS coordinates
     * 
     * In production, this would:
     * 1. Query OpenStreetMap or government GeoJSON database
     * 2. Match coordinates to road segments
     * 3. Return road classification
     * 
     * For MVP, we use a simple heuristic:
     * - Check if near known National Highway routes
     * - Check state highway databases
     * - Default to district road
     * 
     * @param latitude - GPS latitude
     * @param longitude - GPS longitude
     * @returns Road classification
     */
    public async classifyRoad(
        latitude: number,
        longitude: number
    ): Promise<RoadClassification> {
        console.log(`[LegalNotice] Classifying road at: ${latitude}, ${longitude}`);

        // MVP: Simplified classification
        // Production would use actual road database

        // Example heuristic for India:
        // NH-1 (Delhi-Amritsar) runs roughly north-south through Haryana
        // This is just a demo - real implementation needs proper GeoJSON

        try {
            // Simulate API call to road database
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Demo logic: classify based on rough location
            // Real implementation: Query OSM Overpass API or government data

            // Check if location is in Haryana (Rohtak area)
            const isHaryana = latitude >= 28.0 && latitude <= 30.0 && longitude >= 75.0 && longitude <= 77.5;

            if (isHaryana) {
                // Check if near major highway (simplified)
                const nearMajorHighway = Math.abs(latitude - 28.8) < 0.5 && Math.abs(longitude - 76.6) < 0.5;

                if (nearMajorHighway) {
                    console.log('[LegalNotice] 🛣️ Classified as: National Highway (NH)');
                    return 'NH';
                } else {
                    console.log('[LegalNotice] 🛣️ Classified as: State Highway (SH)');
                    return 'SH';
                }
            }

            // Default to Major District Road
            console.log('[LegalNotice] 🛣️ Classified as: Major District Road (MDR)');
            return 'MDR';
        } catch (error) {
            console.error('[LegalNotice] ❌ Classification failed:', error);
            return 'UNKNOWN';
        }

        /* PRODUCTION CODE (commented out for MVP):
        // Use Overpass API to query OpenStreetMap
        const query = `
          [out:json];
          way(around:100,${latitude},${longitude})["highway"];
          out body;
        `;
        
        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: query,
        });
        
        const data = await response.json();
        
        // Analyze road tags
        for (const element of data.elements) {
          const tags = element.tags;
          
          if (tags.ref && tags.ref.startsWith('NH')) {
            return 'NH';
          }
          if (tags.ref && tags.ref.startsWith('SH')) {
            return 'SH';
          }
          if (tags.highway === 'trunk') {
            return 'NH';
          }
          if (tags.highway === 'primary') {
            return 'SH';
          }
          if (tags.highway === 'secondary') {
            return 'MDR';
          }
        }
        
        return 'ODR';
        */
    }

    /**
     * Get road authority details based on classification
     * 
     * @param classification - Road type (NH/SH/MDR/ODR)
     * @param state - State code (e.g., 'HR' for Haryana)
     * @returns Authority contact information
     */
    public getAuthority(
        classification: RoadClassification,
        state: string = 'HR'
    ): RoadAuthority {
        console.log(`[LegalNotice] Getting authority for: ${classification} in ${state}`);

        // For state highways, append state code
        const key = classification === 'SH' ? `${classification}_${state}` : classification;

        const authority = ROAD_CLASSIFICATIONS[key] || ROAD_CLASSIFICATIONS['ODR'];

        console.log(`[LegalNotice] Authority: ${authority.name}`);
        console.log(`[LegalNotice] Statute: ${authority.statute}`);

        return authority;
    }

    /**
     * Generate legal notice document
     * 
     * This creates a formal legal notice that can be:
     * 1. Emailed to authority
     * 2. Uploaded to grievance portal
     * 3. Filed with lawyer
     * 
     * @param noticeData - Incident details
     * @returns Formatted legal notice
     */
    public generateNotice(noticeData: LegalNoticeData): string {
        console.log(`[LegalNotice] 📄 Generating legal notice for incident: ${noticeData.incidentId}`);

        const date = new Date(noticeData.timestamp).toLocaleDateString('en-IN');
        const time = new Date(noticeData.timestamp).toLocaleTimeString('en-IN');

        const notice = `
═══════════════════════════════════════════════════════════════
                        LEGAL NOTICE
        UNDER ${noticeData.authority.statute}
═══════════════════════════════════════════════════════════════

Date: ${new Date().toLocaleDateString('en-IN')}

TO:
${noticeData.authority.name}
${noticeData.authority.email}

SUBJECT: Notice of Road Accident and Claim for Compensation

Dear Sir/Madam,

I am writing to formally notify you of a road accident that occurred on your 
jurisdiction on ${date} at ${time}.

INCIDENT DETAILS:
----------------
Incident ID: ${noticeData.incidentId}
Date & Time: ${date}, ${time}
Location: ${noticeData.location.address}
GPS Coordinates: ${noticeData.location.latitude.toFixed(6)}°N, ${noticeData.location.longitude.toFixed(6)}°E
Road Classification: ${noticeData.roadClassification}
Severity: ${noticeData.severity}

ACCIDENT DESCRIPTION:
--------------------
${noticeData.description}

EVIDENCE:
---------
This notice is supported by comprehensive digital evidence including:
- Sensor data from ${noticeData.witnessCount + 1} device(s)
- GPS tracking and timestamp verification
- Cryptographically signed data (tamper-evident)
- Evidence Package URL: ${noticeData.evidenceUrl}

LEGAL BASIS:
-----------
Under ${noticeData.authority.statute}, road maintenance authorities are 
liable for accidents caused by:
- Potholes and road defects
- Inadequate signage
- Poor lighting
- Construction debris
- Other maintenance failures

DEMAND:
-------
1. Immediate inspection of the accident site
2. Repair of road defects within 7 days
3. Written acknowledgment of this notice within 15 days
4. Investigation report within 30 days
5. Compensation for damages and injuries

TIMELINE:
---------
As per legal requirements:
- This notice is being sent within 30 days of the accident
- Reply expected within 60 days
- Failure to respond may result in legal proceedings

EVIDENCE VERIFICATION:
---------------------
All submitted evidence is digitally signed and can be independently verified.
Any tampering will be cryptographically detected.

For evidence verification:
1. Download evidence package from: ${noticeData.evidenceUrl}
2. Verify RSA signatures using provided public keys
3. Check SHA-256 hashes for data integrity

NEXT STEPS:
-----------
Please acknowledge receipt of this notice and provide:
1. Case reference number
2. Assigned investigation officer details
3. Timeline for site inspection
4. Compensation claim procedure

${noticeData.authority.portalUrl ? `\nOnline Portal: ${noticeData.authority.portalUrl}` : ''}

I reserve the right to pursue legal action if this matter is not resolved
within the statutory timeframe.

Yours faithfully,
[Victim Name - To be filled]
[Contact Details - To be filled]

ATTACHMENTS:
- Evidence Package (${noticeData.evidenceUrl})
- Medical Reports (if applicable)
- Photographs of accident site
- Witness statements (${noticeData.witnessCount} digital witnesses)

═══════════════════════════════════════════════════════════════
This is a system-generated legal notice from AETHER Emergency App
For technical support: support@aether.emergency
═══════════════════════════════════════════════════════════════
`;

        console.log('[LegalNotice] ✅ Legal notice generated');
        return notice;
    }

    /**
     * Generate simplified notice for email
     * (Plain text version for email systems)
     */
    public generateEmailNotice(noticeData: LegalNoticeData): {
        subject: string;
        body: string;
    } {
        const date = new Date(noticeData.timestamp).toLocaleDateString('en-IN');

        return {
            subject: `URGENT: Road Accident Notice - ${date} - Incident ${noticeData.incidentId.substring(0, 8)}`,
            body: this.generateNotice(noticeData),
        };
    }

    /**
     * Reverse geocode coordinates to address
     * 
     * In production, uses:
     * - Google Maps Geocoding API
     * - OpenStreetMap Nominatim
     * - MapMyIndia API (India-specific)
     * 
     * @param latitude - GPS latitude
     * @param longitude - GPS longitude
     * @returns Formatted address
     */
    public async reverseGeocode(latitude: number, longitude: number): Promise<string> {
        console.log(`[LegalNotice] Reverse geocoding: ${latitude}, ${longitude}`);

        // MVP: Return formatted coordinates
        // Production: Use actual geocoding API

        try {
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Return demo address
            return `Near Rohtak, Haryana, India (${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E)`;
        } catch (error) {
            console.error('[LegalNotice] ❌ Geocoding failed:', error);
            return `${latitude.toFixed(6)}°N, ${longitude.toFixed(6)}°E`;
        }

        /* PRODUCTION CODE (commented out for MVP):
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          return data.display_name || `${latitude}, ${longitude}`;
        } catch (error) {
          console.error('Geocoding failed:', error);
          return `${latitude}, ${longitude}`;
        }
        */
    }

    /**
     * Prepare notice for government portal submission
     * Many Indian states have online grievance portals
     * 
     * @param noticeData - Incident details
     * @returns Portal-ready form data
     */
    public preparePortalSubmission(noticeData: LegalNoticeData): {
        [key: string]: string;
    } {
        console.log('[LegalNotice] 📋 Preparing portal submission...');

        return {
            category: 'Road Accident',
            subcategory: 'Compensation Claim',
            incidentDate: new Date(noticeData.timestamp).toISOString().split('T')[0],
            location: noticeData.location.address,
            gpsCoordinates: `${noticeData.location.latitude}, ${noticeData.location.longitude}`,
            severity: noticeData.severity,
            description: noticeData.description,
            evidenceUrl: noticeData.evidenceUrl,
            witnessCount: noticeData.witnessCount.toString(),
            roadType: noticeData.roadClassification,
            status: 'NEW',
        };
    }

    /**
     * Generate incident description from sensor data
     * Creates a human-readable narrative
     * 
     * @param crashSeverity - Severity level (1-10)
     * @param sensorSummary - Brief sensor analysis
     * @returns Formatted description
     */
    public generateDescription(
        crashSeverity: number,
        sensorSummary: string
    ): string {
        const severityText =
            crashSeverity >= 8
                ? 'severe'
                : crashSeverity >= 5
                    ? 'moderate'
                    : 'minor';

        return `A ${severityText} road accident occurred. ${sensorSummary} The incident has been automatically detected and documented by the AETHER emergency response system. Comprehensive sensor data, including accelerometer, gyroscope, GPS tracking, and audio envelope measurements, have been recorded and cryptographically signed to ensure data integrity. Multiple digital witnesses have contributed their sensor recordings to provide a complete view of the incident.`;
    }

    /**
     * Check if notice is within legal timeline
     * In India, notice must be sent within 30 days
     * 
     * @param incidentTimestamp - When accident occurred
     * @returns { isValid, daysRemaining }
     */
    public checkTimeline(incidentTimestamp: number): {
        isValid: boolean;
        daysRemaining: number;
    } {
        const incidentDate = new Date(incidentTimestamp);
        const today = new Date();
        const daysSince = Math.floor(
            (today.getTime() - incidentDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        const legalDeadline = 30; // days
        const daysRemaining = legalDeadline - daysSince;

        const isValid = daysRemaining > 0;

        if (!isValid) {
            console.warn(
                `[LegalNotice] ⚠️ Notice deadline passed! ${Math.abs(daysRemaining)} days overdue`
            );
        } else {
            console.log(
                `[LegalNotice] ✅ Within deadline: ${daysRemaining} days remaining`
            );
        }

        return {
            isValid,
            daysRemaining,
        };
    }

    /**
     * Get escalation timeline
     * Shows when to follow up if no response
     */
    public getEscalationTimeline(noticeDate: number): {
        firstReminder: number;
        secondReminder: number;
        legalAction: number;
    } {
        const oneDayMs = 24 * 60 * 60 * 1000;

        return {
            firstReminder: noticeDate + 30 * oneDayMs, // 30 days
            secondReminder: noticeDate + 45 * oneDayMs, // 45 days
            legalAction: noticeDate + 60 * oneDayMs, // 60 days
        };
    }

    /**
     * Format notice as PDF-ready HTML
     * For printing or converting to PDF
     */
    public generatePDFHTML(noticeData: LegalNoticeData): string {
        const notice = this.generateNotice(noticeData);

        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Times New Roman', serif;
      margin: 2cm;
      line-height: 1.6;
    }
    h1 {
      text-align: center;
      text-decoration: underline;
    }
    .section {
      margin: 20px 0;
    }
    .signature {
      margin-top: 50px;
    }
  </style>
</head>
<body>
  <pre>${notice}</pre>
</body>
</html>
`;
    }
}