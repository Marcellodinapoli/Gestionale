import type { Timestamp } from "firebase/firestore";

export type CourseDoc = {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  contents: string[];
  attachments: Array<{ url?: string; name?: string } | string>;
  videoUrl?: string;
  quiz?: {
    questions: Array<{
      question: string;
      options: string[];
      correctIndex: number;
    }>;
  };
  createdAt?: Timestamp | null;
};

export type CourseProgress = {
  courseId: string;
  title: string;
  code: string;
  category: string;
  videoViews: number;
  lastVideoDate?: Date | null;
  quizAttempts: number;
  lastQuizDate?: Date | null;
  lastScore?: number | null;
  lastQuizTime?: number | null;
  downloadCount: number;
  downloadedFiles: string[];
};

export type RoleplaySimulation = {
  id: string;
  title: string;
  category: string;
  prompt: string;
  gptPrompt: string;
  practiceData: string[];
  difficulty: string;
  personality: string;
  aiProvider?: string;
  date?: Date | null;
};
