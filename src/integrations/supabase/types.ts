export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      health_snapshots: {
        Row: {
          computed_at: string;
          id: string;
          person_id: string;
          score: number;
          user_id: string;
        };
        Insert: {
          computed_at?: string;
          id?: string;
          person_id: string;
          score: number;
          user_id: string;
        };
        Update: {
          computed_at?: string;
          id?: string;
          person_id?: string;
          score?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "health_snapshots_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      import_batches: {
        Row: {
          created_at: string;
          id: string;
          source: string;
          stats: Json;
          status: string;
          total_imported: number;
          total_parsed: number;
          total_review: number;
          total_skipped: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          source: string;
          stats?: Json;
          status?: string;
          total_imported?: number;
          total_parsed?: number;
          total_review?: number;
          total_skipped?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          source?: string;
          stats?: Json;
          status?: string;
          total_imported?: number;
          total_parsed?: number;
          total_review?: number;
          total_skipped?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      interactions: {
        Row: {
          channel: string | null;
          created_at: string;
          id: string;
          location: string | null;
          metadata: Json;
          mood: string | null;
          occurred_at: string;
          person_id: string;
          summary: string | null;
          type: string;
          user_id: string;
        };
        Insert: {
          channel?: string | null;
          created_at?: string;
          id?: string;
          location?: string | null;
          metadata?: Json;
          mood?: string | null;
          occurred_at?: string;
          person_id: string;
          summary?: string | null;
          type: string;
          user_id: string;
        };
        Update: {
          channel?: string | null;
          created_at?: string;
          id?: string;
          location?: string | null;
          metadata?: Json;
          mood?: string | null;
          occurred_at?: string;
          person_id?: string;
          summary?: string | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interactions_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      notes: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          person_id: string;
          pinned: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          body?: string;
          created_at?: string;
          id?: string;
          person_id: string;
          pinned?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          person_id?: string;
          pinned?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      people: {
        Row: {
          anniversary: string | null;
          archived: boolean;
          bio: string | null;
          birthday: string | null;
          company: string | null;
          created_at: string;
          email: string | null;
          external_id: string | null;
          how_we_met: string | null;
          id: string;
          import_source: string | null;
          location: string | null;
          name: string;
          nicknames: string[];
          phone: string | null;
          photo_url: string | null;
          relationship_type: string;
          role: string | null;
          tags: string[];
          target_cadence_days: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          anniversary?: string | null;
          archived?: boolean;
          bio?: string | null;
          birthday?: string | null;
          company?: string | null;
          created_at?: string;
          email?: string | null;
          external_id?: string | null;
          how_we_met?: string | null;
          id?: string;
          import_source?: string | null;
          location?: string | null;
          name: string;
          nicknames?: string[];
          phone?: string | null;
          photo_url?: string | null;
          relationship_type?: string;
          role?: string | null;
          tags?: string[];
          target_cadence_days?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          anniversary?: string | null;
          archived?: boolean;
          bio?: string | null;
          birthday?: string | null;
          company?: string | null;
          created_at?: string;
          email?: string | null;
          external_id?: string | null;
          how_we_met?: string | null;
          id?: string;
          import_source?: string | null;
          location?: string | null;
          name?: string;
          nicknames?: string[];
          phone?: string | null;
          photo_url?: string | null;
          relationship_type?: string;
          role?: string | null;
          tags?: string[];
          target_cadence_days?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      person_fields: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          key: string;
          person_id: string;
          user_id: string;
          value: string | null;
        };
        Insert: {
          category: string;
          created_at?: string;
          id?: string;
          key: string;
          person_id: string;
          user_id: string;
          value?: string | null;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: string;
          key?: string;
          person_id?: string;
          user_id?: string;
          value?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "person_fields_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          push_enabled: boolean;
          push_quiet_hours: Json;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          push_enabled?: boolean;
          push_quiet_hours?: Json;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          push_enabled?: boolean;
          push_quiet_hours?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      promises: {
        Row: {
          completed_at: string | null;
          created_at: string;
          description: string;
          due_at: string | null;
          id: string;
          person_id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          description: string;
          due_at?: string | null;
          id?: string;
          person_id: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          description?: string;
          due_at?: string | null;
          id?: string;
          person_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promises_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          active: boolean;
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          last_used_at: string | null;
          p256dh: string;
          updated_at: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          last_used_at?: string | null;
          p256dh: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          active?: boolean;
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          last_used_at?: string | null;
          p256dh?: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      reminders: {
        Row: {
          completed_at: string | null;
          created_at: string;
          due_at: string;
          id: string;
          kind: string;
          notes: string | null;
          person_id: string | null;
          recurrence: string | null;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          due_at: string;
          id?: string;
          kind?: string;
          notes?: string | null;
          person_id?: string | null;
          recurrence?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          due_at?: string;
          id?: string;
          kind?: string;
          notes?: string | null;
          person_id?: string | null;
          recurrence?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminders_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      vapid_keys: {
        Row: {
          created_at: string;
          id: number;
          private_key: string;
          public_key: string;
          subject: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          private_key: string;
          public_key: string;
          subject?: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          private_key?: string;
          public_key?: string;
          subject?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
