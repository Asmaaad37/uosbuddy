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
    PostgrestVersion: "14.18"
  }
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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_providers: {
        Row: {
          live: boolean
          mail_host: string
        }
        Insert: {
          live?: boolean
          mail_host: string
        }
        Update: {
          live?: boolean
          mail_host?: string
        }
        Relationships: []
      }
      campuses: {
        Row: {
          created_at: string
          id: string
          is_main: boolean
          name: string
          university_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_main?: boolean
          name: string
          university_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_main?: boolean
          name?: string
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campuses_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          created_at: string
          credit_hours: number | null
          department_id: string
          id: string
          semester_hint: number | null
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          credit_hours?: number | null
          department_id: string
          id?: string
          semester_hint?: number | null
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          credit_hours?: number | null
          department_id?: string
          id?: string
          semester_hint?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          aliases: string[]
          campus_id: string | null
          created_at: string
          faculty: string | null
          id: string
          name: string
          short_code: string
          university_id: string
        }
        Insert: {
          aliases?: string[]
          campus_id?: string | null
          created_at?: string
          faculty?: string | null
          id?: string
          name: string
          short_code: string
          university_id: string
        }
        Update: {
          aliases?: string[]
          campus_id?: string | null
          created_at?: string
          faculty?: string | null
          id?: string
          name?: string
          short_code?: string
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      interests: {
        Row: {
          category: string
          created_at: string
          emoji: string
          id: string
          label: string
          slug: string
          sort: number
        }
        Insert: {
          category: string
          created_at?: string
          emoji: string
          id?: string
          label: string
          slug: string
          sort?: number
        }
        Update: {
          category?: string
          created_at?: string
          emoji?: string
          id?: string
          label?: string
          slug?: string
          sort?: number
        }
        Relationships: []
      }
      privacy_settings: {
        Row: {
          allow_dms_from: Database["public"]["Enums"]["visibility_level"]
          photo_visibility: Database["public"]["Enums"]["visibility_level"]
          profile_visibility: Database["public"]["Enums"]["visibility_level"]
          show_free_now: boolean
          show_hometown: boolean
          show_in_directory: boolean
          user_id: string
          women_only_spaces: boolean
        }
        Insert: {
          allow_dms_from?: Database["public"]["Enums"]["visibility_level"]
          photo_visibility?: Database["public"]["Enums"]["visibility_level"]
          profile_visibility?: Database["public"]["Enums"]["visibility_level"]
          show_free_now?: boolean
          show_hometown?: boolean
          show_in_directory?: boolean
          user_id: string
          women_only_spaces?: boolean
        }
        Update: {
          allow_dms_from?: Database["public"]["Enums"]["visibility_level"]
          photo_visibility?: Database["public"]["Enums"]["visibility_level"]
          profile_visibility?: Database["public"]["Enums"]["visibility_level"]
          show_free_now?: boolean
          show_hometown?: boolean
          show_in_directory?: boolean
          user_id?: string
          women_only_spaces?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "privacy_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      private_profile: {
        Row: {
          personal_email: string | null
          registration_no: string | null
          roll_no: string | null
          uni_email: string | null
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          personal_email?: string | null
          registration_no?: string | null
          roll_no?: string | null
          uni_email?: string | null
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          personal_email?: string | null
          registration_no?: string | null
          roll_no?: string | null
          uni_email?: string | null
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "private_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_interests: {
        Row: {
          created_at: string
          interest_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          interest_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          interest_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_interests_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "interests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned_at: string | null
          batch_year: number | null
          bio: string | null
          created_at: string
          deleted_at: string | null
          department_id: string | null
          full_name: string | null
          handle: string | null
          hometown_city: string | null
          id: string
          is_mentor: boolean
          last_active_at: string | null
          onboarding_step: number
          opening_move: string | null
          opening_move_prompt: string | null
          program_id: string | null
          pronoun_display: string | null
          residence: Database["public"]["Enums"]["residence_type"] | null
          role: Database["public"]["Enums"]["user_role"]
          section: string | null
          semester: number | null
          shift: Database["public"]["Enums"]["shift_type"] | null
          university_id: string | null
          verification_method:
            | Database["public"]["Enums"]["verification_method"]
            | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          banned_at?: string | null
          batch_year?: number | null
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          department_id?: string | null
          full_name?: string | null
          handle?: string | null
          hometown_city?: string | null
          id: string
          is_mentor?: boolean
          last_active_at?: string | null
          onboarding_step?: number
          opening_move?: string | null
          opening_move_prompt?: string | null
          program_id?: string | null
          pronoun_display?: string | null
          residence?: Database["public"]["Enums"]["residence_type"] | null
          role?: Database["public"]["Enums"]["user_role"]
          section?: string | null
          semester?: number | null
          shift?: Database["public"]["Enums"]["shift_type"] | null
          university_id?: string | null
          verification_method?:
            | Database["public"]["Enums"]["verification_method"]
            | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          banned_at?: string | null
          batch_year?: number | null
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          department_id?: string | null
          full_name?: string | null
          handle?: string | null
          hometown_city?: string | null
          id?: string
          is_mentor?: boolean
          last_active_at?: string | null
          onboarding_step?: number
          opening_move?: string | null
          opening_move_prompt?: string | null
          program_id?: string | null
          pronoun_display?: string | null
          residence?: Database["public"]["Enums"]["residence_type"] | null
          role?: Database["public"]["Enums"]["user_role"]
          section?: string | null
          semester?: number | null
          shift?: Database["public"]["Enums"]["shift_type"] | null
          university_id?: string | null
          verification_method?:
            | Database["public"]["Enums"]["verification_method"]
            | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string
          department_id: string
          duration_semesters: number
          id: string
          level: Database["public"]["Enums"]["program_level"]
          name: string
        }
        Insert: {
          created_at?: string
          department_id: string
          duration_semesters: number
          id?: string
          level: Database["public"]["Enums"]["program_level"]
          name: string
        }
        Update: {
          created_at?: string
          department_id?: string
          duration_semesters?: number
          id?: string
          level?: Database["public"]["Enums"]["program_level"]
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      universities: {
        Row: {
          city: string | null
          created_at: string
          id: string
          is_live: boolean
          name: string
          registration_no_regex: string | null
          roll_no_regex: string | null
          short_name: string
          slug: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          is_live?: boolean
          name: string
          registration_no_regex?: string | null
          roll_no_regex?: string | null
          short_name: string
          slug: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          is_live?: boolean
          name?: string
          registration_no_regex?: string | null
          roll_no_regex?: string | null
          short_name?: string
          slug?: string
        }
        Relationships: []
      }
      university_domains: {
        Row: {
          campus_id: string | null
          created_at: string
          domain: string
          id: string
          mail_host: string
          returning_only: boolean
          student_only: boolean
          university_id: string
        }
        Insert: {
          campus_id?: string | null
          created_at?: string
          domain: string
          id?: string
          mail_host?: string
          returning_only?: boolean
          student_only?: boolean
          university_id: string
        }
        Update: {
          campus_id?: string | null
          created_at?: string
          domain?: string
          id?: string
          mail_host?: string
          returning_only?: boolean
          student_only?: boolean
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_domains_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_domains_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      university_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      verification_requests: {
        Row: {
          ai_precheck: Json | null
          created_at: string
          decided_at: string | null
          decision_reason: string | null
          doc_deleted_at: string | null
          doc_path: string | null
          full_name_submitted: string | null
          id: string
          method: Database["public"]["Enums"]["verification_method"]
          reviewer_id: string | null
          roll_no_submitted: string | null
          status: Database["public"]["Enums"]["verification_status"]
          university_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_precheck?: Json | null
          created_at?: string
          decided_at?: string | null
          decision_reason?: string | null
          doc_deleted_at?: string | null
          doc_path?: string | null
          full_name_submitted?: string | null
          id?: string
          method?: Database["public"]["Enums"]["verification_method"]
          reviewer_id?: string | null
          roll_no_submitted?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          university_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_precheck?: Json | null
          created_at?: string
          decided_at?: string | null
          decision_reason?: string | null
          doc_deleted_at?: string | null
          doc_path?: string | null
          full_name_submitted?: string | null
          id?: string
          method?: Database["public"]["Enums"]["verification_method"]
          reviewer_id?: string | null
          roll_no_submitted?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          university_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null
          batch_year: number | null
          bio: string | null
          department_id: string | null
          full_name: string | null
          handle: string | null
          has_uni_email: boolean | null
          hometown_city: string | null
          id: string | null
          is_mentor: boolean | null
          opening_move: string | null
          opening_move_prompt: string | null
          program_id: string | null
          pronoun_display: string | null
          residence: Database["public"]["Enums"]["residence_type"] | null
          section: string | null
          semester: number | null
          shift: Database["public"]["Enums"]["shift_type"] | null
          university_id: string | null
          verified_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_uni_email: {
        Args: { p_email: string; p_user: string }
        Returns: boolean
      }
      are_connected: { Args: { p_a: string; p_b: string }; Returns: boolean }
      can_view_profile: { Args: { p_target: string }; Returns: boolean }
      decide_verification: {
        Args: {
          p_decision: Database["public"]["Enums"]["verification_status"]
          p_reason?: string
          p_request: string
        }
        Returns: undefined
      }
      expired_verification_documents: {
        Args: { p_days?: number; p_limit?: number }
        Returns: string[]
      }
      handle_available: { Args: { p_handle: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_verified: { Args: never; Returns: boolean }
      my_university_id: { Args: never; Returns: string }
      public_stats: { Args: never; Returns: Json }
      set_my_interests: {
        Args: { p_interest_ids: string[] }
        Returns: undefined
      }
      submit_verification: {
        Args: {
          p_doc_path: string
          p_full_name: string
          p_roll_no: string
          p_whatsapp?: string
        }
        Returns: string
      }
      visible_at: {
        Args: {
          p_level: Database["public"]["Enums"]["visibility_level"]
          p_target: string
        }
        Returns: boolean
      }
    }
    Enums: {
      backup_status: "open" | "claimed" | "resolved" | "expired" | "cancelled"
      connection_status: "pending" | "accepted" | "declined" | "blocked"
      conversation_kind: "dm" | "group" | "batch" | "course" | "backup_temp"
      listing_kind: "sell" | "buy" | "free" | "lost" | "found"
      program_level:
        | "associate"
        | "bs"
        | "bs_5th_semester"
        | "ms_mphil"
        | "phd"
        | "other"
      report_status: "open" | "actioned" | "dismissed"
      residence_type: "day_scholar" | "hostelite" | "other"
      ride_role: "driver" | "passenger"
      shift_type: "morning" | "evening" | "weekend"
      user_role: "student" | "moderator" | "admin"
      verification_method: "uni_email" | "document" | "admin_manual"
      verification_status:
        | "unverified"
        | "pending"
        | "verified"
        | "rejected"
        | "needs_info"
      visibility_level:
        | "everyone"
        | "department"
        | "batch"
        | "connections"
        | "nobody"
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
    Enums: {
      backup_status: ["open", "claimed", "resolved", "expired", "cancelled"],
      connection_status: ["pending", "accepted", "declined", "blocked"],
      conversation_kind: ["dm", "group", "batch", "course", "backup_temp"],
      listing_kind: ["sell", "buy", "free", "lost", "found"],
      program_level: [
        "associate",
        "bs",
        "bs_5th_semester",
        "ms_mphil",
        "phd",
        "other",
      ],
      report_status: ["open", "actioned", "dismissed"],
      residence_type: ["day_scholar", "hostelite", "other"],
      ride_role: ["driver", "passenger"],
      shift_type: ["morning", "evening", "weekend"],
      user_role: ["student", "moderator", "admin"],
      verification_method: ["uni_email", "document", "admin_manual"],
      verification_status: [
        "unverified",
        "pending",
        "verified",
        "rejected",
        "needs_info",
      ],
      visibility_level: [
        "everyone",
        "department",
        "batch",
        "connections",
        "nobody",
      ],
    },
  },
} as const
