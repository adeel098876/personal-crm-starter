// Minimal vCard 2.1 / 3.0 / 4.0 parser.
// Handles line unfolding, quoted-printable, and the common fields we care about.

export interface ParsedContact {
  external_id?: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  birthday?: string;
  notes?: string;
  address?: string;
  raw?: Record<string, string[]>;
}

function unfold(text: string): string[] {
  // vCard line folding: a line starting with space/tab continues previous line.
  const rawLines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of rawLines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      out[out.length - 1] = (out[out.length - 1] ?? "") + line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function decodeQP(value: string): string {
  try {
    return value.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  } catch {
    return value;
  }
}

function parseLine(
  line: string,
): { name: string; params: Record<string, string>; value: string } | null {
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return null;
  const head = line.slice(0, colonIdx);
  let value = line.slice(colonIdx + 1);
  const parts = head.split(";");
  const name = parts[0].toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    const eq = p.indexOf("=");
    if (eq === -1) params[p.toUpperCase()] = "true";
    else params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  }
  if ((params.ENCODING ?? "").toUpperCase() === "QUOTED-PRINTABLE") {
    value = decodeQP(value);
  }
  return { name, params, value };
}

export function parseVCards(text: string): ParsedContact[] {
  const lines = unfold(text);
  const contacts: ParsedContact[] = [];
  let current: ParsedContact | null = null;
  let raw: Record<string, string[]> = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.toUpperCase().startsWith("BEGIN:VCARD")) {
      current = { name: "" };
      raw = {};
      continue;
    }
    if (line.toUpperCase().startsWith("END:VCARD")) {
      if (current && current.name) {
        current.raw = raw;
        contacts.push(current);
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const parsed = parseLine(line);
    if (!parsed) continue;
    const { name, value } = parsed;
    (raw[name] ||= []).push(value);

    switch (name) {
      case "FN":
        if (!current.name) current.name = value.trim();
        break;
      case "N": {
        // N: Family;Given;Additional;Prefix;Suffix
        const parts = value.split(";");
        current.last_name = parts[0]?.trim() || undefined;
        current.first_name = parts[1]?.trim() || undefined;
        if (!current.name) {
          const composed = [current.first_name, current.last_name].filter(Boolean).join(" ");
          if (composed) current.name = composed;
        }
        break;
      }
      case "EMAIL":
        if (!current.email) current.email = value.trim();
        break;
      case "TEL":
        if (!current.phone) current.phone = value.trim();
        break;
      case "ORG":
        if (!current.company) current.company = value.split(";")[0].trim();
        break;
      case "TITLE":
        if (!current.role) current.role = value.trim();
        break;
      case "BDAY":
        current.birthday = normalizeDate(value.trim());
        break;
      case "NOTE":
        current.notes = value.trim();
        break;
      case "ADR": {
        // ADR: PO;ext;street;city;region;postal;country
        const parts = value
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length) current.address = parts.slice(2).join(", ");
        break;
      }
      case "UID":
        current.external_id = value.trim();
        break;
    }
  }

  return contacts;
}

function normalizeDate(v: string): string | undefined {
  // Accept YYYY-MM-DD or YYYYMMDD
  const clean = v.replace(/[^0-9]/g, "");
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return undefined;
}
