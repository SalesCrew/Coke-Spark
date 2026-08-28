import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx-js-style";

import { buildSmQuestionnaireWorkbook } from "./smQuestionnaireExport";
import type { SmModule, SmQuestion, SmQuestionnaire, SmQuestionType } from "../../types/smQuestionnaire";

const modules: SmModule[] = [{
  id: "module-a",
  name: "Kühlregal",
  description: "SM Testmodul",
  createdAt: "2026-08-27T08:00:00.000Z",
  questions: [{
    id: "question-a",
    text: "Ist das Produkt verfügbar?",
    type: "yesnomulti",
    required: true,
    options: ["Ja", "Nein"],
    config: {
      answers: ["Ja", "Nein"],
      branches: [{ answer: "Nein", options: ["Nicht gelistet", "Ausverkauft"] }],
    },
    rules: [{
      id: "rule-a",
      triggerQuestionId: "question-a",
      operator: "equals",
      triggerValue: "Nein",
      triggerValueMax: "",
      action: "show",
      targetQuestionIds: ["question-b"],
    }],
    oos: {
      enabled: true,
      role: "detection",
      category: "softdrinks_energy",
      answerOutcomes: { Ja: "oos_absent", Nein: "oos_present" },
    },
  }, {
    id: "question-b",
    text: "Foto aufnehmen",
    type: "photo",
    required: false,
    options: [],
    config: { minPhotos: 1 },
    rules: [],
  }],
}];

const questionnaires: SmQuestionnaire[] = [{
  id: "questionnaire-a",
  name: "SM Wochencheck",
  description: "Realistische Exportprobe",
  moduleIds: ["module-a"],
  status: "active",
  version: 3,
  createdAt: "2026-08-27T09:00:00.000Z",
  nurEinmalAusfuellbar: false,
}];

test("builds the GM-aligned SM questionnaire workbook with SM-specific sheets", () => {
  const workbook = buildSmQuestionnaireWorkbook({ modules, questionnaires, exportedBy: "admin@example.test" }, XLSX);

  assert.deepEqual(workbook.SheetNames, [
    "Meta",
    "Fragen",
    "Module",
    "Fragebogen",
    "Fragebogen Module",
    "Logikregeln",
    "OOS Zuordnung",
    "Summen",
  ]);

  const questionRows = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets["Fragen"]!, { range: 3 });
  assert.equal(questionRows.length, 2);
  assert.equal(questionRows[0]?.Typ, "Ja / Nein Multi");
  assert.equal(questionRows[0]?.Pflicht, "Ja");
  assert.match(String(questionRows[0]?.Unterauswahl), /Nicht gelistet/);
  assert.match(String(questionRows[0]?.["OOS Antworten"]), /oos_present/);

  const compositionRows = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets["Fragebogen Module"]!, { range: 3 });
  assert.equal(compositionRows[0]?.Fragebogen, "SM Wochencheck");
  assert.equal(compositionRows[0]?.["Fragebogen Version"], 3);

  const serialized = XLSX.write(workbook, { bookType: "xlsx", type: "buffer", cellStyles: true });
  const reopened = XLSX.read(serialized, { type: "buffer", cellStyles: true });
  assert.deepEqual(reopened.SheetNames, workbook.SheetNames);
});

test("exports an empty workspace without losing the workbook contract", () => {
  const workbook = buildSmQuestionnaireWorkbook({ modules: [], questionnaires: [] }, XLSX);
  assert.deepEqual(workbook.SheetNames, [
    "Meta",
    "Fragen",
    "Module",
    "Fragebogen",
    "Fragebogen Module",
    "Logikregeln",
    "OOS Zuordnung",
    "Summen",
  ]);
  assert.equal(XLSX.utils.sheet_to_json(workbook.Sheets.Fragen!, { range: 3 }).length, 0);
  assert.equal(XLSX.utils.sheet_to_json(workbook.Sheets.Module!, { range: 3 }).length, 0);
});

test("keeps all ten SM question types distinguishable in the readable export", () => {
  const types: SmQuestionType[] = [
    "single",
    "yesno",
    "yesnomulti",
    "multiple",
    "likert",
    "text",
    "numeric",
    "slider",
    "photo",
    "matrix",
  ];
  const questions: SmQuestion[] = types.map((type, index) => ({
    id: `type-${type}`,
    text: `Prüffrage ${type}`,
    type,
    required: index % 2 === 0,
    options: type === "yesno" ? ["Ja", "Nein"] : [],
    config: type === "matrix"
      ? { rows: ["Zeile A"], columns: ["Spalte A"] }
      : type === "single" || type === "multiple"
        ? { options: ["Option A", "Option B"] }
        : type === "yesnomulti"
          ? { answers: ["Ja", "Nein"], branches: [{ answer: "Nein", options: ["Grund A"] }] }
          : type === "likert"
            ? { min: 1, max: 5 }
            : {},
    rules: [],
  }));
  const workbook = buildSmQuestionnaireWorkbook({
    modules: [{ id: "all-types", name: "Alle Typen", description: "", createdAt: "2026-08-27T00:00:00.000Z", questions }],
    questionnaires: [],
  }, XLSX);
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets.Fragen!, { range: 3 });
  assert.equal(rows.length, 10);
  assert.equal(new Set(rows.map((row) => row.Typ)).size, 10);
  assert.match(rows.find((row) => row.Typ === "Matrix")?.Matrix ?? "", /Zeile A/);
  assert.match(rows.find((row) => row.Typ === "Multiple Choice")?.Antwortoptionen ?? "", /Option B/);
});
