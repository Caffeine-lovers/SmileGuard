import { describe, it, expect } from "vitest";
import { buildScanPath, formatCondition, summarizeFindings } from "@/lib/scanUtils";
import { MAX_DOCUMENT_BYTES, formatBytes, safeFileName, validateDocumentFile } from "@/lib/documentUtils";

const PATIENT = "11111111-1111-1111-1111-111111111111";

describe("buildScanPath() — scans are never overwritten", () => {
  it("stores scans in the patient's own folder (matches the storage RLS policy)", () => {
    const path = buildScanPath(PATIENT, new Date("2026-11-01T10:00:00Z"));
    expect(path.split("/")[0]).toBe(PATIENT);
    expect(path.endsWith("_xai.jpg")).toBe(true);
  });

  it("does not use the patient's name (two 'Juan Dela Cruz' accounts used to collide)", () => {
    expect(buildScanPath(PATIENT)).not.toMatch(/Juan|Dela|Cruz/);
  });

  it("produces a different path for every scan, even in the same millisecond", () => {
    const now = new Date();
    const paths = new Set(Array.from({ length: 50 }, () => buildScanPath(PATIENT, now)));
    expect(paths.size).toBe(50);
  });
});

describe("summarizeFindings()", () => {
  const det = (class_name: string, confidence: number) => ({ class_id: 0, class_name, confidence, bbox_xyxy: [], bbox_xywhn: [] });

  it("lists each condition once, highest confidence first", () => {
    expect(summarizeFindings([det("calculus", 0.4), det("dental_caries", 0.9), det("calculus", 0.7)])).toEqual([
      "Dental caries",
      "Calculus",
    ]);
  });

  it("returns an empty list for a clean scan", () => {
    expect(summarizeFindings([])).toEqual([]);
  });

  it("formats class names for people", () => {
    expect(formatCondition("tooth_discoloration")).toBe("Tooth discoloration");
  });
});

describe("validateDocumentFile()", () => {
  it.each(["application/pdf", "image/jpeg", "image/png", "image/webp"])("accepts %s", (type) => {
    expect(validateDocumentFile({ type, size: 1000 })).toBeNull();
  });

  it.each(["application/x-msdownload", "text/html", "image/svg+xml", ""])("rejects %s", (type) => {
    expect(validateDocumentFile({ type, size: 1000 })).not.toBeNull();
  });

  it("rejects files over 10 MB and empty files", () => {
    expect(validateDocumentFile({ type: "application/pdf", size: MAX_DOCUMENT_BYTES + 1 })).not.toBeNull();
    expect(validateDocumentFile({ type: "application/pdf", size: MAX_DOCUMENT_BYTES })).toBeNull();
    expect(validateDocumentFile({ type: "application/pdf", size: 0 })).not.toBeNull();
  });
});

describe("safeFileName()", () => {
  it("strips path traversal and unsafe characters", () => {
    const name = safeFileName("../../other-patient/x ray (1).pdf");
    expect(name).not.toContain("/");
    expect(name).not.toContain(" ");
    expect(name.endsWith(".pdf")).toBe(true);
  });

  it("never returns an empty name", () => {
    expect(safeFileName("")).toBe("document");
  });
});

describe("formatBytes()", () => {
  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
    expect(formatBytes(null)).toBe("—");
  });
});
