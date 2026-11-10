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

// Each case has its own order; the prepared record copies it except for
// `override` (brief §5). Discrepancy counts run 0, 1, 2, 0, 1, 2, so players
// cannot learn "every case has exactly one error" or a field-by-field
// sequence. Scoring (src/scoring.mjs) derives mismatchFields from
// Object.keys(override), so any count from 0 to 5 is supported without
// special-casing.
const CASES = [
  {
    order: {
      patient: "SIM-014",
      medicine: "Training Medicine A",
      dose: "0.5 training units",
      route: "Oral (by mouth)",
      time: "09:00",
    },
    override: {},
    teachingPoint: "Checking does not mean there must always be a discrepancy.",
  },
  {
    order: {
      patient: "SIM-022",
      medicine: "Training Medicine B",
      dose: "2 training units",
      route: "Oral (by mouth)",
      time: "13:00",
    },
    override: { dose: "0.2 training units" },
    teachingPoint: "A misplaced decimal point makes a tenfold difference in these fictional values.",
  },
  {
    order: {
      patient: "SIM-037",
      medicine: "Training Medicine C",
      dose: "1 training unit",
      route: "Intravenous (into a vein)",
      time: "08:00",
    },
    override: { patient: "SIM-073", time: "20:00" },
    teachingPoint: "Finding one discrepancy does not end the check: this record had two.",
  },
  {
    order: {
      patient: "SIM-048",
      medicine: "Training Medicine D",
      dose: "2.5 training units",
      route: "Intravenous (into a vein)",
      time: "18:00",
    },
    override: {},
    teachingPoint: "Expecting a problem after a run of errors is not evidence of one.",
  },
  {
    order: {
      patient: "SIM-051",
      medicine: "Training Medicine E",
      dose: "10 training units",
      route: "Oral (by mouth)",
      time: "06:00",
    },
    override: { route: "Intravenous (into a vein)" },
    teachingPoint: "Compare the stated routes; this does not establish the right route for a real medicine.",
  },
  {
    order: {
      patient: "SIM-066",
      medicine: "Training Medicine F",
      dose: "5 training units",
      route: "Oral (by mouth)",
      time: "22:00",
    },
    override: { medicine: "Training Medicine E", dose: "15 training units" },
    teachingPoint: "Two checkers can each catch a different problem; together is not the same as each check being complete.",
  },
];

// A frozen, server-only snapshot for round N (1-indexed). This is what gets
// stored verbatim in rounds.case_data so history never changes when this
// module is edited later (brief §5).
export function caseSnapshot(index) {
  const i = index - 1;
  if (i < 0 || i >= CASES.length) {
    throw new RangeError(`no case at index ${index}`);
  }
  const { order, override, teachingPoint } = CASES[i];
  return {
    id: `Case ${index}`,
    order: { ...order },
    prepared: { ...order, ...override },
    mismatchFields: Object.keys(override),
    teachingPoint,
  };
}

export const CASE_COUNT = CASES.length;
