import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Clamp `value` into [min, max]; min wins if the range is inverted. */
export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}
