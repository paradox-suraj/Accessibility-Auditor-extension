import axe from 'axe-core';

// WCAG 2.2 A and AA Success Criteria
export type WcagCriterion = {
  id: string; // e.g., "1.1.1"
  name: string; // e.g., "Non-text Content"
  level: "A" | "AA";
  axeTag: string; // e.g., "wcag111"
};

export const WCAG_2_2_CATALOG: WcagCriterion[] = [
  // Principle 1: Perceivable
  { id: "1.1.1", name: "Non-text Content", level: "A", axeTag: "wcag111" },
  { id: "1.2.1", name: "Audio-only and Video-only (Prerecorded)", level: "A", axeTag: "wcag121" },
  { id: "1.2.2", name: "Captions (Prerecorded)", level: "A", axeTag: "wcag122" },
  { id: "1.2.3", name: "Audio Description or Media Alternative (Prerecorded)", level: "A", axeTag: "wcag123" },
  { id: "1.2.4", name: "Captions (Live)", level: "AA", axeTag: "wcag124" },
  { id: "1.2.5", name: "Audio Description (Prerecorded)", level: "AA", axeTag: "wcag125" },
  { id: "1.3.1", name: "Info and Relationships", level: "A", axeTag: "wcag131" },
  { id: "1.3.2", name: "Meaningful Sequence", level: "A", axeTag: "wcag132" },
  { id: "1.3.3", name: "Sensory Characteristics", level: "A", axeTag: "wcag133" },
  { id: "1.3.4", name: "Orientation", level: "AA", axeTag: "wcag134" },
  { id: "1.3.5", name: "Identify Input Purpose", level: "AA", axeTag: "wcag135" },
  { id: "1.4.1", name: "Use of Color", level: "A", axeTag: "wcag141" },
  { id: "1.4.2", name: "Audio Control", level: "A", axeTag: "wcag142" },
  { id: "1.4.3", name: "Contrast (Minimum)", level: "AA", axeTag: "wcag143" },
  { id: "1.4.4", name: "Resize text", level: "AA", axeTag: "wcag144" },
  { id: "1.4.5", name: "Images of Text", level: "AA", axeTag: "wcag145" },
  { id: "1.4.10", name: "Reflow", level: "AA", axeTag: "wcag1410" },
  { id: "1.4.11", name: "Non-text Contrast", level: "AA", axeTag: "wcag1411" },
  { id: "1.4.12", name: "Text Spacing", level: "AA", axeTag: "wcag1412" },
  { id: "1.4.13", name: "Content on Hover or Focus", level: "AA", axeTag: "wcag1413" },

  // Principle 2: Operable
  { id: "2.1.1", name: "Keyboard", level: "A", axeTag: "wcag211" },
  { id: "2.1.2", name: "No Keyboard Trap", level: "A", axeTag: "wcag212" },
  { id: "2.1.4", name: "Character Key Shortcuts", level: "A", axeTag: "wcag214" },
  { id: "2.2.1", name: "Timing Adjustable", level: "A", axeTag: "wcag221" },
  { id: "2.2.2", name: "Pause, Stop, Hide", level: "A", axeTag: "wcag222" },
  { id: "2.3.1", name: "Three Flashes or Below Threshold", level: "A", axeTag: "wcag231" },
  { id: "2.4.1", name: "Bypass Blocks", level: "A", axeTag: "wcag241" },
  { id: "2.4.2", name: "Page Titled", level: "A", axeTag: "wcag242" },
  { id: "2.4.3", name: "Focus Order", level: "A", axeTag: "wcag243" },
  { id: "2.4.4", name: "Link Purpose (In Context)", level: "A", axeTag: "wcag244" },
  { id: "2.4.5", name: "Multiple Ways", level: "AA", axeTag: "wcag245" },
  { id: "2.4.6", name: "Headings and Labels", level: "AA", axeTag: "wcag246" },
  { id: "2.4.7", name: "Focus Visible", level: "AA", axeTag: "wcag247" },
  { id: "2.4.11", name: "Focus Not Obscured (Minimum)", level: "AA", axeTag: "wcag2411" },
  { id: "2.5.1", name: "Pointer Gestures", level: "A", axeTag: "wcag251" },
  { id: "2.5.2", name: "Pointer Cancellation", level: "A", axeTag: "wcag252" },
  { id: "2.5.3", name: "Label in Name", level: "A", axeTag: "wcag253" },
  { id: "2.5.4", name: "Motion Actuation", level: "A", axeTag: "wcag254" },
  { id: "2.5.7", name: "Dragging Movements", level: "AA", axeTag: "wcag257" },
  { id: "2.5.8", name: "Target Size (Minimum)", level: "AA", axeTag: "wcag258" },

  // Principle 3: Understandable
  { id: "3.1.1", name: "Language of Page", level: "A", axeTag: "wcag311" },
  { id: "3.1.2", name: "Language of Parts", level: "AA", axeTag: "wcag312" },
  { id: "3.2.1", name: "On Focus", level: "A", axeTag: "wcag321" },
  { id: "3.2.2", name: "On Input", level: "A", axeTag: "wcag322" },
  { id: "3.2.3", name: "Consistent Navigation", level: "AA", axeTag: "wcag323" },
  { id: "3.2.4", name: "Consistent Identification", level: "AA", axeTag: "wcag324" },
  { id: "3.2.6", name: "Consistent Help", level: "A", axeTag: "wcag326" },
  { id: "3.3.1", name: "Error Identification", level: "A", axeTag: "wcag331" },
  { id: "3.3.2", name: "Labels or Instructions", level: "A", axeTag: "wcag332" },
  { id: "3.3.3", name: "Error Suggestion", level: "AA", axeTag: "wcag333" },
  { id: "3.3.4", name: "Error Prevention (Legal, Financial, Data)", level: "AA", axeTag: "wcag334" },
  { id: "3.3.7", name: "Redundant Entry", level: "A", axeTag: "wcag337" },
  { id: "3.3.8", name: "Accessible Authentication (Minimum)", level: "AA", axeTag: "wcag338" },

  // Principle 4: Robust
  { id: "4.1.2", name: "Name, Role, Value", level: "A", axeTag: "wcag412" },
  { id: "4.1.3", name: "Status Messages", level: "AA", axeTag: "wcag413" },
];

