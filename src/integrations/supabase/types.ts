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
      account_links: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          linked_user_id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          linked_user_id: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          linked_user_id?: string
          owner_id?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_user: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user?: string | null
        }
        Relationships: []
      }
      admin_nav_config: {
        Row: {
          icon_url: string | null
          in_quickbar: boolean
          key: string
          label: string | null
          order_idx: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          icon_url?: string | null
          in_quickbar?: boolean
          key: string
          label?: string | null
          order_idx?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          icon_url?: string | null
          in_quickbar?: boolean
          key?: string
          label?: string | null
          order_idx?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      ai_chats: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          publish_at: string
          show_on_login: boolean
          tag: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          publish_at?: string
          show_on_login?: boolean
          tag?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          publish_at?: string
          show_on_login?: boolean
          tag?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      anonymous_reflections: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          likes_count: number
          mood: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          likes_count?: number
          mood?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          likes_count?: number
          mood?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          app_version: string
          id: number
          maintenance_message: string | null
          maintenance_mode: boolean
          maintenance_until: string | null
          makron_coin_per_correct: number
          makron_xp_per_correct: number
          updated_at: string
        }
        Insert: {
          app_version?: string
          id?: number
          maintenance_message?: string | null
          maintenance_mode?: boolean
          maintenance_until?: string | null
          makron_coin_per_correct?: number
          makron_xp_per_correct?: number
          updated_at?: string
        }
        Update: {
          app_version?: string
          id?: number
          maintenance_message?: string | null
          maintenance_mode?: boolean
          maintenance_until?: string | null
          makron_coin_per_correct?: number
          makron_xp_per_correct?: number
          updated_at?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          allowed_file_types: string[] | null
          attachments: Json
          class_id: string
          created_at: string
          created_by: string
          description: string | null
          due_at: string | null
          fixed_xp: number
          id: string
          kind: string
          max_points: number
          quiz_questions: Json | null
          title: string
          updated_at: string
          xp_mode: string
        }
        Insert: {
          allowed_file_types?: string[] | null
          attachments?: Json
          class_id: string
          created_at?: string
          created_by: string
          description?: string | null
          due_at?: string | null
          fixed_xp?: number
          id?: string
          kind?: string
          max_points?: number
          quiz_questions?: Json | null
          title: string
          updated_at?: string
          xp_mode?: string
        }
        Update: {
          allowed_file_types?: string[] | null
          attachments?: Json
          class_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_at?: string | null
          fixed_xp?: number
          id?: string
          kind?: string
          max_points?: number
          quiz_questions?: Json | null
          title?: string
          updated_at?: string
          xp_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          code: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          rarity: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          rarity?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          rarity?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      class_chat_messages: {
        Row: {
          body: string
          class_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          class_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          class_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: []
      }
      class_events: {
        Row: {
          class_id: string
          created_at: string
          created_by: string
          description: string | null
          event_date: string
          id: string
          title: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by: string
          description?: string | null
          event_date: string
          id?: string
          title: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          event_date?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      class_files: {
        Row: {
          class_id: string
          created_at: string
          folder: string
          id: string
          mime: string | null
          name: string
          size: number | null
          uploader_id: string
          url: string
        }
        Insert: {
          class_id: string
          created_at?: string
          folder?: string
          id?: string
          mime?: string | null
          name: string
          size?: number | null
          uploader_id: string
          url: string
        }
        Update: {
          class_id?: string
          created_at?: string
          folder?: string
          id?: string
          mime?: string | null
          name?: string
          size?: number | null
          uploader_id?: string
          url?: string
        }
        Relationships: []
      }
      class_members: {
        Row: {
          class_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          class_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          class_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_mini_test_attempts: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          score: number | null
          test_id: string
          total: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          score?: number | null
          test_id: string
          total?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          score?: number | null
          test_id?: string
          total?: number | null
          user_id?: string
        }
        Relationships: []
      }
      class_mini_tests: {
        Row: {
          class_id: string
          created_at: string
          created_by: string
          id: string
          question_ids: string[]
          title: string
          unit_id: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by: string
          id?: string
          question_ids?: string[]
          title: string
          unit_id?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string
          id?: string
          question_ids?: string[]
          title?: string
          unit_id?: string | null
        }
        Relationships: []
      }
      class_post_comments: {
        Row: {
          author_id: string
          body: string
          class_id: string
          created_at: string
          id: string
          post_id: string
          private_to: string | null
        }
        Insert: {
          author_id: string
          body: string
          class_id: string
          created_at?: string
          id?: string
          post_id: string
          private_to?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          class_id?: string
          created_at?: string
          id?: string
          post_id?: string
          private_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "class_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      class_posts: {
        Row: {
          attachments: Json
          author_id: string
          body: string
          class_id: string
          created_at: string
          id: string
          pinned: boolean
          title: string | null
          updated_at: string
        }
        Insert: {
          attachments?: Json
          author_id: string
          body: string
          class_id: string
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: Json
          author_id?: string
          body?: string
          class_id?: string
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      class_student_permissions: {
        Row: {
          can_comment: boolean
          can_upload_files: boolean
          can_view_grades: boolean
          class_id: string
          id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          can_comment?: boolean
          can_upload_files?: boolean
          can_view_grades?: boolean
          class_id: string
          id?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          can_comment?: boolean
          can_upload_files?: boolean
          can_view_grades?: boolean
          class_id?: string
          id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          invite_code: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          invite_code: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      coin_gift_limits: {
        Row: {
          date: string
          gift_count: number
          total_sent: number
          user_id: string
        }
        Insert: {
          date?: string
          gift_count?: number
          total_sent?: number
          user_id: string
        }
        Update: {
          date?: string
          gift_count?: number
          total_sent?: number
          user_id?: string
        }
        Relationships: []
      }
      coin_gifts: {
        Row: {
          amount: number
          created_at: string
          from_user: string
          id: string
          message: string | null
          to_user: string
        }
        Insert: {
          amount: number
          created_at?: string
          from_user: string
          id?: string
          message?: string | null
          to_user: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_user?: string
          id?: string
          message?: string | null
          to_user?: string
        }
        Relationships: []
      }
      coin_purchases: {
        Row: {
          created_at: string
          id: string
          item_id: string
          payload: Json
          price_paid: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          payload?: Json
          price_paid: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          payload?: Json
          price_paid?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "coin_shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_redemption_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          fulfilled_at: string | null
          fulfilled_by: string | null
          id: string
          item_code: string | null
          item_id: string
          item_name: string | null
          payload: Json | null
          price_paid: number
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          item_code?: string | null
          item_id: string
          item_name?: string | null
          payload?: Json | null
          price_paid: number
          status?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          item_code?: string | null
          item_id?: string
          item_name?: string | null
          payload?: Json | null
          price_paid?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_redemption_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "coin_shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_shop_items: {
        Row: {
          auto_grant: boolean
          category: string
          code: string
          consumable: boolean
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_custom: boolean
          name: string
          payload: Json
          price: number
          sort_order: number
        }
        Insert: {
          auto_grant?: boolean
          category: string
          code: string
          consumable?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_custom?: boolean
          name: string
          payload?: Json
          price: number
          sort_order?: number
        }
        Update: {
          auto_grant?: boolean
          category?: string
          code?: string
          consumable?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_custom?: boolean
          name?: string
          payload?: Json
          price?: number
          sort_order?: number
        }
        Relationships: []
      }
      coin_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          meta: Json
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          meta?: Json
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          meta?: Json
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_mission_templates: {
        Row: {
          category: string
          code: string
          description: string | null
          id: string
          is_active: boolean
          reward_coins: number
          reward_xp: number
          sort_order: number
          target: number
          title: string
        }
        Insert: {
          category: string
          code: string
          description?: string | null
          id?: string
          is_active?: boolean
          reward_coins?: number
          reward_xp?: number
          sort_order?: number
          target: number
          title: string
        }
        Update: {
          category?: string
          code?: string
          description?: string | null
          id?: string
          is_active?: boolean
          reward_coins?: number
          reward_xp?: number
          sort_order?: number
          target?: number
          title?: string
        }
        Relationships: []
      }
      daily_missions: {
        Row: {
          completed: boolean
          created_at: string
          date: string
          id: string
          kind: string
          pinned: boolean
          progress: number
          reward_coins: number
          target_value: number
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          date?: string
          id?: string
          kind: string
          pinned?: boolean
          progress?: number
          reward_coins?: number
          target_value?: number
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          date?: string
          id?: string
          kind?: string
          pinned?: boolean
          progress?: number
          reward_coins?: number
          target_value?: number
          user_id?: string
        }
        Relationships: []
      }
      daily_reflections: {
        Row: {
          created_at: string
          date: string
          id: string
          summary: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          summary: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          summary?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_summary_subscriptions: {
        Row: {
          channel: string
          enabled: boolean
          send_hour: number
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          enabled?: boolean
          send_hour?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          enabled?: boolean
          send_hour?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_three: {
        Row: {
          created_at: string
          for_date: string
          id: string
          question_id: string
          slot: number
        }
        Insert: {
          created_at?: string
          for_date: string
          id?: string
          question_id: string
          slot: number
        }
        Update: {
          created_at?: string
          for_date?: string
          id?: string
          question_id?: string
          slot?: number
        }
        Relationships: []
      }
      difficulty_adjustments: {
        Row: {
          admin_id: string
          created_at: string
          difficulty_score: number
          id: string
          note: string | null
          question_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          difficulty_score: number
          id?: string
          note?: string | null
          question_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          difficulty_score?: number
          id?: string
          note?: string | null
          question_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          date: string
          description: string | null
          id: string
          start_time: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          id?: string
          start_time?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          start_time?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      faq_entries: {
        Row: {
          answer: string
          created_at: string
          created_by: string | null
          id: string
          order_index: number
          published: boolean
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          created_by?: string | null
          id?: string
          order_index?: number
          published?: boolean
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          created_by?: string | null
          id?: string
          order_index?: number
          published?: boolean
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          admin_reply: string | null
          body: string
          category: string
          created_at: string
          email: string | null
          id: string
          replied_at: string | null
          route: string | null
          status: string
          user_agent: string | null
          user_id: string | null
          user_notified_at: string | null
        }
        Insert: {
          admin_reply?: string | null
          body: string
          category?: string
          created_at?: string
          email?: string | null
          id?: string
          replied_at?: string | null
          route?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
          user_notified_at?: string | null
        }
        Update: {
          admin_reply?: string | null
          body?: string
          category?: string
          created_at?: string
          email?: string | null
          id?: string
          replied_at?: string | null
          route?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
          user_notified_at?: string | null
        }
        Relationships: []
      }
      feedback_messages: {
        Row: {
          body: string
          created_at: string
          feedback_id: string
          id: string
          read_at: string | null
          sender_id: string | null
          sender_role: string
        }
        Insert: {
          body: string
          created_at?: string
          feedback_id: string
          id?: string
          read_at?: string | null
          sender_id?: string | null
          sender_role: string
        }
        Update: {
          body?: string
          created_at?: string
          feedback_id?: string
          id?: string
          read_at?: string | null
          sender_id?: string | null
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_messages_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back: string
          created_at: string
          deck: string
          ease: number
          front: string
          id: string
          interval_days: number
          next_review_at: string
          reviews: number
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string
          deck?: string
          ease?: number
          front: string
          id?: string
          interval_days?: number
          next_review_at?: string
          reviews?: number
          user_id: string
        }
        Update: {
          back?: string
          created_at?: string
          deck?: string
          ease?: number
          front?: string
          id?: string
          interval_days?: number
          next_review_at?: string
          reviews?: number
          user_id?: string
        }
        Relationships: []
      }
      focus_logs: {
        Row: {
          blur_count: number
          created_at: string
          date: string
          id: string
          minutes: number
          score: number
          user_id: string
        }
        Insert: {
          blur_count?: number
          created_at?: string
          date?: string
          id?: string
          minutes?: number
          score?: number
          user_id: string
        }
        Update: {
          blur_count?: number
          created_at?: string
          date?: string
          id?: string
          minutes?: number
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
          status: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
          status?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
          status?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          count_from: string | null
          created_at: string
          deadline: string | null
          description: string | null
          done: boolean
          id: string
          progress_minutes: number
          scope: string
          target_minutes: number
          title: string
          user_id: string
        }
        Insert: {
          count_from?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          done?: boolean
          id?: string
          progress_minutes?: number
          scope?: string
          target_minutes?: number
          title: string
          user_id: string
        }
        Update: {
          count_from?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          done?: boolean
          id?: string
          progress_minutes?: number
          scope?: string
          target_minutes?: number
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      grading_history: {
        Row: {
          correct: boolean
          created_at: string
          feedback: string
          id: string
          question_id: string
          score: number
          user_answer: string
          user_id: string
        }
        Insert: {
          correct: boolean
          created_at?: string
          feedback: string
          id?: string
          question_id: string
          score: number
          user_answer: string
          user_id: string
        }
        Update: {
          correct?: boolean
          created_at?: string
          feedback?: string
          id?: string
          question_id?: string
          score?: number
          user_answer?: string
          user_id?: string
        }
        Relationships: []
      }
      group_room_members: {
        Row: {
          id: string
          joined_at: string
          room_id: string
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          room_id: string
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          room_id?: string
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "group_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      group_rooms: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          owner_id: string
          status: string
          topic: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          owner_id: string
          status?: string
          topic?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          status?: string
          topic?: string | null
        }
        Relationships: []
      }
      habit_stamps: {
        Row: {
          created_at: string
          date: string
          habit_key: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          habit_key: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          habit_key?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      makron_answers: {
        Row: {
          admin_override_note: string | null
          admin_override_score: number | null
          answer: Json | null
          auto_correct: boolean | null
          awarded_points: number | null
          created_at: string
          file_url: string | null
          id: string
          manual_comment: string | null
          manual_score: number | null
          question_id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          admin_override_note?: string | null
          admin_override_score?: number | null
          answer?: Json | null
          auto_correct?: boolean | null
          awarded_points?: number | null
          created_at?: string
          file_url?: string | null
          id?: string
          manual_comment?: string | null
          manual_score?: number | null
          question_id: string
          session_id: string
          updated_at?: string
        }
        Update: {
          admin_override_note?: string | null
          admin_override_score?: number | null
          answer?: Json | null
          auto_correct?: boolean | null
          awarded_points?: number | null
          created_at?: string
          file_url?: string | null
          id?: string
          manual_comment?: string | null
          manual_score?: number | null
          question_id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "makron_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "makron_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makron_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "makron_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      makron_assignments: {
        Row: {
          assigned_by: string
          class_id: string
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          title: string
          unit_id: string
        }
        Insert: {
          assigned_by: string
          class_id: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          title: string
          unit_id: string
        }
        Update: {
          assigned_by?: string
          class_id?: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          title?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "makron_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makron_assignments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "makron_units"
            referencedColumns: ["id"]
          },
        ]
      }
      makron_bookmarks: {
        Row: {
          created_at: string
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "makron_bookmarks_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "makron_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      makron_fields: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          order_idx: number
          subject_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          order_idx?: number
          subject_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          order_idx?: number
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "makron_fields_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "makron_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      makron_question_likes: {
        Row: {
          created_at: string
          difficulty_vote: number | null
          id: string
          liked: boolean | null
          question_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty_vote?: number | null
          id?: string
          liked?: boolean | null
          question_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty_vote?: number | null
          id?: string
          liked?: boolean | null
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "makron_question_likes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "makron_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      makron_questions: {
        Row: {
          accepted_answers: Json
          correct_options: Json
          created_at: string
          created_by: string | null
          explanation: string | null
          grading: string
          hint_text: string | null
          id: string
          image_url: string | null
          is_active: boolean
          model_answer: string | null
          options: Json
          order_idx: number
          points: number
          prompt: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          type: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          accepted_answers?: Json
          correct_options?: Json
          created_at?: string
          created_by?: string | null
          explanation?: string | null
          grading?: string
          hint_text?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          model_answer?: string | null
          options?: Json
          order_idx?: number
          points?: number
          prompt: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          type: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          accepted_answers?: Json
          correct_options?: Json
          created_at?: string
          created_by?: string | null
          explanation?: string | null
          grading?: string
          hint_text?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          model_answer?: string | null
          options?: Json
          order_idx?: number
          points?: number
          prompt?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          type?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "makron_questions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "makron_units"
            referencedColumns: ["id"]
          },
        ]
      }
      makron_reports: {
        Row: {
          category: string
          created_at: string
          id: string
          note: string | null
          question_id: string | null
          status: string
          suggested_answer: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          note?: string | null
          question_id?: string | null
          status?: string
          suggested_answer?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          note?: string | null
          question_id?: string | null
          status?: string
          suggested_answer?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "makron_reports_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "makron_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      makron_sessions: {
        Row: {
          coins_awarded: number
          created_at: string
          finished_at: string | null
          id: string
          scratchpad: string | null
          started_at: string
          total_points: number | null
          total_score: number | null
          unit_id: string
          user_id: string
          xp_awarded: number
        }
        Insert: {
          coins_awarded?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          scratchpad?: string | null
          started_at?: string
          total_points?: number | null
          total_score?: number | null
          unit_id: string
          user_id: string
          xp_awarded?: number
        }
        Update: {
          coins_awarded?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          scratchpad?: string | null
          started_at?: string
          total_points?: number | null
          total_score?: number | null
          unit_id?: string
          user_id?: string
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "makron_sessions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "makron_units"
            referencedColumns: ["id"]
          },
        ]
      }
      makron_subjects: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          icon: string | null
          id: string
          name: string
          order_idx: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          name: string
          order_idx?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          name?: string
          order_idx?: number
          updated_at?: string
        }
        Relationships: []
      }
      makron_units: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          field: string | null
          field_id: string | null
          id: string
          order_idx: number
          organization_id: string | null
          subject: string | null
          subject_id: string | null
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          field?: string | null
          field_id?: string | null
          id?: string
          order_idx?: number
          organization_id?: string | null
          subject?: string | null
          subject_id?: string | null
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          field?: string | null
          field_id?: string | null
          id?: string
          order_idx?: number
          organization_id?: string | null
          subject?: string | null
          subject_id?: string | null
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "makron_units_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "makron_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makron_units_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "makron_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      makron_xp: {
        Row: {
          level: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          level?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          level?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      notebook_photos: {
        Row: {
          created_at: string
          id: string
          image_url: string
          subject_id: string | null
          taken_on: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          subject_id?: string | null
          taken_on?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          subject_id?: string | null
          taken_on?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_categories: {
        Row: {
          prefs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          prefs?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          prefs?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      ocr_notes: {
        Row: {
          created_at: string
          id: string
          text: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          text: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          text?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      organization_invitations: {
        Row: {
          created_at: string
          id: string
          invited_by: string
          invitee_id: string
          message: string | null
          organization_id: string
          responded_at: string | null
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by: string
          invitee_id: string
          message?: string | null
          organization_id: string
          responded_at?: string | null
          role?: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string
          invitee_id?: string
          message?: string | null
          organization_id?: string
          responded_at?: string | null
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_join_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          organization_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["org_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          organization_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          organization_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_join_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          id: string
          joined_at: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          suspended: boolean
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          suspended?: boolean
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          suspended?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_service_restrictions: {
        Row: {
          created_at: string
          id: string
          message: string | null
          organization_id: string
          service_key: string
          until: string | null
          variant: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          organization_id: string
          service_key: string
          until?: string | null
          variant?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          organization_id?: string
          service_key?: string
          until?: string | null
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_service_restrictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          reviewed_at: string | null
          reviewed_by: string | null
          settings: Json
          slug: string | null
          status: Database["public"]["Enums"]["org_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          settings?: Json
          slug?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          settings?: Json
          slug?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          updated_at?: string
        }
        Relationships: []
      }
      parent_child_links: {
        Row: {
          child_id: string
          created_at: string
          id: string
          parent_id: string
        }
        Insert: {
          child_id: string
          created_at?: string
          id?: string
          parent_id: string
        }
        Update: {
          child_id?: string
          created_at?: string
          id?: string
          parent_id?: string
        }
        Relationships: []
      }
      parent_invite_codes: {
        Row: {
          child_id: string
          code: string
          created_at: string
          expires_at: string
          id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          child_id: string
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          child_id?: string
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      plan_template_marketplace: {
        Row: {
          author_id: string
          created_at: string
          description: string | null
          downloads: number
          id: string
          payload: Json
          title: string
        }
        Insert: {
          author_id: string
          created_at?: string
          description?: string | null
          downloads?: number
          id?: string
          payload?: Json
          title: string
        }
        Update: {
          author_id?: string
          created_at?: string
          description?: string | null
          downloads?: number
          id?: string
          payload?: Json
          title?: string
        }
        Relationships: []
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_index?: number
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          class_id: string | null
          created_at: string
          created_by: string
          ends_at: string | null
          id: string
          options: Json
          question: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          created_by: string
          ends_at?: string | null
          id?: string
          options: Json
          question: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          created_by?: string
          ends_at?: string | null
          id?: string
          options?: Json
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_kind: string
          active_frame: string | null
          active_theme: string | null
          active_title: string | null
          avatar_url: string | null
          created_at: string
          deletion_code: string | null
          deletion_code_expires_at: string | null
          deletion_scheduled_at: string | null
          display_name: string | null
          email: string | null
          id: string
          notify_announcements: boolean
          notify_chat: boolean
          notify_daily_reminder: boolean
          notify_email: boolean
          notify_streak_break: boolean
          reminder_time: string
          theme: string
          updated_at: string
          username: string | null
        }
        Insert: {
          account_kind?: string
          active_frame?: string | null
          active_theme?: string | null
          active_title?: string | null
          avatar_url?: string | null
          created_at?: string
          deletion_code?: string | null
          deletion_code_expires_at?: string | null
          deletion_scheduled_at?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          notify_announcements?: boolean
          notify_chat?: boolean
          notify_daily_reminder?: boolean
          notify_email?: boolean
          notify_streak_break?: boolean
          reminder_time?: string
          theme?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          account_kind?: string
          active_frame?: string | null
          active_theme?: string | null
          active_title?: string | null
          avatar_url?: string | null
          created_at?: string
          deletion_code?: string | null
          deletion_code_expires_at?: string | null
          deletion_scheduled_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          notify_announcements?: boolean
          notify_chat?: boolean
          notify_daily_reminder?: boolean
          notify_email?: boolean
          notify_streak_break?: boolean
          reminder_time?: string
          theme?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      question_creator_applications: {
        Row: {
          created_at: string
          duration_days: number
          id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_days?: number
          id?: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_days?: number
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          answer: string
          attempts: number | null
          created_at: string
          explanation: string | null
          format: string
          id: string
          options: Json | null
          question: string
          topic: string
          user_id: string
          was_wrong: boolean | null
        }
        Insert: {
          answer: string
          attempts?: number | null
          created_at?: string
          explanation?: string | null
          format: string
          id?: string
          options?: Json | null
          question: string
          topic: string
          user_id: string
          was_wrong?: boolean | null
        }
        Update: {
          answer?: string
          attempts?: number | null
          created_at?: string
          explanation?: string | null
          format?: string
          id?: string
          options?: Json | null
          question?: string
          topic?: string
          user_id?: string
          was_wrong?: boolean | null
        }
        Relationships: []
      }
      quiz_battles: {
        Row: {
          challenger_id: string
          challenger_score: number
          created_at: string
          genre: string | null
          id: string
          num_questions: number
          opponent_id: string
          opponent_score: number
          status: string
          time_taken: number | null
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          challenger_id: string
          challenger_score?: number
          created_at?: string
          genre?: string | null
          id?: string
          num_questions?: number
          opponent_id: string
          opponent_score?: number
          status?: string
          time_taken?: number | null
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          challenger_id?: string
          challenger_score?: number
          created_at?: string
          genre?: string | null
          id?: string
          num_questions?: number
          opponent_id?: string
          opponent_score?: number
          status?: string
          time_taken?: number | null
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      rivals: {
        Row: {
          created_at: string
          id: string
          rival_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rival_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rival_id?: string
          user_id?: string
        }
        Relationships: []
      }
      school_timetable: {
        Row: {
          created_at: string
          end_time: string
          id: string
          label: string | null
          period: number
          start_time: string
          subject_id: string | null
          user_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          label?: string | null
          period: number
          start_time: string
          subject_id?: string | null
          user_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          label?: string | null
          period?: number
          start_time?: string
          subject_id?: string | null
          user_id?: string
          weekday?: number
        }
        Relationships: []
      }
      school_timetable_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_public: boolean
          name: string
          payload: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          payload?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          payload?: Json
        }
        Relationships: []
      }
      season_xp: {
        Row: {
          id: string
          season_key: string
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          id?: string
          season_key: string
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          id?: string
          season_key?: string
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      service_restrictions: {
        Row: {
          message: string | null
          restricted: boolean
          restricted_until: string | null
          service_key: string
          updated_at: string
        }
        Insert: {
          message?: string | null
          restricted?: boolean
          restricted_until?: string | null
          service_key: string
          updated_at?: string
        }
        Update: {
          message?: string | null
          restricted?: boolean
          restricted_until?: string | null
          service_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      share_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          label: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          label?: string | null
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          label?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      srs_reviews: {
        Row: {
          created_at: string
          ease: number
          flashcard_id: string
          id: string
          interval_days: number
          last_rating: number | null
          next_review_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ease?: number
          flashcard_id: string
          id?: string
          interval_days?: number
          last_rating?: number | null
          next_review_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ease?: number
          flashcard_id?: string
          id?: string
          interval_days?: number
          last_rating?: number | null
          next_review_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sticky_notes: {
        Row: {
          color: string
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          x: number
          y: number
        }
        Insert: {
          color?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          x?: number
          y?: number
        }
        Update: {
          color?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          x?: number
          y?: number
        }
        Relationships: []
      }
      streak_freezes: {
        Row: {
          date: string
          id: string
          used_at: string
          user_id: string
        }
        Insert: {
          date: string
          id?: string
          used_at?: string
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          used_at?: string
          user_id?: string
        }
        Relationships: []
      }
      streak_insurance_uses: {
        Row: {
          created_at: string
          id: string
          used_for_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          used_for_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          used_for_date?: string
          user_id?: string
        }
        Relationships: []
      }
      study_logs: {
        Row: {
          content: string | null
          created_at: string
          date: string
          duration_minutes: number
          id: string
          start_time: string | null
          subject_id: string | null
          tag: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          date?: string
          duration_minutes?: number
          id?: string
          start_time?: string | null
          subject_id?: string | null
          tag?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          date?: string
          duration_minutes?: number
          id?: string
          start_time?: string | null
          subject_id?: string | null
          tag?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_logs_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plans: {
        Row: {
          content: string | null
          created_at: string
          date: string
          done: boolean
          id: string
          planned_minutes: number
          start_time: string | null
          subject_id: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          date: string
          done?: boolean
          id?: string
          planned_minutes?: number
          start_time?: string | null
          subject_id?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          date?: string
          done?: boolean
          id?: string
          planned_minutes?: number
          start_time?: string | null
          subject_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_plans_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      study_room_sessions: {
        Row: {
          duration_minutes: number | null
          ended_at: string | null
          id: string
          room_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          room_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          room_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          assignment_id: string
          attachments: Json
          content: string | null
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          quiz_answers: Json | null
          score: number | null
          submitted_at: string
          user_id: string
          xp_awarded: number
        }
        Insert: {
          assignment_id: string
          attachments?: Json
          content?: string | null
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          quiz_answers?: Json | null
          score?: number | null
          submitted_at?: string
          user_id: string
          xp_awarded?: number
        }
        Update: {
          assignment_id?: string
          attachments?: Json
          content?: string | null
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          quiz_answers?: Json | null
          score?: number | null
          submitted_at?: string
          user_id?: string
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_question_creators: {
        Row: {
          created_at: string
          expires_at: string
          granted_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          granted_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          granted_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      test_countdowns: {
        Row: {
          created_at: string
          id: string
          plan_text: string | null
          subject: string | null
          test_date: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_text?: string | null
          subject?: string | null
          test_date: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_text?: string | null
          subject?: string | null
          test_date?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      time_category_settings: {
        Row: {
          category: string
          color: string
          created_at: string
          id: string
          label: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          color: string
          created_at?: string
          id?: string
          label?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          id?: string
          label?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          category: string
          color: string | null
          created_at: string
          date: string
          end_time: string
          id: string
          label: string | null
          note: string | null
          start_time: string
          subject_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          color?: string | null
          created_at?: string
          date?: string
          end_time: string
          id?: string
          label?: string | null
          note?: string | null
          start_time: string
          subject_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          label?: string | null
          note?: string | null
          start_time?: string
          subject_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      today_activities: {
        Row: {
          category: string
          color: string
          created_at: string
          default_duration_min: number
          id: string
          location: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          color?: string
          created_at?: string
          default_duration_min?: number
          id?: string
          location?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          default_duration_min?: number
          id?: string
          location?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      today_entries: {
        Row: {
          activity_id: string | null
          category: string
          color: string
          created_at: string
          date: string
          end_time: string
          id: string
          label: string | null
          notes: string | null
          start_time: string
          subject_id: string | null
          travel_after_min: number
          travel_before_min: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          category: string
          color?: string
          created_at?: string
          date?: string
          end_time: string
          id?: string
          label?: string | null
          notes?: string | null
          start_time: string
          subject_id?: string | null
          travel_after_min?: number
          travel_before_min?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          category?: string
          color?: string
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          label?: string | null
          notes?: string | null
          start_time?: string
          subject_id?: string | null
          travel_after_min?: number
          travel_before_min?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "today_entries_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "today_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      today_templates: {
        Row: {
          auto_weekdays: number[]
          created_at: string
          id: string
          kind: string
          name: string
          payload: Json
          shared: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_weekdays?: number[]
          created_at?: string
          id?: string
          kind?: string
          name: string
          payload?: Json
          shared?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_weekdays?: number[]
          created_at?: string
          id?: string
          kind?: string
          name?: string
          payload?: Json
          shared?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      town_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      town_history: {
        Row: {
          ai_response: Json | null
          created_at: string
          delta: number
          id: string
          narrative: string | null
          reason: string | null
          stage_after: number
          stage_before: number
          town_id: string
          user_id: string
        }
        Insert: {
          ai_response?: Json | null
          created_at?: string
          delta: number
          id?: string
          narrative?: string | null
          reason?: string | null
          stage_after: number
          stage_before: number
          town_id: string
          user_id: string
        }
        Update: {
          ai_response?: Json | null
          created_at?: string
          delta?: number
          id?: string
          narrative?: string | null
          reason?: string | null
          stage_after?: number
          stage_before?: number
          town_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "town_history_town_id_fkey"
            columns: ["town_id"]
            isOneToOne: false
            referencedRelation: "towns"
            referencedColumns: ["id"]
          },
        ]
      }
      town_items: {
        Row: {
          created_at: string
          id: string
          item_key: string
          user_id: string
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_key: string
          user_id: string
          x?: number
          y?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_key?: string
          user_id?: string
          x?: number
          y?: number
        }
        Relationships: []
      }
      towns: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          last_judged_at: string | null
          max_stage_reached: number
          name: string
          stage: number
          town_goal: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          last_judged_at?: string | null
          max_stage_reached?: number
          name?: string
          stage?: number
          town_goal?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          last_judged_at?: string | null
          max_stage_reached?: number
          name?: string
          stage?: number
          town_goal?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tutor_messages: {
        Row: {
          attachments: Json
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string | null
          user_id: string
        }
        Insert: {
          attachments?: Json
          content: string
          created_at?: string
          id?: string
          role: string
          thread_id?: string | null
          user_id: string
        }
        Update: {
          attachments?: Json
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tutor_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      unit_roadmap: {
        Row: {
          created_at: string
          id: string
          parent_unit_id: string | null
          sort_order: number
          unit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_unit_id?: string | null
          sort_order?: number
          unit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_unit_id?: string | null
          sort_order?: number
          unit_id?: string
        }
        Relationships: []
      }
      user_badge_progress: {
        Row: {
          badge_code: string
          id: string
          progress: number
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          badge_code: string
          id?: string
          progress?: number
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          badge_code?: string
          id?: string
          progress?: number
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_code: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_code: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_code?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_coins: {
        Row: {
          balance: number
          daily_earned: number
          daily_earned_date: string | null
          total_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          daily_earned?: number
          daily_earned_date?: string | null
          total_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          daily_earned?: number
          daily_earned_date?: string | null
          total_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_inventory: {
        Row: {
          category: string
          created_at: string
          id: string
          item_code: string
          payload: Json
          quantity: number
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          item_code: string
          payload?: Json
          quantity?: number
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          item_code?: string
          payload?: Json
          quantity?: number
          user_id?: string
        }
        Relationships: []
      }
      user_prefs: {
        Row: {
          act_as_admin: boolean
          font_family: string | null
          font_scale: number
          high_contrast: boolean
          notif_settings: Json | null
          right_dock: Json | null
          sidebar_hidden: Json | null
          theme_color: string | null
          updated_at: string
          user_id: string
          widgets: Json
        }
        Insert: {
          act_as_admin?: boolean
          font_family?: string | null
          font_scale?: number
          high_contrast?: boolean
          notif_settings?: Json | null
          right_dock?: Json | null
          sidebar_hidden?: Json | null
          theme_color?: string | null
          updated_at?: string
          user_id: string
          widgets?: Json
        }
        Update: {
          act_as_admin?: boolean
          font_family?: string | null
          font_scale?: number
          high_contrast?: boolean
          notif_settings?: Json | null
          right_dock?: Json | null
          sidebar_hidden?: Json | null
          theme_color?: string | null
          updated_at?: string
          user_id?: string
          widgets?: Json
        }
        Relationships: []
      }
      user_restrictions: {
        Row: {
          created_at: string
          message: string | null
          restricted: boolean
          restricted_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          message?: string | null
          restricted?: boolean
          restricted_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          message?: string | null
          restricted?: boolean
          restricted_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_service_restrictions: {
        Row: {
          created_at: string
          id: string
          message: string | null
          restricted: boolean
          restricted_until: string | null
          service_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          restricted?: boolean
          restricted_until?: string | null
          service_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          restricted?: boolean
          restricted_until?: string | null
          service_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_titles: {
        Row: {
          earned_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          earned_at?: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          earned_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_parent_reports: {
        Row: {
          child_id: string
          created_at: string
          id: string
          summary: Json
          week_start: string
        }
        Insert: {
          child_id: string
          created_at?: string
          id?: string
          summary?: Json
          week_start: string
        }
        Update: {
          child_id?: string
          created_at?: string
          id?: string
          summary?: Json
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      weekly_coin_leaderboard: {
        Row: {
          avatar_url: string | null
          coins_earned: number | null
          display_name: string | null
          user_id: string | null
          week_start: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_fulfill_redemption: {
        Args: { _approve: boolean; _note: string; _req_id: string }
        Returns: undefined
      }
      admin_grant_coins: {
        Args: { _amount: number; _message: string; _user_id: string }
        Returns: undefined
      }
      admin_makron_analytics: {
        Args: never
        Returns: {
          accuracy: number
          attempts: number
          avg_difficulty: number
          correct: number
          likes: number
          prompt: string
          question_id: string
        }[]
      }
      admin_override_answer_score: {
        Args: { _answer_id: string; _note: string; _score: number }
        Returns: undefined
      }
      admin_review_creator_application: {
        Args: { _app_id: string; _approve: boolean; _days?: number }
        Returns: undefined
      }
      admin_review_organization: {
        Args: { _approve: boolean; _org_id: string }
        Returns: undefined
      }
      admin_review_question: {
        Args: { _approve: boolean; _question_id: string }
        Returns: undefined
      }
      admin_set_user_coins: {
        Args: { _balance: number; _user_id: string }
        Returns: undefined
      }
      admin_set_user_xp: {
        Args: { _user_id: string; _xp: number }
        Returns: undefined
      }
      admin_upsert_shop_item: {
        Args: {
          _auto_grant: boolean
          _category: string
          _code: string
          _consumable: boolean
          _description: string
          _id: string
          _is_active: boolean
          _name: string
          _payload: Json
          _price: number
          _sort_order: number
        }
        Returns: string
      }
      are_mutual_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      can_create_questions: { Args: { _user_id: string }; Returns: boolean }
      can_view_submission: {
        Args: { _assignment_id: string; _user_id: string }
        Returns: boolean
      }
      consume_inventory: {
        Args: { _item_code: string; _qty?: number }
        Returns: number
      }
      finalize_makron_session: {
        Args: { _session_id: string }
        Returns: {
          coins_awarded: number
          total_points: number
          total_score: number
          xp_awarded: number
        }[]
      }
      get_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          display_name: string
          streak_days: number
          total_minutes: number
          user_id: string
        }[]
      }
      get_makron_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          display_name: string
          level: number
          rank: number
          user_id: string
          xp: number
        }[]
      }
      get_my_makron_rank: {
        Args: never
        Returns: {
          level: number
          rank: number
          total_users: number
          xp: number
        }[]
      }
      get_user_study_stats: {
        Args: { _user_ids: string[] }
        Returns: {
          last_date: string
          total_minutes: number
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_class_member: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_class_teacher: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_admin: { Args: { _org: string; _user: string }; Returns: boolean }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      is_parent_of: {
        Args: { _child: string; _parent: string }
        Returns: boolean
      }
      join_class_by_code: { Args: { _code: string }; Returns: string }
      my_org_ids: { Args: never; Returns: string[] }
      org_invite_member: {
        Args: { _message?: string; _org: string; _role?: string; _user: string }
        Returns: string
      }
      org_respond_invitation: {
        Args: { _accept: boolean; _invite_id: string }
        Returns: undefined
      }
      org_review_join_request: {
        Args: {
          _approve: boolean
          _req_id: string
          _role?: Database["public"]["Enums"]["org_role"]
        }
        Returns: undefined
      }
      purchase_shop_item: { Args: { _item_id: string }; Returns: Json }
      send_coin_gift: {
        Args: { _amount: number; _message: string; _to: string }
        Returns: Json
      }
      share_study_summary: {
        Args: { _token: string }
        Returns: {
          color: string
          date: string
          minutes: number
          subject_name: string
        }[]
      }
      spend_coins: {
        Args: { _amount: number; _meta?: Json; _reason: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "user"
      org_role: "owner" | "admin" | "teacher" | "member"
      org_status: "pending" | "approved" | "rejected" | "suspended"
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
      app_role: ["admin", "user"],
      org_role: ["owner", "admin", "teacher", "member"],
      org_status: ["pending", "approved", "rejected", "suspended"],
    },
  },
} as const
