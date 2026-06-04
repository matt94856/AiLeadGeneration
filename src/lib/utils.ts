import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhysicianName(first: string, last: string): string {
  return `Dr. ${first} ${last}`;
}

export function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
