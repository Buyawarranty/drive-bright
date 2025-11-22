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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      abandoned_cart_email_templates: {
        Row: {
          created_at: string | null
          html_content: string
          id: string
          is_active: boolean | null
          name: string
          send_delay_minutes: number | null
          subject: string
          text_content: string | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          html_content: string
          id?: string
          is_active?: boolean | null
          name: string
          send_delay_minutes?: number | null
          subject: string
          text_content?: string | null
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          html_content?: string
          id?: string
          is_active?: boolean | null
          name?: string
          send_delay_minutes?: number | null
          subject?: string
          text_content?: string | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      abandoned_carts: {
        Row: {
          cart_metadata: Json | null
          contact_notes: string | null
          contact_status: string | null
          contacted_by: string | null
          converted_at: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_converted: boolean | null
          last_contacted_at: string | null
          mileage: string | null
          payment_type: string | null
          phone: string | null
          plan_id: string | null
          plan_name: string | null
          step_abandoned: number
          updated_at: string
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_reg: string | null
          vehicle_type: string | null
          vehicle_year: string | null
        }
        Insert: {
          cart_metadata?: Json | null
          contact_notes?: string | null
          contact_status?: string | null
          contacted_by?: string | null
          converted_at?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_converted?: boolean | null
          last_contacted_at?: string | null
          mileage?: string | null
          payment_type?: string | null
          phone?: string | null
          plan_id?: string | null
          plan_name?: string | null
          step_abandoned: number
          updated_at?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_reg?: string | null
          vehicle_type?: string | null
          vehicle_year?: string | null
        }
        Update: {
          cart_metadata?: Json | null
          contact_notes?: string | null
          contact_status?: string | null
          contacted_by?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_converted?: boolean | null
          last_contacted_at?: string | null
          mileage?: string | null
          payment_type?: string | null
          phone?: string | null
          plan_id?: string | null
          plan_name?: string | null
          step_abandoned?: number
          updated_at?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_reg?: string | null
          vehicle_type?: string | null
          vehicle_year?: string | null
        }
        Relationships: []
      }
      admin_config: {
        Row: {
          config_key: string
          config_value: boolean
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value: boolean
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: boolean
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      admin_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invitation_token: string
          invited_by: string
          permissions: Json
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invitation_token: string
          invited_by: string
          permissions?: Json
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invitation_token?: string
          invited_by?: string
          permissions?: Json
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      admin_notes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          note: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          note: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          permission_key: string
          permission_name: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          permission_key: string
          permission_name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          permission_key?: string
          permission_name?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean
          last_login: string | null
          last_name: string | null
          permissions: Json
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          last_login?: string | null
          last_name?: string | null
          permissions?: Json
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          last_login?: string | null
          last_name?: string | null
          permissions?: Json
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      blocked_ips: {
        Row: {
          blocked_at: string
          blocked_until: string | null
          created_by: string | null
          id: string
          ip_address: unknown
          reason: string
        }
        Insert: {
          blocked_at?: string
          blocked_until?: string | null
          created_by?: string | null
          id?: string
          ip_address: unknown
          reason: string
        }
        Update: {
          blocked_at?: string
          blocked_until?: string | null
          created_by?: string | null
          id?: string
          ip_address?: unknown
          reason?: string
        }
        Relationships: []
      }
      blog_authors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      blog_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      blog_comments: {
        Row: {
          author_email: string
          author_name: string
          content: string
          created_at: string | null
          id: string
          is_approved: boolean | null
          post_id: string | null
        }
        Insert: {
          author_email: string
          author_name: string
          content: string
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          post_id?: string | null
        }
        Update: {
          author_email?: string
          author_name?: string
          content?: string
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_tags: {
        Row: {
          post_id: string
          tag_id: string
        }
        Insert: {
          post_id: string
          tag_id: string
        }
        Update: {
          post_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_post_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "blog_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          canonical_url: string | null
          category_id: string | null
          content: Json
          created_at: string | null
          created_by: string | null
          enable_comments: boolean | null
          excerpt: string | null
          featured_image_url: string | null
          id: string
          is_featured: boolean | null
          meta_tags: Json | null
          published_at: string | null
          read_time_minutes: number | null
          scheduled_for: string | null
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
          slug: string
          status: string | null
          structured_data: Json | null
          title: string
          updated_at: string | null
          view_count: number | null
          word_count: number | null
        }
        Insert: {
          author_id?: string | null
          canonical_url?: string | null
          category_id?: string | null
          content: Json
          created_at?: string | null
          created_by?: string | null
          enable_comments?: boolean | null
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          is_featured?: boolean | null
          meta_tags?: Json | null
          published_at?: string | null
          read_time_minutes?: number | null
          scheduled_for?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          slug: string
          status?: string | null
          structured_data?: Json | null
          title: string
          updated_at?: string | null
          view_count?: number | null
          word_count?: number | null
        }
        Update: {
          author_id?: string | null
          canonical_url?: string | null
          category_id?: string | null
          content?: Json
          created_at?: string | null
          created_by?: string | null
          enable_comments?: boolean | null
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          is_featured?: boolean | null
          meta_tags?: Json | null
          published_at?: string | null
          read_time_minutes?: number | null
          scheduled_for?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          slug?: string
          status?: string | null
          structured_data?: Json | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "blog_authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_tags: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      brevo_sync_log: {
        Row: {
          brevo_contact_id: string | null
          created_at: string
          customer_email: string
          error_message: string | null
          event_data: Json | null
          event_type: string
          id: string
          sync_status: string | null
          updated_at: string
        }
        Insert: {
          brevo_contact_id?: string | null
          created_at?: string
          customer_email: string
          error_message?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          sync_status?: string | null
          updated_at?: string
        }
        Update: {
          brevo_contact_id?: string | null
          created_at?: string
          customer_email?: string
          error_message?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          sync_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bumper_transactions: {
        Row: {
          add_another_warranty: boolean | null
          claim_limit: number | null
          created_at: string
          customer_data: Json
          discount_code: string | null
          final_amount: number
          id: string
          payment_type: string
          plan_id: string
          protection_addons: Json | null
          redirect_url: string
          status: string | null
          transaction_id: string
          updated_at: string
          vehicle_data: Json
        }
        Insert: {
          add_another_warranty?: boolean | null
          claim_limit?: number | null
          created_at?: string
          customer_data: Json
          discount_code?: string | null
          final_amount: number
          id?: string
          payment_type: string
          plan_id: string
          protection_addons?: Json | null
          redirect_url: string
          status?: string | null
          transaction_id: string
          updated_at?: string
          vehicle_data: Json
        }
        Update: {
          add_another_warranty?: boolean | null
          claim_limit?: number | null
          created_at?: string
          customer_data?: Json
          discount_code?: string | null
          final_amount?: number
          id?: string
          payment_type?: string
          plan_id?: string
          protection_addons?: Json | null
          redirect_url?: string
          status?: string | null
          transaction_id?: string
          updated_at?: string
          vehicle_data?: Json
        }
        Relationships: []
      }
      campaign_analytics: {
        Row: {
          bounce_rate: number | null
          campaign_id: string
          click_rate: number | null
          created_at: string
          id: string
          last_calculated_at: string | null
          open_rate: number | null
          total_bounced: number | null
          total_clicked: number | null
          total_complained: number | null
          total_delivered: number | null
          total_failed: number | null
          total_opened: number | null
          total_sent: number | null
          total_unsubscribed: number | null
          unsubscribe_rate: number | null
        }
        Insert: {
          bounce_rate?: number | null
          campaign_id: string
          click_rate?: number | null
          created_at?: string
          id?: string
          last_calculated_at?: string | null
          open_rate?: number | null
          total_bounced?: number | null
          total_clicked?: number | null
          total_complained?: number | null
          total_delivered?: number | null
          total_failed?: number | null
          total_opened?: number | null
          total_sent?: number | null
          total_unsubscribed?: number | null
          unsubscribe_rate?: number | null
        }
        Update: {
          bounce_rate?: number | null
          campaign_id?: string
          click_rate?: number | null
          created_at?: string
          id?: string
          last_calculated_at?: string | null
          open_rate?: number | null
          total_bounced?: number | null
          total_clicked?: number | null
          total_complained?: number | null
          total_delivered?: number | null
          total_failed?: number | null
          total_opened?: number | null
          total_sent?: number | null
          total_unsubscribed?: number | null
          unsubscribe_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_analytics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      claims_submissions: {
        Row: {
          approved_at: string | null
          assigned_to: string | null
          claim_reason: string | null
          created_at: string
          date_of_incident: string | null
          email: string
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          internal_notes: string | null
          message: string | null
          mileage_at_claim: number | null
          name: string
          paid_at: string | null
          payment_amount: number | null
          phone: string | null
          rejected_at: string | null
          rejection_reason: string | null
          status: string
          updated_at: string
          vehicle_registration: string | null
          warranty_type: string | null
        }
        Insert: {
          approved_at?: string | null
          assigned_to?: string | null
          claim_reason?: string | null
          created_at?: string
          date_of_incident?: string | null
          email: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          internal_notes?: string | null
          message?: string | null
          mileage_at_claim?: number | null
          name: string
          paid_at?: string | null
          payment_amount?: number | null
          phone?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          vehicle_registration?: string | null
          warranty_type?: string | null
        }
        Update: {
          approved_at?: string | null
          assigned_to?: string | null
          claim_reason?: string | null
          created_at?: string
          date_of_incident?: string | null
          email?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          internal_notes?: string | null
          message?: string | null
          mileage_at_claim?: number | null
          name?: string
          paid_at?: string | null
          payment_amount?: number | null
          phone?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          vehicle_registration?: string | null
          warranty_type?: string | null
        }
        Relationships: []
      }
      click_fraud_protection: {
        Row: {
          action_type: string
          blocked_reason: string | null
          click_count: number
          created_at: string
          id: string
          ip_address: unknown
          is_suspicious: boolean
          risk_score: number
          session_id: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          action_type: string
          blocked_reason?: string | null
          click_count?: number
          created_at?: string
          id?: string
          ip_address: unknown
          is_suspicious?: boolean
          risk_score?: number
          session_id?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          blocked_reason?: string | null
          click_count?: number
          created_at?: string
          id?: string
          ip_address?: unknown
          is_suspicious?: boolean
          risk_score?: number
          session_id?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          assigned_to: string | null
          created_at: string
          email: string
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          message: string | null
          name: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          email: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          email?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_documents: {
        Row: {
          created_at: string
          document_name: string
          file_size: number | null
          file_url: string
          id: string
          plan_type: string
          updated_at: string
          uploaded_by: string | null
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string
          document_name: string
          file_size?: number | null
          file_url: string
          id?: string
          plan_type: string
          updated_at?: string
          uploaded_by?: string | null
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string
          document_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          plan_type?: string
          updated_at?: string
          uploaded_by?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
      }
      customer_note_tags: {
        Row: {
          created_at: string
          id: string
          note_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_id?: string
          tag_id?: string
        }
        Relationships: []
      }
      customer_notes: {
        Row: {
          created_at: string
          created_by: string
          customer_id: string
          id: string
          is_pinned: boolean
          note_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_id: string
          id?: string
          is_pinned?: boolean
          note_text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_id?: string
          id?: string
          is_pinned?: boolean
          note_text?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_notifications: {
        Row: {
          attachment_url: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          id: string
          is_important: boolean | null
          is_read: boolean | null
          message: string
          read_at: string | null
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          id?: string
          is_important?: boolean | null
          is_read?: boolean | null
          message: string
          read_at?: string | null
        }
        Update: {
          attachment_url?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          id?: string
          is_important?: boolean | null
          is_read?: boolean | null
          message?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_policies: {
        Row: {
          address: Json | null
          breakdown_recovery: boolean | null
          bumper_order_id: string | null
          claim_limit: number | null
          consequential: boolean | null
          created_at: string
          customer_full_name: string | null
          customer_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          document_type: string | null
          email: string
          email_sent_at: string | null
          email_sent_status: string | null
          europe_cover: boolean | null
          id: string
          is_deleted: boolean | null
          last_login: string | null
          lost_key: boolean | null
          mot_fee: boolean | null
          mot_repair: boolean | null
          payment_amount: number | null
          payment_currency: string | null
          payment_type: string
          pdf_basic_url: string | null
          pdf_document_path: string | null
          pdf_gold_url: string | null
          pdf_platinum_url: string | null
          plan_type: string
          policy_end_date: string
          policy_number: string
          policy_start_date: string
          seasonal_bonus_months: number | null
          status: string
          stripe_session_id: string | null
          stripe_subscription_id: string | null
          transfer_cover: boolean | null
          tyre_cover: boolean | null
          updated_at: string
          user_id: string | null
          vehicle_rental: boolean | null
          voluntary_excess: number | null
          warranties_2000_response: Json | null
          warranties_2000_sent_at: string | null
          warranties_2000_status: string | null
          warranty_number: string | null
          wear_tear: boolean | null
        }
        Insert: {
          address?: Json | null
          breakdown_recovery?: boolean | null
          bumper_order_id?: string | null
          claim_limit?: number | null
          consequential?: boolean | null
          created_at?: string
          customer_full_name?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          document_type?: string | null
          email: string
          email_sent_at?: string | null
          email_sent_status?: string | null
          europe_cover?: boolean | null
          id?: string
          is_deleted?: boolean | null
          last_login?: string | null
          lost_key?: boolean | null
          mot_fee?: boolean | null
          mot_repair?: boolean | null
          payment_amount?: number | null
          payment_currency?: string | null
          payment_type: string
          pdf_basic_url?: string | null
          pdf_document_path?: string | null
          pdf_gold_url?: string | null
          pdf_platinum_url?: string | null
          plan_type: string
          policy_end_date: string
          policy_number: string
          policy_start_date?: string
          seasonal_bonus_months?: number | null
          status?: string
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          transfer_cover?: boolean | null
          tyre_cover?: boolean | null
          updated_at?: string
          user_id?: string | null
          vehicle_rental?: boolean | null
          voluntary_excess?: number | null
          warranties_2000_response?: Json | null
          warranties_2000_sent_at?: string | null
          warranties_2000_status?: string | null
          warranty_number?: string | null
          wear_tear?: boolean | null
        }
        Update: {
          address?: Json | null
          breakdown_recovery?: boolean | null
          bumper_order_id?: string | null
          claim_limit?: number | null
          consequential?: boolean | null
          created_at?: string
          customer_full_name?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          document_type?: string | null
          email?: string
          email_sent_at?: string | null
          email_sent_status?: string | null
          europe_cover?: boolean | null
          id?: string
          is_deleted?: boolean | null
          last_login?: string | null
          lost_key?: boolean | null
          mot_fee?: boolean | null
          mot_repair?: boolean | null
          payment_amount?: number | null
          payment_currency?: string | null
          payment_type?: string
          pdf_basic_url?: string | null
          pdf_document_path?: string | null
          pdf_gold_url?: string | null
          pdf_platinum_url?: string | null
          plan_type?: string
          policy_end_date?: string
          policy_number?: string
          policy_start_date?: string
          seasonal_bonus_months?: number | null
          status?: string
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          transfer_cover?: boolean | null
          tyre_cover?: boolean | null
          updated_at?: string
          user_id?: string | null
          vehicle_rental?: boolean | null
          voluntary_excess?: number | null
          warranties_2000_response?: Json | null
          warranties_2000_sent_at?: string | null
          warranties_2000_status?: string | null
          warranty_number?: string | null
          wear_tear?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_customer_policies_customer_id"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_surveys: {
        Row: {
          created_at: string
          ease_explanation: string | null
          ease_rating: string
          id: string
          other_reason: string | null
          policy_number: string
          reasons_chosen: string[]
          submitted_at: string
          suggestions: string | null
        }
        Insert: {
          created_at?: string
          ease_explanation?: string | null
          ease_rating: string
          id?: string
          other_reason?: string | null
          policy_number: string
          reasons_chosen: string[]
          submitted_at?: string
          suggestions?: string | null
        }
        Update: {
          created_at?: string
          ease_explanation?: string | null
          ease_rating?: string
          id?: string
          other_reason?: string | null
          policy_number?: string
          reasons_chosen?: string[]
          submitted_at?: string
          suggestions?: string | null
        }
        Relationships: []
      }
      customer_tag_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          customer_id: string
          id: string
          tag_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          customer_id: string
          id?: string
          tag_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          customer_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tag_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "customer_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          category: string
          color: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category: string
          color?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          assigned_to: string | null
          breakdown_recovery: boolean | null
          brevo_contact_id: string | null
          building_name: string | null
          building_number: string | null
          bumper_order_id: string | null
          claim_limit: number | null
          consequential: boolean | null
          country: string | null
          county: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          discount_amount: number | null
          discount_code: string | null
          email: string
          europe_cover: boolean | null
          final_amount: number | null
          first_name: string | null
          flat_number: string | null
          id: string
          is_deleted: boolean | null
          last_login: string | null
          last_name: string | null
          lost_key: boolean | null
          mileage: string | null
          mot_fee: boolean | null
          mot_repair: boolean | null
          name: string
          original_amount: number | null
          payment_type: string | null
          phone: string | null
          plan_type: string
          postcode: string | null
          registration_plate: string | null
          review_email_sent_at: string | null
          seasonal_bonus_months: number | null
          signup_date: string
          status: string
          street: string | null
          stripe_customer_id: string | null
          stripe_session_id: string | null
          town: string | null
          transfer_cover: boolean | null
          tyre_cover: boolean | null
          updated_at: string
          vehicle_fuel_type: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_rental: boolean | null
          vehicle_transmission: string | null
          vehicle_year: string | null
          voluntary_excess: number | null
          warranty_number: string | null
          warranty_reference_number: string | null
          wear_tear: boolean | null
        }
        Insert: {
          assigned_to?: string | null
          breakdown_recovery?: boolean | null
          brevo_contact_id?: string | null
          building_name?: string | null
          building_number?: string | null
          bumper_order_id?: string | null
          claim_limit?: number | null
          consequential?: boolean | null
          country?: string | null
          county?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          email: string
          europe_cover?: boolean | null
          final_amount?: number | null
          first_name?: string | null
          flat_number?: string | null
          id?: string
          is_deleted?: boolean | null
          last_login?: string | null
          last_name?: string | null
          lost_key?: boolean | null
          mileage?: string | null
          mot_fee?: boolean | null
          mot_repair?: boolean | null
          name: string
          original_amount?: number | null
          payment_type?: string | null
          phone?: string | null
          plan_type: string
          postcode?: string | null
          registration_plate?: string | null
          review_email_sent_at?: string | null
          seasonal_bonus_months?: number | null
          signup_date?: string
          status?: string
          street?: string | null
          stripe_customer_id?: string | null
          stripe_session_id?: string | null
          town?: string | null
          transfer_cover?: boolean | null
          tyre_cover?: boolean | null
          updated_at?: string
          vehicle_fuel_type?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_rental?: boolean | null
          vehicle_transmission?: string | null
          vehicle_year?: string | null
          voluntary_excess?: number | null
          warranty_number?: string | null
          warranty_reference_number?: string | null
          wear_tear?: boolean | null
        }
        Update: {
          assigned_to?: string | null
          breakdown_recovery?: boolean | null
          brevo_contact_id?: string | null
          building_name?: string | null
          building_number?: string | null
          bumper_order_id?: string | null
          claim_limit?: number | null
          consequential?: boolean | null
          country?: string | null
          county?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          email?: string
          europe_cover?: boolean | null
          final_amount?: number | null
          first_name?: string | null
          flat_number?: string | null
          id?: string
          is_deleted?: boolean | null
          last_login?: string | null
          last_name?: string | null
          lost_key?: boolean | null
          mileage?: string | null
          mot_fee?: boolean | null
          mot_repair?: boolean | null
          name?: string
          original_amount?: number | null
          payment_type?: string | null
          phone?: string | null
          plan_type?: string
          postcode?: string | null
          registration_plate?: string | null
          review_email_sent_at?: string | null
          seasonal_bonus_months?: number | null
          signup_date?: string
          status?: string
          street?: string | null
          stripe_customer_id?: string | null
          stripe_session_id?: string | null
          town?: string | null
          transfer_cover?: boolean | null
          tyre_cover?: boolean | null
          updated_at?: string
          vehicle_fuel_type?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_rental?: boolean | null
          vehicle_transmission?: string | null
          vehicle_year?: string | null
          voluntary_excess?: number | null
          warranty_number?: string | null
          warranty_reference_number?: string | null
          wear_tear?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_code_usage: {
        Row: {
          customer_email: string
          discount_amount: number
          discount_code_id: string
          id: string
          order_amount: number
          stripe_session_id: string | null
          used_at: string
        }
        Insert: {
          customer_email: string
          discount_amount: number
          discount_code_id: string
          id?: string
          order_amount: number
          stripe_session_id?: string | null
          used_at?: string
        }
        Update: {
          customer_email?: string
          discount_amount?: number
          discount_code_id?: string
          id?: string
          order_amount?: number
          stripe_session_id?: string | null
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_code_usage_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          active: boolean
          applicable_products: Json
          archived: boolean | null
          auto_archived_at: string | null
          auto_archived_reason: string | null
          campaign_source: string | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_referral_code: boolean | null
          referrer_email: string | null
          stripe_coupon_id: string | null
          stripe_promo_code_id: string | null
          type: string
          updated_at: string
          usage_limit: number | null
          used_count: number
          valid_from: string
          valid_to: string
          value: number
        }
        Insert: {
          active?: boolean
          applicable_products?: Json
          archived?: boolean | null
          auto_archived_at?: string | null
          auto_archived_reason?: string | null
          campaign_source?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_referral_code?: boolean | null
          referrer_email?: string | null
          stripe_coupon_id?: string | null
          stripe_promo_code_id?: string | null
          type: string
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          valid_from?: string
          valid_to: string
          value: number
        }
        Update: {
          active?: boolean
          applicable_products?: Json
          archived?: boolean | null
          auto_archived_at?: string | null
          auto_archived_reason?: string | null
          campaign_source?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_referral_code?: boolean | null
          referrer_email?: string | null
          stripe_coupon_id?: string | null
          stripe_promo_code_id?: string | null
          type?: string
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          valid_from?: string
          valid_to?: string
          value?: number
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          ab_test_parent_id: string | null
          ab_variant: string | null
          campaign_type: string
          content: string
          created_at: string
          created_by: string | null
          from_email: string
          id: string
          is_ab_test: boolean | null
          metadata: Json | null
          name: string
          scheduled_for: string | null
          segment_filters: Json | null
          sent_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          ab_test_parent_id?: string | null
          ab_variant?: string | null
          campaign_type?: string
          content: string
          created_at?: string
          created_by?: string | null
          from_email?: string
          id?: string
          is_ab_test?: boolean | null
          metadata?: Json | null
          name: string
          scheduled_for?: string | null
          segment_filters?: Json | null
          sent_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          ab_test_parent_id?: string | null
          ab_variant?: string | null
          campaign_type?: string
          content?: string
          created_at?: string
          created_by?: string | null
          from_email?: string
          id?: string
          is_ab_test?: boolean | null
          metadata?: Json | null
          name?: string
          scheduled_for?: string | null
          segment_filters?: Json | null
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_ab_test_parent_id_fkey"
            columns: ["ab_test_parent_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_consents: {
        Row: {
          consent_date: string
          consent_given: boolean | null
          double_opt_in: boolean | null
          email: string
          id: string
          ip_address: string | null
          metadata: Json | null
          source: string | null
          unsubscribe_reason: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          consent_date?: string
          consent_given?: boolean | null
          double_opt_in?: boolean | null
          email: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          source?: string | null
          unsubscribe_reason?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          consent_date?: string
          consent_given?: boolean | null
          double_opt_in?: boolean | null
          email?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          source?: string | null
          unsubscribe_reason?: string | null
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          bounced_at: string | null
          campaign_id: string | null
          click_tracked: boolean | null
          clicked_at: string | null
          content: string | null
          conversion_tracked: boolean | null
          created_at: string
          customer_id: string | null
          delivery_status: string | null
          error_message: string | null
          failed_reason: string | null
          id: string
          last_resent_at: string | null
          meta_pixel_tracked: boolean | null
          metadata: Json | null
          open_tracked: boolean | null
          opened_at: string | null
          recipient_email: string
          recipient_name: string | null
          resend_count: number | null
          sent_at: string | null
          status: string
          subject: string
          template_id: string | null
          tracking_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          bounced_at?: string | null
          campaign_id?: string | null
          click_tracked?: boolean | null
          clicked_at?: string | null
          content?: string | null
          conversion_tracked?: boolean | null
          created_at?: string
          customer_id?: string | null
          delivery_status?: string | null
          error_message?: string | null
          failed_reason?: string | null
          id?: string
          last_resent_at?: string | null
          meta_pixel_tracked?: boolean | null
          metadata?: Json | null
          open_tracked?: boolean | null
          opened_at?: string | null
          recipient_email: string
          recipient_name?: string | null
          resend_count?: number | null
          sent_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
          tracking_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          bounced_at?: string | null
          campaign_id?: string | null
          click_tracked?: boolean | null
          clicked_at?: string | null
          content?: string | null
          conversion_tracked?: boolean | null
          created_at?: string
          customer_id?: string | null
          delivery_status?: string | null
          error_message?: string | null
          failed_reason?: string | null
          id?: string
          last_resent_at?: string | null
          meta_pixel_tracked?: boolean | null
          metadata?: Json | null
          open_tracked?: boolean | null
          opened_at?: string | null
          recipient_email?: string
          recipient_name?: string | null
          resend_count?: number | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          tracking_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          from_email: string
          id: string
          is_active: boolean
          name: string
          subject: string
          template_type: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          from_email?: string
          id?: string
          is_active?: boolean
          name: string
          subject: string
          template_type: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          from_email?: string
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_tracking_events: {
        Row: {
          created_at: string | null
          email_log_id: string | null
          event_data: Json | null
          event_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          email_log_id?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          email_log_id?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_tracking_events_email_log_id_fkey"
            columns: ["email_log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      mot_history: {
        Row: {
          co2_emissions: number | null
          colour: string | null
          created_at: string | null
          customer_id: string | null
          date_of_last_v5c_issued: string | null
          dvla_id: string | null
          engine_capacity: number | null
          euro_status: string | null
          fuel_type: string | null
          id: string
          make: string | null
          manufacture_date: string | null
          marked_for_export: boolean | null
          model: string | null
          mot_expiry_date: string | null
          mot_tests: Json
          primary_colour: string | null
          real_driving_emissions: string | null
          registration: string
          registration_date: string | null
          revenue_weight: number | null
          type_approval: string | null
          updated_at: string | null
          wheelplan: string | null
        }
        Insert: {
          co2_emissions?: number | null
          colour?: string | null
          created_at?: string | null
          customer_id?: string | null
          date_of_last_v5c_issued?: string | null
          dvla_id?: string | null
          engine_capacity?: number | null
          euro_status?: string | null
          fuel_type?: string | null
          id?: string
          make?: string | null
          manufacture_date?: string | null
          marked_for_export?: boolean | null
          model?: string | null
          mot_expiry_date?: string | null
          mot_tests?: Json
          primary_colour?: string | null
          real_driving_emissions?: string | null
          registration: string
          registration_date?: string | null
          revenue_weight?: number | null
          type_approval?: string | null
          updated_at?: string | null
          wheelplan?: string | null
        }
        Update: {
          co2_emissions?: number | null
          colour?: string | null
          created_at?: string | null
          customer_id?: string | null
          date_of_last_v5c_issued?: string | null
          dvla_id?: string | null
          engine_capacity?: number | null
          euro_status?: string | null
          fuel_type?: string | null
          id?: string
          make?: string | null
          manufacture_date?: string | null
          marked_for_export?: boolean | null
          model?: string | null
          mot_expiry_date?: string | null
          mot_tests?: Json
          primary_colour?: string | null
          real_driving_emissions?: string | null
          registration?: string
          registration_date?: string | null
          revenue_weight?: number | null
          type_approval?: string | null
          updated_at?: string | null
          wheelplan?: string | null
        }
        Relationships: []
      }
      newsletter_signups: {
        Row: {
          created_at: string
          discount_amount: number | null
          discount_code_sent: boolean | null
          discount_code_used: boolean | null
          email: string
          id: string
          ip_address: string | null
          source: string | null
          status: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          discount_amount?: number | null
          discount_code_sent?: boolean | null
          discount_code_used?: boolean | null
          email: string
          id?: string
          ip_address?: string | null
          source?: string | null
          status?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          discount_amount?: number | null
          discount_code_sent?: boolean | null
          discount_code_used?: boolean | null
          email?: string
          id?: string
          ip_address?: string | null
          source?: string | null
          status?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      note_tags: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          customer_id: string
          id: string
          payment_date: string
          plan_type: string
          stripe_payment_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          customer_id: string
          id?: string
          payment_date?: string
          plan_type: string
          stripe_payment_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          customer_id?: string
          id?: string
          payment_date?: string
          plan_type?: string
          stripe_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_document_mapping: {
        Row: {
          created_at: string
          document_path: string
          id: string
          plan_name: string
          updated_at: string
          vehicle_type: string
        }
        Insert: {
          created_at?: string
          document_path: string
          id?: string
          plan_name: string
          updated_at?: string
          vehicle_type: string
        }
        Update: {
          created_at?: string
          document_path?: string
          id?: string
          plan_name?: string
          updated_at?: string
          vehicle_type?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          add_ons: Json
          coverage: Json
          created_at: string
          id: string
          is_active: boolean
          monthly_price: number
          name: string
          pricing_matrix: Json | null
          three_yearly_price: number | null
          two_yearly_price: number | null
          updated_at: string
          yearly_price: number | null
        }
        Insert: {
          add_ons?: Json
          coverage?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_price: number
          name: string
          pricing_matrix?: Json | null
          three_yearly_price?: number | null
          two_yearly_price?: number | null
          updated_at?: string
          yearly_price?: number | null
        }
        Update: {
          add_ons?: Json
          coverage?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_price?: number
          name?: string
          pricing_matrix?: Json | null
          three_yearly_price?: number | null
          two_yearly_price?: number | null
          updated_at?: string
          yearly_price?: number | null
        }
        Relationships: []
      }
      quote_data: {
        Row: {
          created_at: string
          customer_email: string
          expires_at: string
          id: string
          plan_data: Json | null
          quote_id: string
          vehicle_data: Json
        }
        Insert: {
          created_at?: string
          customer_email: string
          expires_at?: string
          id?: string
          plan_data?: Json | null
          quote_id: string
          vehicle_data: Json
        }
        Update: {
          created_at?: string
          customer_email?: string
          expires_at?: string
          id?: string
          plan_data?: Json | null
          quote_id?: string
          vehicle_data?: Json
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action_type: string
          created_at: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          converted_at: string | null
          created_at: string
          discount_code: string | null
          discount_code_id: string | null
          friend_email: string
          id: string
          referrer_email: string
          referrer_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          discount_code?: string | null
          discount_code_id?: string | null
          friend_email: string
          id?: string
          referrer_email: string
          referrer_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          discount_code?: string | null
          discount_code_id?: string | null
          friend_email?: string
          id?: string
          referrer_email?: string
          referrer_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_targets: {
        Row: {
          achieved_amount: number
          admin_user_id: string
          created_at: string
          end_date: string
          id: string
          start_date: string
          target_amount: number
          target_period: string
          updated_at: string
        }
        Insert: {
          achieved_amount?: number
          admin_user_id: string
          created_at?: string
          end_date: string
          id?: string
          start_date: string
          target_amount: number
          target_period: string
          updated_at?: string
        }
        Update: {
          achieved_amount?: number
          admin_user_id?: string
          created_at?: string
          end_date?: string
          id?: string
          start_date?: string
          target_amount?: number
          target_period?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_targets_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_emails: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          metadata: Json | null
          recipient_email: string
          scheduled_for: string
          status: string
          template_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          metadata?: Json | null
          recipient_email: string
          scheduled_for: string
          status?: string
          template_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          metadata?: Json | null
          recipient_email?: string
          scheduled_for?: string
          status?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_emails_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_emails_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      special_vehicle_plans: {
        Row: {
          coverage: Json
          created_at: string
          id: string
          is_active: boolean
          monthly_price: number
          name: string
          pricing_matrix: Json | null
          three_yearly_price: number | null
          two_yearly_price: number | null
          updated_at: string
          vehicle_type: string
          yearly_price: number | null
        }
        Insert: {
          coverage?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_price: number
          name: string
          pricing_matrix?: Json | null
          three_yearly_price?: number | null
          two_yearly_price?: number | null
          updated_at?: string
          vehicle_type: string
          yearly_price?: number | null
        }
        Update: {
          coverage?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_price?: number
          name?: string
          pricing_matrix?: Json | null
          three_yearly_price?: number | null
          two_yearly_price?: number | null
          updated_at?: string
          vehicle_type?: string
          yearly_price?: number | null
        }
        Relationships: []
      }
      subscriber_segments: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          filters: Json
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriber_tags: {
        Row: {
          added_at: string
          added_by: string | null
          email: string
          id: string
          tag: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          email: string
          id?: string
          tag: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          email?: string
          id?: string
          tag?: string
        }
        Relationships: []
      }
      triggered_emails_log: {
        Row: {
          cart_id: string | null
          created_at: string | null
          email: string
          email_status: string | null
          id: string
          sent_at: string | null
          template_id: string | null
          trigger_type: string
          vehicle_reg: string | null
        }
        Insert: {
          cart_id?: string | null
          created_at?: string | null
          email: string
          email_status?: string | null
          id?: string
          sent_at?: string | null
          template_id?: string | null
          trigger_type: string
          vehicle_reg?: string | null
        }
        Update: {
          cart_id?: string | null
          created_at?: string | null
          email?: string
          email_status?: string | null
          id?: string
          sent_at?: string | null
          template_id?: string | null
          trigger_type?: string
          vehicle_reg?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "triggered_emails_log_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "abandoned_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "triggered_emails_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "abandoned_cart_email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      trustpilot_review_emails: {
        Row: {
          created_at: string
          customer_id: string | null
          email: string
          email_log_id: string | null
          id: string
          policy_id: string
          sent_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          email: string
          email_log_id?: string | null
          id?: string
          policy_id: string
          sent_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          email?: string
          email_log_id?: string | null
          id?: string
          policy_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trustpilot_review_emails_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trustpilot_review_emails_email_log_id_fkey"
            columns: ["email_log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trustpilot_review_emails_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "customer_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      warranties_2000_audit_log: {
        Row: {
          action_type: string
          admin_email: string | null
          admin_user_id: string | null
          created_at: string | null
          customer_id: string | null
          data_sent: Json
          id: string
          notes: string | null
          policy_id: string | null
          w2k_response: Json | null
        }
        Insert: {
          action_type: string
          admin_email?: string | null
          admin_user_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          data_sent: Json
          id?: string
          notes?: string | null
          policy_id?: string | null
          w2k_response?: Json | null
        }
        Update: {
          action_type?: string
          admin_email?: string | null
          admin_user_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          data_sent?: Json
          id?: string
          notes?: string | null
          policy_id?: string | null
          w2k_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "warranties_2000_audit_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_2000_audit_log_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "customer_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_audit_log: {
        Row: {
          created_by: string | null
          customer_id: string | null
          event_data: Json | null
          event_timestamp: string
          event_type: string
          id: string
          policy_id: string | null
        }
        Insert: {
          created_by?: string | null
          customer_id?: string | null
          event_data?: Json | null
          event_timestamp?: string
          event_type: string
          id?: string
          policy_id?: string | null
        }
        Update: {
          created_by?: string | null
          customer_id?: string | null
          event_data?: Json | null
          event_timestamp?: string
          event_type?: string
          id?: string
          policy_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warranty_audit_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_audit_log_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "customer_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_selection_audit: {
        Row: {
          add_ons: Json | null
          admin_sync_at: string | null
          admin_sync_status: string
          checksum: string
          created_at: string
          customer_data: Json
          customer_email: string
          discount_applied: Json | null
          id: string
          last_retry_at: string | null
          payment_type: string
          quoted_price: number
          retry_count: number
          selected_plan_id: string | null
          selected_plan_name: string
          session_id: string
          updated_at: string
          vehicle_data: Json
          verification_errors: Json | null
          verification_status: string
          w2000_response: Json | null
          w2000_sync_at: string | null
          w2000_sync_status: string
        }
        Insert: {
          add_ons?: Json | null
          admin_sync_at?: string | null
          admin_sync_status?: string
          checksum: string
          created_at?: string
          customer_data: Json
          customer_email: string
          discount_applied?: Json | null
          id?: string
          last_retry_at?: string | null
          payment_type: string
          quoted_price: number
          retry_count?: number
          selected_plan_id?: string | null
          selected_plan_name: string
          session_id: string
          updated_at?: string
          vehicle_data: Json
          verification_errors?: Json | null
          verification_status?: string
          w2000_response?: Json | null
          w2000_sync_at?: string | null
          w2000_sync_status?: string
        }
        Update: {
          add_ons?: Json | null
          admin_sync_at?: string | null
          admin_sync_status?: string
          checksum?: string
          created_at?: string
          customer_data?: Json
          customer_email?: string
          discount_applied?: Json | null
          id?: string
          last_retry_at?: string | null
          payment_type?: string
          quoted_price?: number
          retry_count?: number
          selected_plan_id?: string | null
          selected_plan_name?: string
          session_id?: string
          updated_at?: string
          vehicle_data?: Json
          verification_errors?: Json | null
          verification_status?: string
          w2000_response?: Json | null
          w2000_sync_at?: string | null
          w2000_sync_status?: string
        }
        Relationships: []
      }
      warranty_serials: {
        Row: {
          id: number
          last_serial: number
          updated_at: string | null
        }
        Insert: {
          id?: number
          last_serial?: number
          updated_at?: string | null
        }
        Update: {
          id?: number
          last_serial?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      welcome_emails: {
        Row: {
          created_at: string
          email: string
          email_sent_at: string
          id: string
          password_reset: boolean
          password_reset_by_user: boolean
          policy_id: string | null
          temporary_password: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          email_sent_at?: string
          id?: string
          password_reset?: boolean
          password_reset_by_user?: boolean
          policy_id?: string | null
          temporary_password: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          email_sent_at?: string
          id?: string
          password_reset?: boolean
          password_reset_by_user?: boolean
          policy_id?: string | null
          temporary_password?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "welcome_emails_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "customer_policies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      monthly_claims_stats: {
        Row: {
          approved_claims: number | null
          avg_claim_value: number | null
          month: string | null
          rejected_claims: number | null
          total_claims: number | null
          total_paid: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_expire_discount_codes: { Args: never; Returns: number }
      calculate_policy_end_date: {
        Args: { payment_type: string; start_date: string }
        Returns: string
      }
      fix_customer_role: { Args: { p_user_id: string }; Returns: undefined }
      generate_policy_number: { Args: never; Returns: string }
      generate_random_password: { Args: never; Returns: string }
      generate_warranty_audit_checksum: {
        Args: {
          customer_email: string
          payment_type: string
          quoted_price: number
          selected_plan_name: string
          session_id: string
        }
        Returns: string
      }
      generate_warranty_number: { Args: never; Returns: string }
      get_next_warranty_serial: { Args: never; Returns: number }
      has_admin_permission: {
        Args: { permission_key: string; user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_blog_writer: { Args: { user_id: string }; Returns: boolean }
      is_ip_blocked: { Args: { check_ip: unknown }; Returns: boolean }
      log_click_activity: {
        Args: {
          p_action_type: string
          p_ip_address: unknown
          p_risk_score?: number
          p_session_id: string
          p_user_agent: string
        }
        Returns: boolean
      }
      log_warranty_event: {
        Args: {
          p_created_by?: string
          p_customer_id: string
          p_event_data?: Json
          p_event_type: string
          p_policy_id: string
        }
        Returns: string
      }
      make_user_admin: { Args: { user_email: string }; Returns: undefined }
      restore_customer: { Args: { customer_uuid: string }; Returns: undefined }
      soft_delete_customer: {
        Args: { admin_uuid: string; customer_uuid: string }
        Returns: undefined
      }
      update_campaign_analytics: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      verify_warranty_selection: { Args: { audit_id: string }; Returns: Json }
    }
    Enums: {
      user_role:
        | "admin"
        | "customer"
        | "member"
        | "viewer"
        | "guest"
        | "blog_writer"
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
      user_role: [
        "admin",
        "customer",
        "member",
        "viewer",
        "guest",
        "blog_writer",
      ],
    },
  },
} as const