export function getAxeWcagCoverage(): Set<string> {
  try {
    const rules = axe.getRules ? axe.getRules() : [];
    const coveredTags = new Set<string>();

    for (const rule of rules) {
      if (rule.tags) {
        for (const tag of rule.tags) {
          if (tag.startsWith("wcag")) {
            coveredTags.add(tag);
          }
        }
      }
    }
    return coveredTags;
  } catch {
    // Fallback if axe.getRules() is called in an environment without DOM
    return new Set<string>([
      "wcag111", "wcag121", "wcag122", "wcag131", "wcag132", "wcag134", "wcag135",
      "wcag141", "wcag142", "wcag143", "wcag144", "wcag1410", "wcag1411", "wcag1412",
      "wcag211", "wcag212", "wcag221", "wcag222", "wcag241", "wcag242", "wcag244",
      "wcag246", "wcag247", "wcag253", "wcag257", "wcag258", "wcag311", "wcag312",
      "wcag321", "wcag322", "wcag331", "wcag332", "wcag337", "wcag338", "wcag412"
    ]);
  }
}

export type ConformanceStatus = 
  | "Supports"
  | "Partially Supports"
  | "Does Not Support"
  | "Not Evaluated";

export type ConformanceEvaluation = {
  criterion: WcagCriterion;
  status: ConformanceStatus;
  remarks: string;
};

export function evaluateConformance(
  findings: Array<{ wcagCriterion: string; ruleId: string; pageUrl?: string }>,
  pageCount: number
): ConformanceEvaluation[] {
  const coveredTags = getAxeWcagCoverage();
  
  return WCAG_2_2_CATALOG.map((criterion) => {
    const isEvaluated = coveredTags.has(criterion.axeTag);

    if (!isEvaluated) {
      return {
        criterion,
        status: "Not Evaluated",
        remarks: "Not automatable — requires manual testing (e.g. a screen-reader walkthrough or cognitive-load review).",
      };
    }

    const matchingViolations = findings.filter(
      (v) => v.wcagCriterion.toLowerCase() === criterion.axeTag.toLowerCase()
    );

    if (matchingViolations.length > 0) {
      const uniqueRuleIds = Array.from(new Set(matchingViolations.map((v) => v.ruleId)));
      return {
        criterion,
        status: "Does Not Support",
        remarks: `Failed automated check. Rule(s) triggered: ${uniqueRuleIds.join(", ")}. Violations found across ${matchingViolations.length} occurrences in the scanned pages.`,
      };
    }

    return {
      criterion,
      status: "Supports",
      remarks: `Automated testing found zero violations across the ${pageCount} scanned page(s). Note: Automated testing covers ~30–40% of WCAG criteria; manual verification recommended for complete conformance.`,
    };
  });
}
