export type OwaspCategory = {
  id: string;
  name: string;
  description: string;
};

export const owaspCategories: OwaspCategory[] = [
  { id: "A01:2021", name: "Broken Access Control", description: "Failures in access control policies." },
  { id: "A02:2021", name: "Cryptographic Failures", description: "Failures related to cryptography and sensitive data exposure." },
  { id: "A03:2021", name: "Injection", description: "Cross-site scripting (XSS), SQL injection, etc." },
  { id: "A04:2021", name: "Insecure Design", description: "Missing or ineffective control design." },
  { id: "A05:2021", name: "Security Misconfiguration", description: "Insecure default settings, open cloud storage, misconfigured HTTP headers." },
  { id: "A06:2021", name: "Vulnerable and Outdated Components", description: "Using components with known vulnerabilities." },
  { id: "A07:2021", name: "Identification and Authentication Failures", description: "Failures in handling user identities and authentication." },
  { id: "A08:2021", name: "Software and Data Integrity Failures", description: "Code and infrastructure that does not protect against integrity violations." },
  { id: "A09:2021", name: "Security Logging and Monitoring Failures", description: "Failures to detect, escalate, and respond to active breaches." },
  { id: "A10:2021", name: "Server-Side Request Forgery (SSRF)", description: "Fetching a remote resource without validating the user-supplied URL." },
];

export type OwaspEvaluation = {
  category: OwaspCategory;
  status: "Supports" | "Partially Supports" | "Does Not Support" | "Not Evaluated";
  remarks: string;
};

// Maps specific audit rules to corresponding OWASP Top 10 categories
const RULE_TO_OWASP: Record<string, string[]> = {
  'missing-hsts': ['A02:2021', 'A05:2021'],
  'cookie-missing-secure': ['A02:2021'],
  'cookie-missing-httponly': ['A05:2021'],
  'missing-csp': ['A05:2021'],
  'missing-xcto': ['A05:2021'],
  'missing-clickjacking-protection': ['A05:2021'],
  'exposed-git': ['A01:2021', 'A05:2021'],
  'exposed-env': ['A01:2021', 'A05:2021'],
};

export function evaluateOwaspConformance(
  findings: { category: string; ruleId: string; pageUrl: string }[],
  pageCount: number
): OwaspEvaluation[] {
  return owaspCategories.map((cat) => {
    const relevantFindings = findings.filter(
      (f) =>
        RULE_TO_OWASP[f.ruleId]?.includes(cat.id) ||
        f.category.toLowerCase() === cat.id.toLowerCase() ||
        cat.name.toLowerCase().includes(f.category.toLowerCase())
    );

    if (relevantFindings.length > 0) {
      const groupedByRule = relevantFindings.reduce((acc, curr) => {
        if (!acc[curr.ruleId]) {
          acc[curr.ruleId] = {
            count: 0,
            examples: new Set<string>(),
          };
        }
        acc[curr.ruleId].count++;
        acc[curr.ruleId].examples.add(curr.pageUrl);
        return acc;
      }, {} as Record<string, { count: number; examples: Set<string> }>);

      const remarkLines = Object.entries(groupedByRule).map(([rule, data]) => {
        const urlArray = Array.from(data.examples);
        const exampleText = urlArray.slice(0, 2).join(", ") + (urlArray.length > 2 ? ` and ${urlArray.length - 2} more` : "");
        return `- ${rule} (found on ${data.count} state(s), e.g., ${exampleText})`;
      });

      return {
        category: cat,
        status: "Does Not Support",
        remarks: "Automated testing identified the following issues:\n" + remarkLines.join("\n"),
      };
    } else {
      const testedPassively = ["A01:2021", "A02:2021", "A05:2021"];

      if (testedPassively.includes(cat.id)) {
        return {
          category: cat,
          status: "Supports",
          remarks: `Automated passive scanning across ${pageCount} page(s) did not detect violations for this category. Note that passive scanning cannot detect all issues within this category.`,
        };
      } else {
        return {
          category: cat,
          status: "Not Evaluated",
          remarks: "This category cannot be fully evaluated using automated passive scanning alone.",
        };
      }
    }
  });
}
