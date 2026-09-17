export type Database = {
  public: {
    Tables: {
      locations: {
        Row: {
          id: string;
          name: string;
          color_code: string;
          latitude: number;
          longitude: number;
          radius: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color_code: string;
          latitude: number;
          longitude: number;
          radius?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color_code?: string;
          latitude?: number;
          longitude?: number;
          radius?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      work_logs: {
        Row: {
          id: string;
          user_id: string;
          location_id: string;
          start_time: string;
          end_time: string | null;
          duration_minutes: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          location_id: string;
          start_time: string;
          end_time?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          location_id?: string;
          start_time?: string;
          end_time?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_weekly_summary: {
        Args: { p_user_id: string; p_start_date: string };
        Returns: {
          location_id: string;
          location_name: string;
          color_code: string;
          total_minutes: number;
          week_total_minutes: number;
          target_minutes: number;
          percent_of_location: number | null;
          percent_of_target: number | null;
          overtime_minutes: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type LocationRow = Database['public']['Tables']['locations']['Row'];
export type WorkLogRow = Database['public']['Tables']['work_logs']['Row'];
export type WorkLogInsert = Database['public']['Tables']['work_logs']['Insert'];
export type WeeklySummaryRow = Database['public']['Functions']['get_weekly_summary']['Returns'][number];
