// Profile categories: purely a way to organise the Home screen.
// Decaid has no profile tags yet, so they live in its key-value store under
// flimsydecaid/categories. Profiles are referenced by lineage root id.

export const CATEGORIES_KEY = 'categories';

export interface Category {
  id: string;
  name: string;
  /** Emoji or short glyph shown on the big Home button. */
  icon?: string;
  /** Accent colour token name, see src/styles.css (--cat-1 … --cat-8). */
  colour?: number;
  /** Profile lineage root ids, in display order. */
  profiles: string[];
}

export interface CategoryDoc {
  version: 1;
  categories: Category[];
}

export const emptyCategories = (): CategoryDoc => ({ version: 1, categories: [] });

export function parseCategories(raw: unknown): CategoryDoc {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as CategoryDoc).categories)) {
    return emptyCategories();
  }
  const categories = (raw as CategoryDoc).categories
    .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string')
    .map((c) => ({ ...c, profiles: Array.isArray(c.profiles) ? c.profiles.filter((p) => typeof p === 'string') : [] }));
  return { version: 1, categories };
}

export function newCategoryId(): string {
  return `cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function toggleProfile(doc: CategoryDoc, categoryId: string, profileRoot: string): CategoryDoc {
  return {
    ...doc,
    categories: doc.categories.map((c) => {
      if (c.id !== categoryId) return c;
      const has = c.profiles.includes(profileRoot);
      return { ...c, profiles: has ? c.profiles.filter((p) => p !== profileRoot) : [...c.profiles, profileRoot] };
    }),
  };
}

export function categoriesFor(doc: CategoryDoc, profileRoot: string): Category[] {
  return doc.categories.filter((c) => c.profiles.includes(profileRoot));
}
