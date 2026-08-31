import { test } from "node:test";
import assert from "node:assert/strict";
import { toCSV, parseCSV } from "../lib/csv.ts";

test("toCSV escapes commas, quotes, newlines", () => {
  const csv = toCSV([{ a: "hi, there", b: 'say "yes"', c: "line1\nline2" }]);
  assert.equal(csv, 'a,b,c\n"hi, there","say ""yes""","line1\nline2"');
});

test("parseCSV handles quotes and embedded delimiters", () => {
  const { headers, rows } = parseCSV('name,amount\n"Dinner, big",899\n"He said ""hi""",50');
  assert.deepEqual(headers, ["name", "amount"]);
  assert.deepEqual(rows, [["Dinner, big", "899"], ['He said "hi"', "50"]]);
});

test("round-trips", () => {
  const data = [
    { date: "2026-08-01", name: "Zomato, dinner", amount: "899.50" },
    { date: "2026-08-02", name: 'quote " here', amount: "12" },
  ];
  const parsed = parseCSV(toCSV(data));
  assert.deepEqual(parsed.headers, ["date", "name", "amount"]);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0][1], "Zomato, dinner");
  assert.equal(parsed.rows[1][1], 'quote " here');
});

test("ignores blank trailing lines", () => {
  const { rows } = parseCSV("a,b\n1,2\n\n");
  assert.equal(rows.length, 1);
});
