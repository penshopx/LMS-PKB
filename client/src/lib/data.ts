import type { CompetencyLevelType } from "@shared/schema";

// Competency level names (Indonesian)
export const CompetencyLevelNames: Record<CompetencyLevelType, string> = {
  L1: "Awareness",
  L2: "Application", 
  L3: "Mastery",
  L4: "Strategic"
};

// Competency level descriptions
export const CompetencyLevelDescriptions: Record<CompetencyLevelType, string> = {
  L1: "Memahami konsep dasar dan mampu mengenali situasi relevan",
  L2: "Menerapkan pengetahuan dalam konteks kerja dengan bimbingan",
  L3: "Menguasai dan mampu mengajar/mentoring kepada orang lain",
  L4: "Mampu membuat kebijakan dan memimpin inisiatif strategis"
};

// Helper functions for styling
export function getLevelColor(level: string): string {
  switch (level) {
    case "L1": return "bg-sky-200 text-sky-800 dark:bg-sky-900 dark:text-sky-200";
    case "L2": return "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "L3": return "bg-teal-200 text-teal-800 dark:bg-teal-900 dark:text-teal-200";
    case "L4": return "bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    default: return "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "achieved": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "on_track": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "gap": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "achieved": return "Tercapai";
    case "on_track": return "Sesuai Jalur";
    case "gap": return "Gap";
    default: return status;
  }
}

export function getLessonTypeLabel(type: string): string {
  switch (type) {
    case "orientation": return "Orientasi";
    case "context": return "Konteks";
    case "microlearning": return "Micro Learning";
    case "practice": return "Praktik";
    case "assessment": return "Asesmen";
    case "reflection": return "Refleksi";
    default: return type;
  }
}
