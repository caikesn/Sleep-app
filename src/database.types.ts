/**
 * Generated from the Supabase schema. Do not edit by hand — regenerate after
 * any migration with the Supabase MCP `generate_typescript_types` tool.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.15';
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string;
          id: string;
          reminder_enabled: boolean;
          reminder_hour: number;
          reminder_minute: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          reminder_enabled?: boolean;
          reminder_hour?: number;
          reminder_minute?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          reminder_enabled?: boolean;
          reminder_hour?: number;
          reminder_minute?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      routine_steps: {
        Row: {
          id: string;
          position: number;
          routine_id: string;
          seconds: number | null;
          stretch_id: string;
        };
        Insert: {
          id?: string;
          position: number;
          routine_id: string;
          seconds?: number | null;
          stretch_id: string;
        };
        Update: {
          id?: string;
          position?: number;
          routine_id?: string;
          seconds?: number | null;
          stretch_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'routine_steps_routine_id_fkey';
            columns: ['routine_id'];
            isOneToOne: false;
            referencedRelation: 'routines';
            referencedColumns: ['id'];
          },
        ];
      };
      routines: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          completed: boolean;
          created_at: string;
          duration_seconds: number;
          ended_at: string;
          id: string;
          kind: string;
          routine_id: string | null;
          started_at: string;
          title: string | null;
          user_id: string;
        };
        Insert: {
          completed?: boolean;
          created_at?: string;
          duration_seconds: number;
          ended_at: string;
          id?: string;
          kind: string;
          routine_id?: string | null;
          started_at: string;
          title?: string | null;
          user_id: string;
        };
        Update: {
          completed?: boolean;
          created_at?: string;
          duration_seconds?: number;
          ended_at?: string;
          id?: string;
          kind?: string;
          routine_id?: string | null;
          started_at?: string;
          title?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sessions_routine_id_fkey';
            columns: ['routine_id'];
            isOneToOne: false;
            referencedRelation: 'routines';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Routine = Database['public']['Tables']['routines']['Row'];
export type RoutineStepRow = Database['public']['Tables']['routine_steps']['Row'];
export type SessionRow = Database['public']['Tables']['sessions']['Row'];
export type SessionKind = 'routine' | 'stretch' | 'meditation' | 'reading';
