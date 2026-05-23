import type { BlockOverride, ContentDensity, DesignTokens, HomepageType, SectionId } from "./homepage-controls.mjs";

export type HomepageViewModel = {
  homepageType: HomepageType;
  companyName: string;
  industry?: string;
  businessType?: string;
  heroTitle: string;
  oneLineIntro: string;
  companyIntro: string;
  businessSummary?: string;
  coreStrengths: string[];
  tags: string[];
  contactCta: string;
  contact: Partial<Record<"address" | "phone" | "email" | "website_url", string>>;
  history: Array<{ year: string; text: string }>;
  portfolio: Array<{ title?: string; description?: string }>;
  products: Array<{ name: string; description?: string; image_url?: string }>;
  productRegistrationCta?: string;
  coverImageUrl?: string;
  sectionVisibility: Partial<Record<SectionId, boolean>>;
  sectionLayout: Partial<Record<SectionId, string>>;
  contentDensity?: ContentDensity;
  designTokens?: DesignTokens;
  sectionOrder?: SectionId[];
  blockOverrides?: Partial<Record<SectionId, BlockOverride>>;
};

export type ResolvedViewModel = HomepageViewModel & {
  contentDensity: ContentDensity;
  designTokens: Required<DesignTokens>;
  sectionOrder: SectionId[];
  blockOverrides: Partial<Record<SectionId, BlockOverride>>;
};

export function draftToViewModel(draft: any): HomepageViewModel;
export function contentToViewModel(content: any): HomepageViewModel;
export function resolveViewModel(model: HomepageViewModel): ResolvedViewModel;
