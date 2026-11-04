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
      activity_days: {
        Row: {
          day: string
          user_id: string
        }
        Insert: {
          day: string
          user_id: string
        }
        Update: {
          day?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          sources: Json
          thread_id: string
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          sources?: Json
          thread_id: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          sources?: Json
          thread_id?: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_threads: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_threads_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_threads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_threads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          day: string
          kind: string
          used: number
          user_id: string
        }
        Insert: {
          day: string
          kind: string
          used?: number
          user_id: string
        }
        Update: {
          day?: string
          kind?: string
          used?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      anon_aliases: {
        Row: {
          alias: string
          post_id: string
          user_id: string
        }
        Insert: {
          alias: string
          post_id: string
          user_id: string
        }
        Update: {
          alias?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anon_aliases_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anon_aliases_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anon_aliases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anon_aliases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
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
      backup_points: {
        Row: {
          helped_count: number
          points: number
          user_id: string
        }
        Insert: {
          helped_count?: number
          points?: number
          user_id: string
        }
        Update: {
          helped_count?: number
          points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_requests: {
        Row: {
          category: string
          claimed_at: string | null
          claimed_by: string | null
          closed_at: string | null
          conversation_id: string | null
          course_id: string | null
          created_at: string
          department_id: string | null
          details: string | null
          expires_at: string
          id: string
          notified_count: number
          requester_id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["backup_status"]
          title: string
          university_id: string
          urgency: number
        }
        Insert: {
          category: string
          claimed_at?: string | null
          claimed_by?: string | null
          closed_at?: string | null
          conversation_id?: string | null
          course_id?: string | null
          created_at?: string
          department_id?: string | null
          details?: string | null
          expires_at?: string
          id?: string
          notified_count?: number
          requester_id: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["backup_status"]
          title: string
          university_id: string
          urgency?: number
        }
        Update: {
          category?: string
          claimed_at?: string | null
          claimed_by?: string | null
          closed_at?: string | null
          conversation_id?: string | null
          course_id?: string | null
          created_at?: string
          department_id?: string | null
          details?: string | null
          expires_at?: string
          id?: string
          notified_count?: number
          requester_id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["backup_status"]
          title?: string
          university_id?: string
          urgency?: number
        }
        Relationships: [
          {
            foreignKeyName: "backup_requests_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_requests_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_requests_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_requests_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          description: string
          emoji: string
          name: string
          slug: string
          sort: number
        }
        Insert: {
          description: string
          emoji: string
          name: string
          slug: string
          sort?: number
        }
        Update: {
          description?: string
          emoji?: string
          name?: string
          slug?: string
          sort?: number
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
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
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_anonymous: boolean
          parent_id: string | null
          post_id: string
          status: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          parent_id?: string | null
          post_id: string
          status?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          parent_id?: string | null
          post_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_public"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          message: string | null
          requester_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["connection_status"]
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          message?: string | null
          requester_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["connection_status"]
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          message?: string | null
          requester_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["connection_status"]
        }
        Relationships: [
          {
            foreignKeyName: "connections_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          accepted_at: string | null
          conversation_id: string
          joined_at: string
          last_read_at: string | null
          muted: boolean
          role: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          conversation_id: string
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          role?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          conversation_id?: string
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          batch_key: string | null
          course_id: string | null
          created_at: string
          created_by: string | null
          dm_key: string | null
          emoji: string | null
          expires_at: string | null
          id: string
          kind: Database["public"]["Enums"]["conversation_kind"]
          last_message_at: string | null
          title: string | null
          university_id: string | null
        }
        Insert: {
          batch_key?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          dm_key?: string | null
          emoji?: string | null
          expires_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["conversation_kind"]
          last_message_at?: string | null
          title?: string | null
          university_id?: string | null
        }
        Update: {
          batch_key?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          dm_key?: string | null
          emoji?: string | null
          expires_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["conversation_kind"]
          last_message_at?: string | null
          title?: string | null
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_university_id_fkey"
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
          code_norm: string | null
          created_at: string
          created_by: string | null
          credit_hours: number | null
          department_id: string
          id: string
          semester_hint: number | null
          title: string
        }
        Insert: {
          code: string
          code_norm?: string | null
          created_at?: string
          created_by?: string | null
          credit_hours?: number | null
          department_id: string
          id?: string
          semester_hint?: number | null
          title: string
        }
        Update: {
          code?: string
          code_norm?: string | null
          created_at?: string
          created_by?: string | null
          credit_hours?: number | null
          department_id?: string
          id?: string
          semester_hint?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      data_exports: {
        Row: {
          created_at: string
          id: string
          path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_exports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_exports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
      enrollments: {
        Row: {
          course_id: string
          created_at: string
          section: string | null
          term: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          section?: string | null
          term: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          section?: string | null
          term?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number | null
          created_at: string
          created_by: string | null
          description: string
          ends_at: string
          id: string
          reminded_at: string | null
          society_id: string | null
          starts_at: string
          status: string
          title: string
          university_id: string
          venue: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at: string
          id?: string
          reminded_at?: string | null
          society_id?: string | null
          starts_at: string
          status?: string
          title: string
          university_id: string
          venue: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string
          id?: string
          reminded_at?: string | null
          society_id?: string | null
          starts_at?: string
          status?: string
          title?: string
          university_id?: string
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          enabled: boolean
          key: string
          note: string | null
        }
        Insert: {
          enabled?: boolean
          key: string
          note?: string | null
        }
        Update: {
          enabled?: boolean
          key?: string
          note?: string | null
        }
        Relationships: []
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
      invite_redemptions: {
        Row: {
          created_at: string
          invite_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          invite_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          invite_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_redemptions_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          code: string
          created_at: string
          id: string
          inviter_id: string
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          inviter_id: string
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          inviter_id?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          created_at: string
          description: string
          done_at: string | null
          id: string
          kind: string
          location_hint: string | null
          media_paths: string[]
          price_pkr: number | null
          status: string
          title: string
          university_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          done_at?: string | null
          id?: string
          kind: string
          location_hint?: string | null
          media_paths?: string[]
          price_pkr?: number | null
          status?: string
          title: string
          university_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          done_at?: string | null
          id?: string
          kind?: string
          location_hint?: string | null
          media_paths?: string[]
          price_pkr?: number | null
          status?: string
          title?: string
          university_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorships: {
        Row: {
          created_at: string
          id: string
          mentee_id: string
          mentor_id: string
          message: string | null
          responded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          mentee_id: string
          mentor_id: string
          message?: string | null
          responded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          mentee_id?: string
          mentor_id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentorships_mentee_id_fkey"
            columns: ["mentee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorships_mentee_id_fkey"
            columns: ["mentee_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorships_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorships_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_path: string | null
          body: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          reply_to_id: string | null
          sender_id: string | null
        }
        Insert: {
          attachment_path?: string | null
          body?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          sender_id?: string | null
        }
        Update: {
          attachment_path?: string | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      moderator_scopes: {
        Row: {
          granted_at: string
          granted_by: string | null
          space: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          space: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          space?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderator_scopes_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderator_scopes_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderator_scopes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderator_scopes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          backup: boolean
          comments: boolean
          connections: boolean
          digest: boolean
          messages: boolean
          push: boolean
          user_id: string
        }
        Insert: {
          backup?: boolean
          comments?: boolean
          connections?: boolean
          digest?: boolean
          messages?: boolean
          push?: boolean
          user_id: string
        }
        Update: {
          backup?: boolean
          comments?: boolean
          connections?: boolean
          digest?: boolean
          messages?: boolean
          push?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          payload: Json
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          option: number
          post_id: string
          user_id: string
        }
        Insert: {
          option: number
          post_id: string
          user_id: string
        }
        Update: {
          option?: number
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      post_votes: {
        Row: {
          post_id: string
          user_id: string
          value: number
        }
        Insert: {
          post_id: string
          user_id: string
          value: number
        }
        Update: {
          post_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string
          comment_count: number
          created_at: string
          downvotes: number
          hot_score: number
          id: string
          is_anonymous: boolean
          media_paths: string[]
          poll: Json | null
          removed_at: string | null
          space: string
          status: string
          university_id: string
          upvotes: number
        }
        Insert: {
          author_id: string
          body: string
          comment_count?: number
          created_at?: string
          downvotes?: number
          hot_score?: number
          id?: string
          is_anonymous?: boolean
          media_paths?: string[]
          poll?: Json | null
          removed_at?: string | null
          space?: string
          status?: string
          university_id: string
          upvotes?: number
        }
        Update: {
          author_id?: string
          body?: string
          comment_count?: number
          created_at?: string
          downvotes?: number
          hot_score?: number
          id?: string
          is_anonymous?: boolean
          media_paths?: string[]
          poll?: Json | null
          removed_at?: string | null
          space?: string
          status?: string
          university_id?: string
          upvotes?: number
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      presence: {
        Row: {
          on_campus_until: string
          user_id: string
        }
        Insert: {
          on_campus_until: string
          user_id: string
        }
        Update: {
          on_campus_until?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_settings: {
        Row: {
          allow_dms_from: Database["public"]["Enums"]["visibility_level"]
          photo_visibility: Database["public"]["Enums"]["visibility_level"]
          profile_visibility: Database["public"]["Enums"]["visibility_level"]
          share_free_time: boolean
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
          share_free_time?: boolean
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
          share_free_time?: boolean
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
          guidelines_accepted_at: string | null
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
          guidelines_accepted_at?: string | null
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
          guidelines_accepted_at?: string | null
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          reason: string
          reporter_id: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason: string
          reporter_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          details?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason?: string
          reporter_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_chunks: {
        Row: {
          chunk_index: number
          content: string
          course_id: string
          embedding: string | null
          fts: unknown
          id: string
          page: number | null
          resource_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          course_id: string
          embedding?: string | null
          fts?: unknown
          id?: string
          page?: number | null
          resource_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          course_id?: string
          embedding?: string | null
          fts?: unknown
          id?: string
          page?: number | null
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_chunks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_chunks_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_votes: {
        Row: {
          resource_id: string
          user_id: string
        }
        Insert: {
          resource_id: string
          user_id: string
        }
        Update: {
          resource_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_votes_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          chunk_count: number
          course_id: string
          created_at: string
          embedded_at: string | null
          file_path: string
          id: string
          index_status: string
          kind: string
          mime_type: string
          size_bytes: number
          status: string
          teacher_name: string | null
          term: string | null
          title: string
          uploader_id: string | null
          upvotes: number
          year: number | null
        }
        Insert: {
          chunk_count?: number
          course_id: string
          created_at?: string
          embedded_at?: string | null
          file_path: string
          id?: string
          index_status?: string
          kind: string
          mime_type: string
          size_bytes: number
          status?: string
          teacher_name?: string | null
          term?: string | null
          title: string
          uploader_id?: string | null
          upvotes?: number
          year?: number | null
        }
        Update: {
          chunk_count?: number
          course_id?: string
          created_at?: string
          embedded_at?: string | null
          file_path?: string
          id?: string
          index_status?: string
          kind?: string
          mime_type?: string
          size_bytes?: number
          status?: string
          teacher_name?: string | null
          term?: string | null
          title?: string
          uploader_id?: string | null
          upvotes?: number
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          ride_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          ride_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          ride_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_requests_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          conversation_id: string | null
          created_at: string
          depart_at: string
          from_area: string
          id: string
          kind: string
          notes: string | null
          recurring_days: number[]
          seats: number
          status: string
          to_area: string
          university_id: string
          user_id: string
          women_only: boolean
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          depart_at: string
          from_area: string
          id?: string
          kind: string
          notes?: string | null
          recurring_days?: number[]
          seats?: number
          status?: string
          to_area: string
          university_id: string
          user_id: string
          women_only?: boolean
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          depart_at?: string
          from_area?: string
          id?: string
          kind?: string
          notes?: string | null
          recurring_days?: number[]
          seats?: number
          status?: string
          to_area?: string
          university_id?: string
          user_id?: string
          women_only?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "rides_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      societies: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          emoji: string | null
          id: string
          name: string
          slug: string
          university_id: string
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          emoji?: string | null
          id?: string
          name: string
          slug: string
          university_id: string
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          emoji?: string | null
          id?: string
          name?: string
          slug?: string
          university_id?: string
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "societies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "societies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "societies_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      society_members: {
        Row: {
          joined_at: string
          role: string
          society_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role?: string
          society_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: string
          society_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "society_members_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "society_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "society_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      study_groups: {
        Row: {
          conversation_id: string
          course_id: string
          created_at: string
          creator_id: string | null
          id: string
          max_members: number
          meets: string | null
          title: string
        }
        Insert: {
          conversation_id: string
          course_id: string
          created_at?: string
          creator_id?: string | null
          id?: string
          max_members?: number
          meets?: string | null
          title: string
        }
        Update: {
          conversation_id?: string
          course_id?: string
          created_at?: string
          creator_id?: string | null
          id?: string
          max_members?: number
          meets?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_groups_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_groups_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_groups_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_groups_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_slots: {
        Row: {
          course_id: string | null
          day: number
          end_min: number
          id: string
          label: string
          room: string | null
          start_min: number
          term: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          day: number
          end_min: number
          id?: string
          label: string
          room?: string | null
          start_min: number
          term: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          day?: number
          end_min?: number
          id?: string
          label?: string
          room?: string | null
          start_min?: number
          term?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_slots_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      uni_email_claims: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uni_email_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uni_email_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
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
      user_badges: {
        Row: {
          awarded_at: string
          badge: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_fkey"
            columns: ["badge"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
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
      women_only_access: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          note: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          note?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          note?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "women_only_access_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "women_only_access_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "women_only_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "women_only_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_daily_stats: {
        Row: {
          active: number | null
          day: string | null
          signups: number | null
          verified: number | null
        }
        Relationships: []
      }
      comments_public: {
        Row: {
          author_avatar: string | null
          author_handle: string | null
          author_id: string | null
          author_name: string | null
          body: string | null
          created_at: string | null
          id: string | null
          is_anonymous: boolean | null
          is_mine: boolean | null
          is_op: boolean | null
          parent_id: string | null
          post_id: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_public"
            referencedColumns: ["id"]
          },
        ]
      }
      posts_public: {
        Row: {
          author_avatar: string | null
          author_handle: string | null
          author_id: string | null
          author_name: string | null
          body: string | null
          comment_count: number | null
          created_at: string | null
          downvotes: number | null
          hot_score: number | null
          id: string | null
          is_anonymous: boolean | null
          is_mine: boolean | null
          media_paths: string[] | null
          my_poll_option: number | null
          my_vote: number | null
          poll: Json | null
          poll_counts: number[] | null
          space: string | null
          status: string | null
          upvotes: number | null
        }
        Relationships: []
      }
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
      accept_guidelines: { Args: never; Returns: undefined }
      add_course: {
        Args: { p_code: string; p_department: string; p_title: string }
        Returns: string
      }
      add_group_members: {
        Args: { p_conversation: string; p_members: string[] }
        Returns: undefined
      }
      add_resource: {
        Args: {
          p_course: string
          p_kind: string
          p_mime: string
          p_path: string
          p_size: number
          p_teacher?: string
          p_title: string
          p_year?: number
        }
        Returns: string
      }
      admin_kpis: { Args: never; Returns: Json }
      admin_search_users: {
        Args: { p_query?: string }
        Returns: {
          avatar_url: string
          banned_at: string
          batch_year: number
          created_at: string
          deleted_at: string
          department: string
          email: string
          full_name: string
          handle: string
          id: string
          last_active_at: string
          open_reports: number
          role: string
          verification_status: string
        }[]
      }
      ai_limit: { Args: { p_kind: string }; Returns: number }
      ai_remaining: { Args: { p_kind: string }; Returns: number }
      alias_for: { Args: { p_post: string; p_user: string }; Returns: string }
      answer_message_request: {
        Args: { p_accept: boolean; p_conversation: string }
        Returns: undefined
      }
      apply_uni_email: {
        Args: { p_email: string; p_user: string }
        Returns: boolean
      }
      are_connected: { Args: { p_a: string; p_b: string }; Returns: boolean }
      audit: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_target_id: string
          p_target_type: string
        }
        Returns: undefined
      }
      award_badges: { Args: never; Returns: number }
      backup_fanout: { Args: { p_request: string }; Returns: number }
      backup_feed: {
        Args: { p_limit?: number }
        Returns: {
          category: string
          course_code: string
          created_at: string
          details: string
          expires_at: string
          id: string
          nearness: number
          requester_avatar: string
          requester_handle: string
          requester_id: string
          requester_name: string
          title: string
          urgency: number
        }[]
      }
      backup_housekeeping: { Args: never; Returns: undefined }
      backup_leaderboard: {
        Args: { p_department_only?: boolean }
        Returns: {
          avatar_url: string
          department: string
          full_name: string
          handle: string
          helped: number
          rank: number
          user_id: string
        }[]
      }
      ban_user: {
        Args: { p_reason: string; p_user: string }
        Returns: undefined
      }
      block_user: { Args: { p_target: string }; Returns: undefined }
      blocked_between: { Args: { p_a: string; p_b: string }; Returns: boolean }
      blocked_with: { Args: { p_other: string }; Returns: boolean }
      busy_slots: {
        Args: { p_users: string[] }
        Returns: {
          day: number
          end_min: number
          start_min: number
          user_id: string
        }[]
      }
      can_moderate: {
        Args: { p_space: string; p_university: string }
        Returns: boolean
      }
      can_see_ride: {
        Args: { p_ride: Database["public"]["Tables"]["rides"]["Row"] }
        Returns: boolean
      }
      can_see_space: {
        Args: { p_space: string; p_university: string }
        Returns: boolean
      }
      can_use_conversation_path: { Args: { p_name: string }; Returns: boolean }
      can_use_topic: { Args: { p_topic: string }; Returns: boolean }
      can_view_profile: { Args: { p_target: string }; Returns: boolean }
      cancel_account_deletion: { Args: never; Returns: undefined }
      cancel_backup: { Args: { p_request: string }; Returns: undefined }
      cancel_event: { Args: { p_event: string }; Returns: undefined }
      cancel_ride: { Args: { p_ride: string }; Returns: undefined }
      cancel_seat: { Args: { p_ride: string }; Returns: undefined }
      claim_backup: { Args: { p_request: string }; Returns: string }
      confirm_uni_email_claim: {
        Args: { p_code_hash: string; p_user: string }
        Returns: string
      }
      connection_state: { Args: { p_other: string }; Returns: string }
      conversation_people: {
        Args: { p_conversation: string }
        Returns: {
          avatar_url: string
          full_name: string
          handle: string
          id: string
          last_read_at: string
          role: string
        }[]
      }
      course_overview: {
        Args: { p_course: string }
        Returns: {
          chat_id: string
          code: string
          department_code: string
          department_id: string
          enrolled_count: number
          id: string
          me_enrolled: boolean
          title: string
        }[]
      }
      course_people: {
        Args: { p_course: string; p_limit?: number }
        Returns: {
          avatar_url: string
          full_name: string
          handle: string
          id: string
          section: string
        }[]
      }
      course_study_groups: {
        Args: { p_course: string }
        Returns: {
          conversation_id: string
          id: string
          is_member: boolean
          max_members: number
          meets: string
          member_count: number
          title: string
        }[]
      }
      create_backup: {
        Args: {
          p_category: string
          p_course?: string
          p_details: string
          p_hours?: number
          p_title: string
          p_urgency?: number
        }
        Returns: string
      }
      create_comment: {
        Args: {
          p_anonymous?: boolean
          p_body: string
          p_mod_status?: string
          p_mod_token?: string
          p_parent?: string
          p_post: string
        }
        Returns: string
      }
      create_event: {
        Args: {
          p_capacity?: number
          p_description: string
          p_ends: string
          p_society: string
          p_starts: string
          p_title: string
          p_venue: string
        }
        Returns: string
      }
      create_group: {
        Args: { p_emoji: string; p_members: string[]; p_title: string }
        Returns: string
      }
      create_listing: {
        Args: {
          p_description?: string
          p_kind: string
          p_location?: string
          p_media?: string[]
          p_mod_status?: string
          p_mod_token?: string
          p_price?: number
          p_title: string
        }
        Returns: string
      }
      create_post: {
        Args: {
          p_anonymous?: boolean
          p_body: string
          p_media?: string[]
          p_mod_status?: string
          p_mod_token?: string
          p_poll?: Json
          p_space: string
        }
        Returns: string
      }
      create_ride: {
        Args: {
          p_depart: string
          p_from: string
          p_kind: string
          p_notes?: string
          p_recurring?: number[]
          p_seats?: number
          p_to: string
          p_women_only?: boolean
        }
        Returns: string
      }
      create_society: {
        Args: {
          p_description?: string
          p_emoji?: string
          p_name: string
          p_slug: string
        }
        Returns: string
      }
      create_study_group: {
        Args: {
          p_course: string
          p_max?: number
          p_meets?: string
          p_title: string
        }
        Returns: string
      }
      current_term: { Args: never; Returns: string }
      decide_verification: {
        Args: {
          p_decision: Database["public"]["Enums"]["verification_status"]
          p_reason?: string
          p_request: string
        }
        Returns: undefined
      }
      decide_women_only: {
        Args: { p_approve: boolean; p_user: string }
        Returns: undefined
      }
      delete_comment: { Args: { p_comment: string }; Returns: undefined }
      delete_course: { Args: { p_id: string }; Returns: undefined }
      delete_listing: { Args: { p_listing: string }; Returns: undefined }
      delete_message: { Args: { p_message: string }; Returns: undefined }
      delete_post: { Args: { p_post: string }; Returns: undefined }
      delete_resource: { Args: { p_resource: string }; Returns: undefined }
      digest_recipients: {
        Args: { p_limit?: number }
        Returns: {
          email: string
          full_name: string
          new_batchmates: number
          open_backup: number
          unread_notifications: number
          upcoming_events: number
          user_id: string
        }[]
      }
      directory: {
        Args: {
          p_after_id?: string
          p_after_key?: string
          p_hometown?: string
          p_interest?: string
          p_limit?: number
          p_query?: string
          p_residence?: Database["public"]["Enums"]["residence_type"]
          p_scope?: string
          p_shift?: Database["public"]["Enums"]["shift_type"]
        }
        Returns: Database["public"]["CompositeTypes"]["directory_person"][]
        SetofOptions: {
          from: "*"
          to: "directory_person"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      directory_counts: {
        Args: never
        Returns: {
          batch_count: number
          department_count: number
          section_count: number
          university_count: number
        }[]
      }
      dismiss_reports: {
        Args: { p_id: string; p_type: string }
        Returns: undefined
      }
      dispatch_push: {
        Args: { p_id: string; p_kind: string }
        Returns: undefined
      }
      dm_key: { Args: { p_a: string; p_b: string }; Returns: string }
      event_reminders: { Args: never; Returns: undefined }
      events_board: {
        Args: { p_mine?: boolean; p_society?: string }
        Returns: {
          can_manage: boolean
          capacity: number
          description: string
          ends_at: string
          going: number
          id: string
          interested: number
          my_rsvp: string
          society_emoji: string
          society_id: string
          society_name: string
          society_slug: string
          starts_at: string
          status: string
          title: string
          venue: string
        }[]
      }
      expired_verification_documents: {
        Args: { p_days?: number; p_limit?: number }
        Returns: string[]
      }
      export_my_data: { Args: never; Returns: Json }
      find_mentors: {
        Args: { p_limit?: number }
        Returns: {
          avatar_url: string
          batch_year: number
          bio: string
          full_name: string
          handle: string
          id: string
          requested: boolean
          semester: number
        }[]
      }
      flag: { Args: { p_key: string }; Returns: boolean }
      free_now: {
        Args: { p_limit?: number }
        Returns: {
          avatar_url: string
          batch_year: number
          department_id: string
          free_until_min: number
          full_name: string
          handle: string
          id: string
          section: string
        }[]
      }
      handle_available: { Args: { p_handle: string }; Returns: boolean }
      hot_score: {
        Args: { p_created: string; p_down: number; p_up: number }
        Returns: number
      }
      incoming_requests: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          full_name: string
          handle: string
          message: string
          requester_id: string
        }[]
      }
      invite_preview: {
        Args: { p_code: string }
        Returns: {
          batch_count: number
          batch_year: number
          department_code: string
          first_name: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_member: { Args: { p_conversation: string }; Returns: boolean }
      is_society_admin: { Args: { p_society: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_verified: { Args: never; Returns: boolean }
      join_batch_chat: { Args: { p_scope: string }; Returns: string }
      join_course: {
        Args: { p_course: string; p_section?: string }
        Returns: undefined
      }
      join_course_chat: { Args: { p_course: string }; Returns: string }
      join_society: { Args: { p_society: string }; Returns: undefined }
      join_study_group: { Args: { p_group: string }; Returns: string }
      leave_conversation: {
        Args: { p_conversation: string }
        Returns: undefined
      }
      leave_course: { Args: { p_course: string }; Returns: undefined }
      leave_society: { Args: { p_society: string }; Returns: undefined }
      mark_listing_done: { Args: { p_listing: string }; Returns: undefined }
      mark_notifications_read: { Args: { p_id?: string }; Returns: undefined }
      mark_read: { Args: { p_conversation: string }; Returns: undefined }
      market_listings: {
        Args: {
          p_before?: string
          p_kind?: string
          p_mine?: boolean
          p_query?: string
        }
        Returns: {
          avatar_url: string
          created_at: string
          description: string
          full_name: string
          handle: string
          id: string
          kind: string
          location_hint: string
          media_paths: string[]
          price_pkr: number
          status: string
          title: string
          user_id: string
        }[]
      }
      mentor_requests: {
        Args: never
        Returns: {
          avatar_url: string
          batch_year: number
          created_at: string
          full_name: string
          handle: string
          mentee_id: string
          message: string
        }[]
      }
      moderate_content: {
        Args: {
          p_action: string
          p_id: string
          p_reason?: string
          p_type: string
        }
        Returns: undefined
      }
      moderation_queue: {
        Args: never
        Returns: {
          author_handle: string
          author_id: string
          author_name: string
          details: string[]
          is_anonymous: boolean
          last_reported_at: string
          preview: string
          reasons: string[]
          report_count: number
          space: string
          status: string
          target_id: string
          target_type: string
        }[]
      }
      moderation_status: {
        Args: { p_body: string; p_status: string; p_token: string }
        Returns: string
      }
      my_blocked: {
        Args: never
        Returns: {
          blocked_at: string
          full_name: string
          handle: string
          id: string
        }[]
      }
      my_connections: {
        Args: never
        Returns: {
          avatar_url: string
          full_name: string
          handle: string
          id: string
        }[]
      }
      my_conversations: {
        Args: never
        Returns: {
          emoji: string
          id: string
          is_request: boolean
          kind: Database["public"]["Enums"]["conversation_kind"]
          last_at: string
          last_body: string
          last_sender_id: string
          member_count: number
          muted: boolean
          other_avatar: string
          other_handle: string
          other_id: string
          other_name: string
          title: string
          unread: number
        }[]
      }
      my_courses: {
        Args: never
        Returns: {
          code: string
          department_code: string
          enrolled_count: number
          id: string
          section: string
          title: string
        }[]
      }
      my_invite_code: { Args: never; Returns: string }
      my_notifications: {
        Args: { p_limit?: number }
        Returns: {
          actor_avatar: string
          actor_handle: string
          actor_name: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          payload: Json
          read_at: string
          type: string
        }[]
      }
      my_university_id: { Args: never; Returns: string }
      notify: {
        Args: {
          p_actor: string
          p_entity_id: string
          p_entity_type: string
          p_payload?: Json
          p_type: string
          p_user: string
        }
        Returns: undefined
      }
      profile_badges: {
        Args: { p_user: string }
        Returns: {
          awarded_at: string
          description: string
          emoji: string
          name: string
          slug: string
        }[]
      }
      public_stats: { Args: never; Returns: Json }
      purge_deleted_accounts: { Args: never; Returns: number }
      redeem_invite: { Args: { p_code: string }; Returns: boolean }
      refresh_admin_stats: { Args: never; Returns: undefined }
      remove_connection: { Args: { p_other: string }; Returns: undefined }
      report: {
        Args: {
          p_details?: string
          p_reason: string
          p_target_id: string
          p_target_type: string
        }
        Returns: undefined
      }
      request_account_deletion: { Args: never; Returns: string }
      request_connection: {
        Args: { p_message?: string; p_target: string }
        Returns: string
      }
      request_mentor: {
        Args: { p_mentor: string; p_message?: string }
        Returns: undefined
      }
      request_seat: {
        Args: { p_message?: string; p_ride: string }
        Returns: undefined
      }
      request_women_only: { Args: { p_note?: string }; Returns: undefined }
      resolve_backup: { Args: { p_request: string }; Returns: undefined }
      respond_connection: {
        Args: { p_accept: boolean; p_requester: string }
        Returns: string
      }
      respond_mentorship: {
        Args: { p_accept: boolean; p_mentee: string }
        Returns: undefined
      }
      respond_seat: {
        Args: { p_accept: boolean; p_request: string }
        Returns: string
      }
      ride_requests_for: {
        Args: { p_ride: string }
        Returns: {
          avatar_url: string
          created_at: string
          full_name: string
          handle: string
          id: string
          message: string
          status: string
          user_id: string
        }[]
      }
      rides_board: {
        Args: { p_kind?: string; p_mine?: boolean }
        Returns: {
          avatar_url: string
          conversation_id: string
          depart_at: string
          from_area: string
          full_name: string
          handle: string
          id: string
          kind: string
          my_request: string
          notes: string
          recurring_days: number[]
          seats: number
          seats_taken: number
          status: string
          to_area: string
          user_id: string
          women_only: boolean
        }[]
      }
      rsvp_event: {
        Args: { p_event: string; p_status: string }
        Returns: undefined
      }
      save_course: {
        Args: { p_code: string; p_id: string; p_title: string }
        Returns: undefined
      }
      save_department: {
        Args: {
          p_aliases?: string[]
          p_faculty?: string
          p_id: string
          p_name: string
          p_short_code: string
        }
        Returns: string
      }
      save_program: {
        Args: {
          p_department: string
          p_id: string
          p_level: Database["public"]["Enums"]["program_level"]
          p_name: string
          p_semesters: number
        }
        Returns: string
      }
      search_course_chunks: {
        Args: {
          p_course: string
          p_embedding?: string
          p_k?: number
          p_query: string
        }
        Returns: {
          chunk_id: string
          content: string
          page: number
          resource_id: string
          resource_kind: string
          resource_title: string
          score: number
        }[]
      }
      send_message: {
        Args: {
          p_attachment_path?: string
          p_body?: string
          p_conversation: string
          p_reply_to?: string
        }
        Returns: {
          attachment_path: string | null
          body: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          reply_to_id: string | null
          sender_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_ping: { Args: { p_target: string }; Returns: string }
      set_digest: {
        Args: { p_on: boolean; p_user: string }
        Returns: undefined
      }
      set_flag: {
        Args: { p_enabled: boolean; p_key: string }
        Returns: undefined
      }
      set_mentor: { Args: { p_on: boolean }; Returns: undefined }
      set_moderator: {
        Args: { p_spaces: string[]; p_user: string }
        Returns: undefined
      }
      set_my_interests: {
        Args: { p_interest_ids: string[] }
        Returns: undefined
      }
      set_on_campus: { Args: { p_hours: number }; Returns: string }
      set_society_admin: {
        Args: { p_admin: boolean; p_society: string; p_user: string }
        Returns: undefined
      }
      shown_avatar: { Args: { p_user: string }; Returns: string }
      societies_list: {
        Args: never
        Returns: {
          description: string
          emoji: string
          id: string
          member_count: number
          my_role: string
          name: string
          slug: string
          verified: boolean
        }[]
      }
      society_people: {
        Args: { p_society: string }
        Returns: {
          avatar_url: string
          full_name: string
          handle: string
          role: string
          user_id: string
        }[]
      }
      start_dm: { Args: { p_target: string }; Returns: string }
      start_uni_email_claim: {
        Args: { p_code_hash: string; p_email: string; p_user: string }
        Returns: string
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
      suggest_people: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          person: Database["public"]["CompositeTypes"]["directory_person"]
          reasons: string[]
          score: number
        }[]
      }
      touch_activity: { Args: never; Returns: undefined }
      unban_user: { Args: { p_user: string }; Returns: undefined }
      unblock_user: { Args: { p_target: string }; Returns: undefined }
      unclaim_backup: { Args: { p_request: string }; Returns: undefined }
      use_ai: { Args: { p_kind: string }; Returns: number }
      verify_society: {
        Args: { p_society: string; p_verified: boolean }
        Returns: undefined
      }
      visible_at: {
        Args: {
          p_level: Database["public"]["Enums"]["visibility_level"]
          p_target: string
        }
        Returns: boolean
      }
      vote_poll: {
        Args: { p_option: number; p_post: string }
        Returns: undefined
      }
      vote_post: {
        Args: { p_post: string; p_value: number }
        Returns: undefined
      }
      vote_resource: {
        Args: { p_resource: string; p_up: boolean }
        Returns: number
      }
      wants: { Args: { p_type: string; p_user: string }; Returns: boolean }
      warn_user: {
        Args: { p_message: string; p_user: string }
        Returns: undefined
      }
      women_eligible: { Args: never; Returns: boolean }
      women_only_queue: {
        Args: never
        Returns: {
          avatar_url: string
          batch_year: number
          created_at: string
          department: string
          full_name: string
          handle: string
          note: string
          user_id: string
        }[]
      }
    }
    Enums: {
      backup_status: "open" | "claimed" | "resolved" | "expired" | "cancelled"
      connection_status: "pending" | "accepted" | "declined" | "blocked"
      conversation_kind:
        | "dm"
        | "group"
        | "batch"
        | "course"
        | "backup_temp"
        | "ping"
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
      directory_person: {
        id: string | null
        handle: string | null
        full_name: string | null
        avatar_url: string | null
        department_code: string | null
        batch_year: number | null
        section: string | null
        shift: Database["public"]["Enums"]["shift_type"] | null
        residence: Database["public"]["Enums"]["residence_type"] | null
        hometown_city: string | null
        interests: string[] | null
        has_uni_email: boolean | null
        sort_key: string | null
      }
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
      conversation_kind: [
        "dm",
        "group",
        "batch",
        "course",
        "backup_temp",
        "ping",
      ],
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
