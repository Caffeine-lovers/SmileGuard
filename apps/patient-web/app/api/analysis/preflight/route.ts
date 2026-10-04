import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import type { PreflightCheckResult } from '@smileguard/shared-types';

const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.NEXT_PUBLIC_GEMINI_API_KEY;

const PREFLIGHT_SYSTEM_INSTRUCTION = `You are SmileGuard's Clinical Quality Control AI for Ivy King Dental Clinic.
Your sole job is to inspect patient-uploaded intraoral photographs BEFORE they are processed by our YOLOv8 dental anomaly detector.

IMPORTANT CLINICAL CONTEXT:
1. EXPECTED PATHOLOGY:
   Severely discolored teeth, dark cavities, missing teeth, plaque/tartar buildup, crooked teeth, dental crowns, and amalgam/composite fillings are EXPECTED and VALID. DO NOT reject photos because the teeth look unhealthy or decayed—that is exactly what our anomaly AI is designed to analyze!

2. STRICT CROPPING MANDATE (NO NOSE OR FACE):
   The image MUST be a tight macro close-up showing ONLY the teeth, mouth opening, lips, and gums.
   - ABSOLUTELY NO NOSE, NO NOSTRILS, NO EYES, NO CHEEKS, AND NO FULL FACE!
   - If the patient's nose, nostrils, eyes, cheeks, or upper face are visible in the frame, the photo is improperly framed and MUST BE REJECTED.
   - ONLY close-up photographs focusing strictly on the teeth and gums are accepted.

Inspect the image for four mandatory criteria:
1. TEETH VISIBILITY (has_teeth): Does the photograph show human teeth and/or gums?
   - TRUE: Close-up photos showing teeth and gums.
   - FALSE: Images with no teeth visible, closed mouth, food, pets, objects.
2. STRICT CROPPING / NO NOSE OR FACE (has_no_facial_features): Is the photo tightly framed to ONLY the teeth, mouth, and gums without any nose, nostrils, eyes, or face?
   - TRUE: Tight intraoral close-up. The nose, nostrils, eyes, and upper facial features are completely absent from the frame.
   - FALSE: A nose, nostrils, eyes, cheeks, or full face is visible in the frame.
3. ORTHODONTIC BRACES (has_braces): Are orthodontic brackets, archwires, metal bands, or dental braces affixed to the teeth?
   - TRUE: Visible metal brackets and archwires.
   - FALSE: Natural teeth, teeth with cavities/fillings/crowns, or clean clear aligners.
4. IMAGE CLARITY (is_clear): Is the photo reasonably recognizable and in focus?
   - TRUE: Normal smartphone photos of teeth where tooth shapes and surfaces are distinguishable.
   - FALSE: Extreme motion blur, pitch black darkness, or total lens glare.

DECISION MATRIX:
- If has_teeth is FALSE -> passed = false, rejection_reason = "NO_TEETH_DETECTED"
- Else if has_no_facial_features is FALSE -> passed = false, rejection_reason = "FACIAL_FEATURES_DETECTED"
- Else if has_braces is TRUE -> passed = false, rejection_reason = "BRACES_DETECTED"
- Else if is_clear is FALSE -> passed = false, rejection_reason = "IMAGE_TOO_BLURRY" or "POOR_LIGHTING"
- If has_teeth is TRUE, has_no_facial_features is TRUE, has_braces is FALSE, and is_clear is TRUE -> passed = true, rejection_reason = null

If rejected, provide warm, clinical patient feedback with:
- headline: Brief 3-5 word summary (e.g. "Crop Photo to Teeth Only", "Orthodontic Braces Detected", "No Teeth Visible")
- description: Compassionate explanation of why the scan cannot proceed
- tips: 2-3 specific, actionable steps the patient should take to capture an eligible image.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image_b64 } = body;

    if (!image_b64) {
      return NextResponse.json(
        { error: 'Missing image_b64 parameter' },
        { status: 400 }
      );
    }

    // Clean base64 string if it contains data URI prefix
    const cleanB64 = image_b64.includes(',') ? image_b64.split(',')[1] : image_b64;

    // Graceful fallback if GEMINI_API_KEY is not configured
    if (!apiKey) {
      console.warn(
        '[Preflight AI] GEMINI_API_KEY is not configured in environment variables. Falling back to permissive pass.'
      );
      const fallbackResult: PreflightCheckResult = {
        passed: true,
        has_teeth: true,
        has_no_facial_features: true,
        has_braces: false,
        is_clear: true,
        rejection_reason: null,
        patient_feedback: null,
      };
      return NextResponse.json(fallbackResult);
    }

    const ai = new GoogleGenAI({ apiKey });
    const configuredModel = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    const candidateModels = Array.from(
      new Set([
        configuredModel,
        'gemini-3.1-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-3-flash-preview',
        'gemini-3.5-flash',
        'gemini-flash-latest',
      ])
    );

    let response = null;

    for (const model of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                { text: 'Analyze this intraoral submission image against the dental quality gate criteria.' },
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: cleanB64,
                  },
                },
              ],
            },
          ],
          config: {
            systemInstruction: PREFLIGHT_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                passed: { type: Type.BOOLEAN },
                has_teeth: { type: Type.BOOLEAN },
                has_no_facial_features: { type: Type.BOOLEAN },
                has_braces: { type: Type.BOOLEAN },
                is_clear: { type: Type.BOOLEAN },
                rejection_reason: {
                  type: Type.STRING,
                  enum: [
                    'NO_TEETH_DETECTED',
                    'BRACES_DETECTED',
                    'IMAGE_TOO_BLURRY',
                    'POOR_LIGHTING',
                    'NON_DENTAL_SUBJECT',
                    'FACIAL_FEATURES_DETECTED',
                  ],
                  nullable: true,
                },
                patient_feedback: {
                  type: Type.OBJECT,
                  properties: {
                    headline: { type: Type.STRING },
                    description: { type: Type.STRING },
                    tips: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  nullable: true,
                },
              },
              required: ['passed', 'has_teeth', 'has_no_facial_features', 'has_braces', 'is_clear'],
            },
          },
        });
        if (response) {
          console.log(`[Preflight AI] Successfully screened image with model: ${model}`);
          break;
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[Preflight AI] Model ${model} unavailable (${errMsg.slice(0, 100)}), trying fallback...`);
      }
    }

    // Fail-Open Graceful Degradation: If all Gemini models hit quotas or spikes,
    // NEVER crash the patient's scan. Let them proceed directly to YOLOv8m.
    if (!response) {
      console.warn(
        '[Preflight AI] All Gemini candidate models unavailable (quota/503). Permissively passing image to primary YOLOv8 detector.'
      );
      const permissivePass: PreflightCheckResult = {
        passed: true,
        has_teeth: true,
        has_no_facial_features: true,
        has_braces: false,
        is_clear: true,
        rejection_reason: null,
        patient_feedback: null,
      };
      return NextResponse.json(permissivePass);
    }

    let rawText = response.text?.trim() || '{}';
    if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    const parsedData = JSON.parse(rawText) as PreflightCheckResult;

    console.log('[Preflight AI] Decision:', {
      passed: parsedData.passed,
      has_teeth: parsedData.has_teeth,
      has_no_facial_features: parsedData.has_no_facial_features,
      has_braces: parsedData.has_braces,
      is_clear: parsedData.is_clear,
      reason: parsedData.rejection_reason,
    });

    return NextResponse.json(parsedData);
  } catch (error) {
    console.error('[Preflight AI] Inspection failed, failing open for patient safety:', error);
    // Never block patient care due to third-party AI preflight outages
    const permissivePass: PreflightCheckResult = {
      passed: true,
      has_teeth: true,
      has_no_facial_features: true,
      has_braces: false,
      is_clear: true,
      rejection_reason: null,
      patient_feedback: null,
    };
    return NextResponse.json(permissivePass);
  }
}
