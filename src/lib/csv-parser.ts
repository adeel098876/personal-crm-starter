// RFC 4180-compatible CSV parser + heuristic mapping to ParsedContact
// for both Google Contacts (google.csv) and Apple Contacts CSV exports.

import type { ParsedContact } from "./vcard-parser";

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function pick(row: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k.toLowerCase()];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

export function csvToContacts(text: string): ParsedContact[] {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());

  return rows.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ""));

    // Google Contacts CSV uses: "Name","Given Name","Family Name","E-mail 1 - Value",
    // "Phone 1 - Value","Organization 1 - Name","Organization 1 - Title","Birthday","Notes"
    // Apple Contacts CSV uses similar naming.
    const first = pick(row, ["given name", "first name", "first"]);
    const last = pick(row, ["family name", "last name", "last"]);
    const composedName =
      pick(row, ["name", "display name"]) ||
      [first, last].filter(Boolean).join(" ").trim();

    const email = pick(row, [
      "e-mail 1 - value",
      "email 1 - value",
      "email",
      "primary email",
      "e-mail address",
    ]);
    const phone = pick(row, [
      "phone 1 - value",
      "phone",
      "mobile phone",
      "primary phone",
    ]);
    const company = pick(row, [
      "organization 1 - name",
      "organization",
      "company",
    ]);
    const role = pick(row, [
      "organization 1 - title",
      "job title",
      "title",
    ]);
    const birthday = pick(row, ["birthday", "date of birth"]);
    const notes = pick(row, ["notes"]);

    return {
      name: composedName || email || phone || "Unknown",
      first_name: first,
      last_name: last,
      email,
      phone,
      company,
      role,
      birthday: normalizeDate(birthday),
      notes,
    } as ParsedContact;
  });
}

function normalizeDate(v?: string): string | undefined {
  if (!v) return undefined;
  // Google exports "1980-05-14" or "--05-14" (no year)
  const m = v.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const m2 = v.match(/^--(\d{2})-(\d{2})$/);
  if (m2) return `1900-${m2[1]}-${m2[2]}`;
  return undefined;
}