/**
 * Generated Supabase database types. Do not edit by hand.
 *
 * Regenerate after any migration with the Supabase MCP
 * (`generate_typescript_types` for project `zhivsldkpavidxzrgtjl`) or:
 *   supabase gen types typescript --project-id zhivsldkpavidxzrgtjl > lib/supabase/types.ts
 */

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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          is_admin: boolean
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          is_admin?: boolean
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_admin?: boolean
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      shares: {
        Row: {
          created_at: string
          created_by: string | null
          guest_id: string | null
          id: string
          revoked: boolean
          submission_id: string
          tierlist_id: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          guest_id?: string | null
          id?: string
          revoked?: boolean
          submission_id: string
          tierlist_id: string
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          guest_id?: string | null
          id?: string
          revoked?: boolean
          submission_id?: string
          tierlist_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shares_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shares_tierlist_id_fkey"
            columns: ["tierlist_id"]
            isOneToOne: false
            referencedRelation: "tierlists"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_items: {
        Row: {
          position: number
          submission_id: string
          tier: string
          tierlist_item_id: string
        }
        Insert: {
          position: number
          submission_id: string
          tier: string
          tierlist_item_id: string
        }
        Update: {
          position?: number
          submission_id?: string
          tier?: string
          tierlist_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_items_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_items_tierlist_item_id_fkey"
            columns: ["tierlist_item_id"]
            isOneToOne: false
            referencedRelation: "tierlist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          guest_id: string | null
          id: string
          submitted_at: string
          tierlist_id: string
          user_id: string | null
        }
        Insert: {
          guest_id?: string | null
          id?: string
          submitted_at?: string
          tierlist_id: string
          user_id?: string | null
        }
        Update: {
          guest_id?: string | null
          id?: string
          submitted_at?: string
          tierlist_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_tierlist_id_fkey"
            columns: ["tierlist_id"]
            isOneToOne: false
            referencedRelation: "tierlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tierlist_item_stats: {
        Row: {
          sum_weight: number
          tier_counts: Json
          tierlist_id: string
          tierlist_item_id: string
          total_submissions: number
          updated_at: string
        }
        Insert: {
          sum_weight?: number
          tier_counts?: Json
          tierlist_id: string
          tierlist_item_id: string
          total_submissions?: number
          updated_at?: string
        }
        Update: {
          sum_weight?: number
          tier_counts?: Json
          tierlist_id?: string
          tierlist_item_id?: string
          total_submissions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tierlist_item_stats_tierlist_id_fkey"
            columns: ["tierlist_id"]
            isOneToOne: false
            referencedRelation: "tierlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tierlist_item_stats_tierlist_item_id_fkey"
            columns: ["tierlist_item_id"]
            isOneToOne: true
            referencedRelation: "tierlist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      tierlist_items: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          label: string
          sort_order: number
          tierlist_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          label: string
          sort_order: number
          tierlist_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          label?: string
          sort_order?: number
          tierlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tierlist_items_tierlist_id_fkey"
            columns: ["tierlist_id"]
            isOneToOne: false
            referencedRelation: "tierlists"
            referencedColumns: ["id"]
          },
        ]
      }
      tierlists: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          prompt: string | null
          published_at: string | null
          release_date: string | null
          slug: string
          status: string
          tier_config: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          prompt?: string | null
          published_at?: string | null
          release_date?: string | null
          slug: string
          status?: string
          tier_config?: Json
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          prompt?: string | null
          published_at?: string | null
          release_date?: string | null
          slug?: string
          status?: string
          tier_config?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tierlists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_share: {
        Args: { p_guest_id?: string; p_submission_id: string }
        Returns: string
      }
      get_results: {
        Args: { p_guest_id?: string; p_tierlist_id: string }
        Returns: Json
      }
      get_share: {
        Args: { p_guest_id?: string; p_token: string }
        Returns: Json
      }
      submit_ranking: {
        Args: { p_guest_id?: string; p_items: Json; p_tierlist_id: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
