import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines conditional class names and intelligently merges
 * conflicting Tailwind CSS utility classes.
 *
 * Example:
 * cn(
 *   "px-4 py-2",
 *   isActive && "bg-blue-600 text-white",
 *   className
 * )
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default cn;