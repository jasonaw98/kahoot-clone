import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Database {
  public: {
    Tables: {
      games: {
        Row: {
          id: string;
          status: "waiting" | "active" | "finished";
          current_question: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          status?: "waiting" | "active" | "finished";
          current_question?: number;
        };
        Update: {
          status?: "waiting" | "active" | "finished";
          current_question?: number;
          updated_at?: string;
        };
      };
      players: {
        Row: {
          id: string;
          game_id: string;
          name: string;
          score: number;
          joined_at: string;
        };
        Insert: {
          game_id: string;
          name: string;
          score?: number;
        };
        Update: {
          score?: number;
        };
      };
      questions: {
        Row: {
          id: string;
          game_id: string;
          question_text: string;
          options: string[];
          correct_answer: number;
          time_limit: number;
          order_index: number;
        };
        Insert: {
          game_id: string;
          question_text: string;
          options: string[];
          correct_answer: number;
          time_limit?: number;
          order_index: number;
        };
      };
      answers: {
        Row: {
          id: string;
          player_id: string;
          question_id: string;
          selected_answer: number;
          response_time: number;
          points_earned: number;
          answered_at: string;
        };
        Insert: {
          player_id: string;
          question_id: string;
          selected_answer: number;
          response_time: number;
          points_earned?: number;
        };
      };
    };
  };
}
