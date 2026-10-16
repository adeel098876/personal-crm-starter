import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "··";
}

export function formatAgo(dateStr?: string | Date) {
  if (!dateStr) return "recently";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "recently" : formatDistanceToNow(d, { addSuffix: true });
}
