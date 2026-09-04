export const acquisitionFields = ["api", "function", "se", "se_type", "location_code", "language_code", "device", "os", "depth"];

export function compareAcquisitionConditions(left = {}, right = {}) {
  const missing = (value) => value == null || value === "";
  const unknown = acquisitionFields.filter((field) => missing(left?.[field]) || missing(right?.[field]));
  const differing = acquisitionFields.filter((field) => !unknown.includes(field) && left[field] !== right[field]);
  return {
    differing_fields: differing,
    unknown_fields: unknown,
    listed_fields_match: unknown.length === 0 && differing.length === 0,
    semantic_equivalence_proven: false,
  };
}
