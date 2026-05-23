export type HomepageType = "company_intro" | "product";
export type ContentDensity = "compact" | "standard" | "rich";
export type SectionId =
  | "hero"
  | "company_summary"
  | "company_intro"
  | "core_strengths"
  | "contact_info"
  | "history"
  | "portfolio"
  | "featured_products"
  | "product_area"
  | "product_registration_cta"
  | "contact_cta";
export type SectionLayout = Partial<Record<SectionId, string>>;
export type DesignTokens = {
  primary?: string;
  accent?: string;
  radius?: "none" | "sm" | "md" | "lg";
};
export type BlockOverride = {
  emphasis?: "default" | "strong";
};

export const homepageTypes: HomepageType[];
export const contentDensities: ContentDensity[];
export const sectionIds: SectionId[];
export const requiredVisibleSections: SectionId[];
export const allowedVisibilitySections: SectionId[];
export const allowedLayouts: Record<string, string[]>;
export const defaultSectionLayout: Record<HomepageType, Record<string, string>>;
export const allowedDesignColors: string[];
export const defaultDesignTokens: Required<DesignTokens>;
export const allowedRadii: Array<Required<DesignTokens>["radius"]>;
export const allowedBlockEmphasis: Array<Required<BlockOverride>["emphasis"]>;
export const forbiddenPhrases: string[];

export function isHomepageType(value: unknown): value is HomepageType;
export function isContentDensity(value: unknown): value is ContentDensity;
export function isAllowedVisibilitySection(value: unknown): value is SectionId;
export function isRequiredVisibleSection(value: unknown): value is SectionId;
export function isSectionId(value: unknown): value is SectionId;
export function isAllowedLayout(section: string, value: unknown): boolean;
export function hasForbiddenPhrase(value: unknown): boolean;
export function defaultSectionOrder(model: { homepageType?: HomepageType; homepage_type?: HomepageType }): SectionId[];
export function normalizeDesignTokens(value: unknown): DesignTokens;
export function normalizeSectionOrder(value: unknown, homepageType: HomepageType): SectionId[];
export function resolveSectionOrder(value: unknown, homepageType: HomepageType): SectionId[];
export function normalizeBlockOverrides(value: unknown): Partial<Record<SectionId, BlockOverride>>;
export function normalizeSectionVisibility(
  value: unknown,
  sectionHasData?: (section: string) => boolean,
): Record<string, boolean>;
export function normalizeSectionLayout(value: unknown): Record<string, string>;
