// Hand-written to mirror supabase/schema.sql. Regenerate with `supabase gen types typescript`
// once you have the Supabase CLI linked to your project, if you want it kept perfectly in sync.
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; name: string; email: string; avatar_color: string; updated_at: string };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
        Relationships: [];
      };
      settings: {
        Row: {
          user_id: string;
          default_snooze_minutes: number;
          default_alarm_enabled: boolean;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['settings']['Row']> & { user_id: string };
        Update: Partial<Database['public']['Tables']['settings']['Row']>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string;
          date: string;
          time: string;
          repeat: 'once' | 'daily' | 'weekly' | 'hourly';
          weekdays: number[];
          interval_hours: number;
          alarm_enabled: boolean;
          completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['tasks']['Row']> & {
          user_id: string;
          title: string;
        };
        Update: Partial<Database['public']['Tables']['tasks']['Row']>;
        Relationships: [];
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          expo_push_token: string;
          device_name: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['push_tokens']['Row']> & {
          user_id: string;
          expo_push_token: string;
        };
        Update: Partial<Database['public']['Tables']['push_tokens']['Row']>;
        Relationships: [];
      };
      task_shares: {
        Row: {
          id: string;
          task_id: string;
          owner_id: string;
          shared_with_user_id: string;
          shared_with_email: string;
          permission: 'read' | 'edit';
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['task_shares']['Row']> & {
          task_id: string;
          owner_id: string;
          shared_with_user_id: string;
          shared_with_email: string;
        };
        Update: Partial<Database['public']['Tables']['task_shares']['Row']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      share_task_with_email: {
        Args: { p_task_id: string; p_email: string; p_permission?: string };
        Returns: undefined;
      };
      list_task_shares: {
        Args: { p_task_id: string };
        Returns: {
          id: string;
          shared_with_user_id: string;
          shared_with_email: string;
          permission: string;
        }[];
      };
      is_tasky_cron_authorized: {
        Args: { p_secret: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
