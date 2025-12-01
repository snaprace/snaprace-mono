export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      event_photographers: {
        Row: {
          created_at: string
          event_id: string
          instagram_handle: string
          note: string | null
          photo_link: string
          photographer_id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          event_id: string
          instagram_handle: string
          note?: string | null
          photo_link: string
          photographer_id: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          event_id?: string
          instagram_handle?: string
          note?: string | null
          photo_link?: string
          photographer_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_photographers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_photographers_photographer_id_fkey"
            columns: ["photographer_id"]
            isOneToOne: false
            referencedRelation: "photographers"
            referencedColumns: ["photographer_id"]
          },
        ]
      }
      event_runners: {
        Row: {
          age: number | null
          age_group: string | null
          avg_pace_seconds: number | null
          bib_number: number
          chip_time_seconds: number | null
          city: string | null
          division_place: string | null
          event_distance_km: number | null
          event_distance_mi: number | null
          event_id: string
          event_slug: string | null
          first_name: string | null
          gender: string | null
          gun_time_seconds: number | null
          last_name: string | null
          overall_place: number | null
          source: string | null
          source_payload: Json | null
          start_time_seconds: number | null
          state: string | null
        }
        Insert: {
          age?: number | null
          age_group?: string | null
          avg_pace_seconds?: number | null
          bib_number: number
          chip_time_seconds?: number | null
          city?: string | null
          division_place?: string | null
          event_distance_km?: number | null
          event_distance_mi?: number | null
          event_id: string
          event_slug?: string | null
          first_name?: string | null
          gender?: string | null
          gun_time_seconds?: number | null
          last_name?: string | null
          overall_place?: number | null
          source?: string | null
          source_payload?: Json | null
          start_time_seconds?: number | null
          state?: string | null
        }
        Update: {
          age?: number | null
          age_group?: string | null
          avg_pace_seconds?: number | null
          bib_number?: number
          chip_time_seconds?: number | null
          city?: string | null
          division_place?: string | null
          event_distance_km?: number | null
          event_distance_mi?: number | null
          event_id?: string
          event_slug?: string | null
          first_name?: string | null
          gender?: string | null
          gun_time_seconds?: number | null
          last_name?: string | null
          overall_place?: number | null
          source?: string | null
          source_payload?: Json | null
          start_time_seconds?: number | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_runners_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
        ]
      }
      events: {
        Row: {
          display_mode: string
          event_date: string
          event_id: string
          event_type: string | null
          is_active: boolean
          location: string | null
          name: string
          organizer_id: string
          participant_count: number | null
          partners: Json | null
          thumbnail_image: string | null
        }
        Insert: {
          display_mode?: string
          event_date: string
          event_id: string
          event_type?: string | null
          is_active?: boolean
          location?: string | null
          name: string
          organizer_id: string
          participant_count?: number | null
          partners?: Json | null
          thumbnail_image?: string | null
        }
        Update: {
          display_mode?: string
          event_date?: string
          event_id?: string
          event_type?: string | null
          is_active?: boolean
          location?: string | null
          name?: string
          organizer_id?: string
          participant_count?: number | null
          partners?: Json | null
          thumbnail_image?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["organizer_id"]
          },
        ]
      }
      organizers: {
        Row: {
          branding_meta: Json | null
          created_at: string | null
          name: string
          organizer_id: string
          subdomain: string | null
        }
        Insert: {
          branding_meta?: Json | null
          created_at?: string | null
          name: string
          organizer_id: string
          subdomain?: string | null
        }
        Update: {
          branding_meta?: Json | null
          created_at?: string | null
          name?: string
          organizer_id?: string
          subdomain?: string | null
        }
        Relationships: []
      }
      photographers: {
        Row: {
          active: boolean
          created_at: string
          instagram_handle: string | null
          name: string
          photographer_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          instagram_handle?: string | null
          name: string
          photographer_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          instagram_handle?: string | null
          name?: string
          photographer_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      event_type: "RESULTS_AND_PHOTOS" | "PHOTOS_ONLY"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      event_type: ["RESULTS_AND_PHOTOS", "PHOTOS_ONLY"],
    },
  },
} as const
