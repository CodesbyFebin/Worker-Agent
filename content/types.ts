export type PublicationStatus =
  | "planned"
  | "draft"
  | "evidence_review"
  | "approved"
  | "published"
  | "retired";

export type ReviewStatus = "draft" | "review" | "approved" | "rejected";
export type EvidenceStatus = "pending" | "verified" | "missing";
export type RenderingMode = "static-html" | "client-rendered";
export type RiskLevel = "standard" | "high";

export type EvidenceKind =
  | "product-source"
  | "official-docs"
  | "protocol-spec"
  | "risk-framework"
  | "security-guidance"
  | "implementation-source";

export interface EvidenceRef {
  id: string;
  title: string;
  url: string;
  kind: EvidenceKind;
  publisher: string;
  lastChecked: string;
  supports: string[];
}

export interface ContentRecord {
  slug: string;
  title: string;
  description: string;
  pillarId: string;
  clusterId: string;
  parentPillar: string;
  contentFile: string;
  publicationStatus: PublicationStatus;
  reviewStatus: ReviewStatus;
  evidenceStatus: EvidenceStatus;
  rendering: RenderingMode;
  riskLevel: RiskLevel;
  hasUniqueUserValue: boolean;
  canonicalUrl: string | null;
  relatedPages: string[];
  requiredEvidence: EvidenceKind[];
  evidence: EvidenceRef[];
  lastReviewed: string | null;
}
