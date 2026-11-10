// Server-only case module (brief §5). Six fixed cases, fixed order, neutral
// IDs/headings. Never serve this module, its data, or the answer key
// (mismatchFields) as a static asset or in initial HTML/GET payloads before
// reveal (brief §5, CLAUDE.md).

// Display order for the Order card and the check form (brief §5, fixed).
export const ORDER_DISPLAY = ["patient", "medicine", "dose", "route", "time"];
// Display order for the Prepared record card (brief §5, fixed, different).
export const PREPARED_DISPLAY = ["medicine", "dose", "route", "patient", "time"];

export const FIELD_LABELS = {
  patient: "Patient",
  medicine: "Medicine",
  dose: "Dose",
  route: "Route",
  time: "Scheduled time",
};

const BASE_ORDER = {
  patient: "SIM-014",
  medicine: "Training Medicine A",
  dose: "0.5 training units",
  route: "Oral (by mouth)",
  time: "09:00",
};

const OVERRIDES = [
  { override: {}, mismatchFields: [], teachingPoint: "Checking does not mean there must always be a discrepancy." },
  {
    override: { patient: "SIM-041" },
    mismatchFields: ["patient"],
    teachingPoint: "Compare the complete identifier, not its general appearance.",
  },
  {
    override: { medicine: "Training Medicine B" },
    mismatchFields: ["medicine"],
    teachingPoint: "Compare the full supplied label, not familiarity.",
  },
  {
    override: { dose: "5 training units" },
    mismatchFields: ["dose"],
    teachingPoint: "The decimal change makes a tenfold difference in these fictional training values.",
  },
  {
    override: { route: "Intravenous (into a vein)" },
    mismatchFields: ["route"],
    teachingPoint: "Compare the stated routes; this does not establish appropriate routes for a real drug.",
  },
  {
    override: { time: "21:00" },
    mismatchFields: ["time"],
    teachingPoint: "Compare scheduled record times; no clinical administration window is modelled.",
  },
];

// A frozen, server-only snapshot for round N (1-indexed). This is what gets
// stored verbatim in rounds.case_data so history never changes when this
// module is edited later (brief §5).
export function caseSnapshot(index) {
  const i = index - 1;
  if (i < 0 || i >= OVERRIDES.length) {
    throw new RangeError(`no case at index ${index}`);
  }
  const { override, mismatchFields, teachingPoint } = OVERRIDES[i];
  return {
    id: `Case ${index}`,
    order: { ...BASE_ORDER },
    prepared: { ...BASE_ORDER, ...override },
    mismatchFields,
    teachingPoint,
  };
}

export const CASE_COUNT = OVERRIDES.length;
