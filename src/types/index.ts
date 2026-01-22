import { Timestamp, FieldValue } from "firebase/firestore";
import { 
  CreateCourseInput, 
  ModuleInput, 
  LessonInput,
  SyllabusModule 
} from "@/lib/schemas/courseSchemas";


export type FirestoreDate = Timestamp | FieldValue | string | Date;

export interface Course extends CreateCourseInput {
  createdAt: FirestoreDate;
  updatedAt?: FirestoreDate;
  modulesCount: number;
  totalLessons: number;
  totalDuration: number; 
  syllabus?: SyllabusModule[];
  userProgress?: number; 
  userStatus?: "active" | "completed" | null;
  createdBy: string; 
}

export interface Module extends ModuleInput {
  id: string;
  lessons: Lesson[];
}

export interface Lesson extends LessonInput {
  id: string;
  views?: number;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: "student" | "admin" | "master";
  // 👇 ALTERAÇÃO AQUI: Adicione "| null"
  avatarUrl?: string | null; 
  
  createdAt: string | FirestoreDate;
  xp: number;
  level: number;
  wallet: {
    coins: number;
    totalCoinsEarned: number;
  };
  stats: {
    lessonsCompleted: number;
    quizzesCompleted: number;
    certificatesEarned: number;
    loginStreak: number;
  };
}

export interface Enrollment {
  id?: string; 
  userId: string;
  courseId: string;
  status: "active" | "completed";
  progress: number; 
  completedLessons: string[]; 
  completedQuizzes: string[]; 
  lastAccess: FirestoreDate;
  completedAt?: FirestoreDate;
  progressData?: {
    [lessonId: string]: {
      secondsWatched: number;
      totalDuration: number;
      lastUpdated: FirestoreDate;
    }
  };
}