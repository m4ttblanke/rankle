export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]
export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      claimed_guest_submissions: {
        Row: {
          claimed_at: string
          guest_id: string
          submission_id: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          guest_id: string
          submission_id: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          guest_id?: string
          submission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claimed_guest_submissions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claimed_guest_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          recipient_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipient_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          user_id_high: string
          user_id_low: string
        }
        Insert: {
          created_at?: string
          user_id_high: string
          user_id_low: string
        }
        Update: {
          created_at?: string
          user_id_high?: string
          user_id_low?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_user_id_high_fkey"
            columns: ["user_id_high"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_low_fkey"
            columns: ["user_id_low"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      accept_friend_request: {
        Args: { p_request_id: string }
        Returns: boolean
      }
      cancel_friend_request: {
        Args: { p_request_id: string }
        Returns: boolean
      }
      claim_guest_submissions: {
        Args: { p_guest_id: string; p_user_id: string }
        Returns: number
      }
      create_share: {
        Args: { p_guest_id?: string; p_submission_id: string }
        Returns: string
      }
      decline_friend_request: {
        Args: { p_request_id: string }
        Returns: boolean
      }
      duplicate_tierlist: {
        Args: { p_new_slug: string; p_source_id: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "tierlists"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_daily_game: { Args: never; Returns: Json }
      get_friend_played_status: {
        Args: { p_tierlist_id: string }
        Returns: Json
      }
      get_friend_results: { Args: { p_tierlist_id: string }; Returns: Json }
      get_results: {
        Args: { p_guest_id?: string; p_tierlist_id: string }
        Returns: Json
      }
      get_share: {
        Args: { p_guest_id?: string; p_token: string }
        Returns: Json
      }
      has_submitted_ranking: {
        Args: { p_guest_id?: string; p_tierlist_id: string }
        Returns: boolean
      }
      is_admin_user: { Args: never; Returns: boolean }
      list_friend_requests: { Args: never; Returns: Json }
      remove_friend: { Args: { p_user_id: string }; Returns: boolean }
      schedule_tierlist: {
        Args: { p_release_date: string; p_tierlist_id: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "tierlists"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_profiles: { Args: { p_query: string }; Returns: Json }
      send_friend_request: { Args: { p_recipient_id: string }; Returns: Json }
      set_tierlist_items: {
        Args: { p_items: Json; p_tierlist_id: string }
        Returns: {
          created_at: string
          id: string
          image_url: string | null
          label: string
          sort_order: number
          tierlist_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tierlist_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      submit_ranking: {
        Args: { p_guest_id?: string; p_items: Json; p_tierlist_id: string }
        Returns: string
      }
      unschedule_tierlist: {
        Args: { p_tierlist_id: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "tierlists"
          isOneToOne: true
          isSetofReturn: false
        }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
