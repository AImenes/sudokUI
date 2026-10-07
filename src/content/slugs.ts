// URL slugs shared by the in-app Learn dialog and the static /learn/ pages,
// so a technique has one stable address everywhere.
import { TECHS, Tech } from '../engine/ratings';

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// A slug is a public address: once a page is live, changing its slug
// breaks every link and search result pointing at it. Slugs follow the
// display name, except where the name would make a clumsy address; the
// full map is frozen by a snapshot test (tests/content.test.ts).
const SLUG_OVERRIDES: Partial<Record<Tech, string>> = {
  X_CYCLES: 'x-cycles',
  AIC_ALS: 'aic-with-als'
};

export const techSlug = (tech: Tech): string =>
  SLUG_OVERRIDES[tech] ?? slugify(TECHS[tech].name);

const BY_SLUG = new Map<string, Tech>(
  (Object.keys(TECHS) as Tech[]).map((tech) => [techSlug(tech), tech])
);

export const techFromSlug = (slug: string): Tech | undefined => BY_SLUG.get(slug);

/** accepts a catalogue key (X_WING) or a slug (x-wing); an own key only, never "constructor" and its kin */
export const techFromParam = (param: string): Tech | undefined =>
  Object.prototype.hasOwnProperty.call(TECHS, param) ? (param as Tech) : techFromSlug(param.toLowerCase());
