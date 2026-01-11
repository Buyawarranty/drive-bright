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
      abandoned_cart_emails: {
        Row: {
          abandoned_cart_id: string | null
          created_at: string
          customer_email: string
          email_type: string
          id: string
          plan_name: string | null
          price_amount: number | null
          sent_at: string
          sent_by: string | null
          subject: string
          vehicle_reg: string | null
        }
        Insert: {
          abandoned_cart_id?: string | null
          created_at?: string
          customer_email: string
          email_type: string
          id?: string
          plan_name?: string | null
          price_amount?: number | null
          sent_at?: string
          sent_by?: string | null
          subject: string
          vehicle_reg?: string | null
        }
        Update: {
          abandoned_cart_id?: string | null
          created_at?: string
          customer_email?: string
          email_type?: string
          id?: string
          plan_name?: string | null
          price_amount?: number | null
          sent_at?: string
          sent_by?: string | null
          subject?: string
          vehicle_reg?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_cart_emails_abandoned_cart_id_fkey"
            columns: ["abandoned_cart_id"]
            isOneToOne: false
            referencedRelation: "abandoned_carts"
            referencedColumns: ["id"]
          },
        ]
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
      access_requests: {
        Row: {
          company: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
          reason: string
          rejection_reason: string | null
          requested_role: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          phone?: string | null
          reason: string
          rejection_reason?: string | null
          requested_role?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          reason?: string
          rejection_reason?: string | null
          requested_role?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
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
      admin_sent_quotes: {
        Row: {
          additional_notes: string | null
          boost_addon: boolean | null
          claim_limit: number
          created_at: string | null
          customer_email: string
          customer_name: string
          customer_purchased: boolean | null
          customer_responded: boolean | null
          email_content: string
          email_subject: string
          excess_amount: number
          id: string
          labour_rate: number | null
          last_resent_at: string | null
          monthly_price: number | null
          notes: string | null
          payment_type: string
          plan_name: string
          quote_reference: string
          resent_count: number | null
          sent_at: string
          sent_by: string | null
          total_price: number
          updated_at: string | null
          vehicle_fuel_type: string | null
          vehicle_make: string | null
          vehicle_mileage: string | null
          vehicle_model: string | null
          vehicle_reg: string
          vehicle_transmission: string | null
          vehicle_type: string | null
          vehicle_year: string | null
        }
        Insert: {
          additional_notes?: string | null
          boost_addon?: boolean | null
          claim_limit: number
          created_at?: string | null
          customer_email: string
          customer_name: string
          customer_purchased?: boolean | null
          customer_responded?: boolean | null
          email_content: string
          email_subject: string
          excess_amount: number
          id?: string
          labour_rate?: number | null
          last_resent_at?: string | null
          monthly_price?: number | null
          notes?: string | null
          payment_type: string
          plan_name?: string
          quote_reference?: string
          resent_count?: number | null
          sent_at?: string
          sent_by?: string | null
          total_price: number
          updated_at?: string | null
          vehicle_fuel_type?: string | null
          vehicle_make?: string | null
          vehicle_mileage?: string | null
          vehicle_model?: string | null
          vehicle_reg: string
          vehicle_transmission?: string | null
          vehicle_type?: string | null
          vehicle_year?: string | null
        }
        Update: {
          additional_notes?: string | null
          boost_addon?: boolean | null
          claim_limit?: number
          created_at?: string | null
          customer_email?: string
          customer_name?: string
          customer_purchased?: boolean | null
          customer_responded?: boolean | null
          email_content?: string
          email_subject?: string
          excess_amount?: number
          id?: string
          labour_rate?: number | null
          last_resent_at?: string | null
          monthly_price?: number | null
          notes?: string | null
          payment_type?: string
          plan_name?: string
          quote_reference?: string
          resent_count?: number | null
          sent_at?: string
          sent_by?: string | null
          total_price?: number
          updated_at?: string | null
          vehicle_fuel_type?: string | null
          vehicle_make?: string | null
          vehicle_mileage?: string | null
          vehicle_model?: string | null
          vehicle_reg?: string
          vehicle_transmission?: string | null
          vehicle_type?: string | null
          vehicle_year?: string | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          column_masking: Json | null
          created_at: string
          department: string | null
          email: string
          first_name: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean
          last_login: string | null
          last_name: string | null
          permissions: Json
          policy_id: string | null
          require_2fa: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          column_masking?: Json | null
          created_at?: string
          department?: string | null
          email: string
          first_name?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          last_login?: string | null
          last_name?: string | null
          permissions?: Json
          policy_id?: string | null
          require_2fa?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          column_masking?: Json | null
          created_at?: string
          department?: string | null
          email?: string
          first_name?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          last_login?: string | null
          last_name?: string | null
          permissions?: Json
          policy_id?: string | null
          require_2fa?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "permission_policies"
            referencedColumns: ["id"]
          },
        ]
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
          client_id: string | null
          conversion_fired_at: string | null
          conversion_status: string | null
          created_at: string
          customer_data: Json
          discount_code: string | null
          final_amount: number
          gclid: string | null
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
          client_id?: string | null
          conversion_fired_at?: string | null
          conversion_status?: string | null
          created_at?: string
          customer_data: Json
          discount_code?: string | null
          final_amount: number
          gclid?: string | null
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
          client_id?: string | null
          conversion_fired_at?: string | null
          conversion_status?: string | null
          created_at?: string
          customer_data?: Json
          discount_code?: string | null
          final_amount?: number
          gclid?: string | null
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
      claim_communications: {
        Row: {
          claim_id: string
          communication_type: string
          created_at: string
          direction: string
          id: string
          message: string
          metadata: Json | null
          recipient_email: string | null
          sender_email: string | null
          sent_by: string | null
          subject: string | null
        }
        Insert: {
          claim_id: string
          communication_type?: string
          created_at?: string
          direction: string
          id?: string
          message: string
          metadata?: Json | null
          recipient_email?: string | null
          sender_email?: string | null
          sent_by?: string | null
          subject?: string | null
        }
        Update: {
          claim_id?: string
          communication_type?: string
          created_at?: string
          direction?: string
          id?: string
          message?: string
          metadata?: Json | null
          recipient_email?: string | null
          sender_email?: string | null
          sent_by?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_communications_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_tags: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
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
          follow_up_date: string | null
          id: string
          internal_notes: string | null
          last_contacted_at: string | null
          message: string | null
          mileage_at_claim: number | null
          name: string
          paid_at: string | null
          payment_amount: number | null
          phone: string | null
          priority: string | null
          rejected_at: string | null
          rejection_reason: string | null
          status: string
          tag_id: string | null
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
          follow_up_date?: string | null
          id?: string
          internal_notes?: string | null
          last_contacted_at?: string | null
          message?: string | null
          mileage_at_claim?: number | null
          name: string
          paid_at?: string | null
          payment_amount?: number | null
          phone?: string | null
          priority?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          tag_id?: string | null
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
          follow_up_date?: string | null
          id?: string
          internal_notes?: string | null
          last_contacted_at?: string | null
          message?: string | null
          mileage_at_claim?: number | null
          name?: string
          paid_at?: string | null
          payment_amount?: number | null
          phone?: string | null
          priority?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          tag_id?: string | null
          updated_at?: string
          vehicle_registration?: string | null
          warranty_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_submissions_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "claim_tags"
            referencedColumns: ["id"]
          },
        ]
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
      commission_records: {
        Row: {
          admin_user_id: string | null
          approved_at: string | null
          approved_by: string | null
          bonus_amount: number | null
          commission_amount: number | null
          commission_rate: number | null
          created_at: string
          deals_count: number | null
          id: string
          notes: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          status: string | null
          total_sales_value: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_user_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bonus_amount?: number | null
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          deals_count?: number | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: string | null
          total_sales_value?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_user_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bonus_amount?: number | null
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          deals_count?: number | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: string | null
          total_sales_value?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_records_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
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
          is_manual_entry: boolean | null
          last_login: string | null
          lost_key: boolean | null
          manual_upgrade_at: string | null
          manual_upgrade_by: string | null
          manual_upgrade_notes: string | null
          mot_fee: boolean | null
          mot_repair: boolean | null
          payment_amount: number | null
          payment_currency: string | null
          payment_type: string
          payment_verified: boolean | null
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
          warranties_2000_scheduled_for: string | null
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
          is_manual_entry?: boolean | null
          last_login?: string | null
          lost_key?: boolean | null
          manual_upgrade_at?: string | null
          manual_upgrade_by?: string | null
          manual_upgrade_notes?: string | null
          mot_fee?: boolean | null
          mot_repair?: boolean | null
          payment_amount?: number | null
          payment_currency?: string | null
          payment_type: string
          payment_verified?: boolean | null
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
          warranties_2000_scheduled_for?: string | null
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
          is_manual_entry?: boolean | null
          last_login?: string | null
          lost_key?: boolean | null
          manual_upgrade_at?: string | null
          manual_upgrade_by?: string | null
          manual_upgrade_notes?: string | null
          mot_fee?: boolean | null
          mot_repair?: boolean | null
          payment_amount?: number | null
          payment_currency?: string | null
          payment_type?: string
          payment_verified?: boolean | null
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
          warranties_2000_scheduled_for?: string | null
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
          google_review_completed: boolean | null
          google_review_completed_at: string | null
          google_review_requested: boolean | null
          google_review_requested_at: string | null
          id: string
          is_deleted: boolean | null
          is_manual_entry: boolean | null
          labour_rate: number | null
          last_login: string | null
          last_name: string | null
          lost_key: boolean | null
          manual_upgrade_at: string | null
          manual_upgrade_by: string | null
          manual_upgrade_notes: string | null
          mileage: string | null
          mot_fee: boolean | null
          mot_repair: boolean | null
          name: string
          original_amount: number | null
          payment_type: string | null
          payment_verified: boolean | null
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
          trustpilot_review_completed: boolean | null
          trustpilot_review_completed_at: string | null
          trustpilot_review_requested: boolean | null
          trustpilot_review_requested_at: string | null
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
          google_review_completed?: boolean | null
          google_review_completed_at?: string | null
          google_review_requested?: boolean | null
          google_review_requested_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_manual_entry?: boolean | null
          labour_rate?: number | null
          last_login?: string | null
          last_name?: string | null
          lost_key?: boolean | null
          manual_upgrade_at?: string | null
          manual_upgrade_by?: string | null
          manual_upgrade_notes?: string | null
          mileage?: string | null
          mot_fee?: boolean | null
          mot_repair?: boolean | null
          name: string
          original_amount?: number | null
          payment_type?: string | null
          payment_verified?: boolean | null
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
          trustpilot_review_completed?: boolean | null
          trustpilot_review_completed_at?: string | null
          trustpilot_review_requested?: boolean | null
          trustpilot_review_requested_at?: string | null
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
          google_review_completed?: boolean | null
          google_review_completed_at?: string | null
          google_review_requested?: boolean | null
          google_review_requested_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_manual_entry?: boolean | null
          labour_rate?: number | null
          last_login?: string | null
          last_name?: string | null
          lost_key?: boolean | null
          manual_upgrade_at?: string | null
          manual_upgrade_by?: string | null
          manual_upgrade_notes?: string | null
          mileage?: string | null
          mot_fee?: boolean | null
          mot_repair?: boolean | null
          name?: string
          original_amount?: number | null
          payment_type?: string | null
          payment_verified?: boolean | null
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
          trustpilot_review_completed?: boolean | null
          trustpilot_review_completed_at?: string | null
          trustpilot_review_requested?: boolean | null
          trustpilot_review_requested_at?: string | null
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
      deal_records: {
        Row: {
          admin_user_id: string | null
          commission_record_id: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          deal_date: string
          deal_value: number
          id: string
          notes: string | null
          plan_type: string | null
          updated_at: string
          user_id: string
          vehicle_reg: string | null
        }
        Insert: {
          admin_user_id?: string | null
          commission_record_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          deal_date?: string
          deal_value: number
          id?: string
          notes?: string | null
          plan_type?: string | null
          updated_at?: string
          user_id: string
          vehicle_reg?: string | null
        }
        Update: {
          admin_user_id?: string | null
          commission_record_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          deal_date?: string
          deal_value?: number
          id?: string
          notes?: string | null
          plan_type?: string | null
          updated_at?: string
          user_id?: string
          vehicle_reg?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_records_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_records_commission_record_id_fkey"
            columns: ["commission_record_id"]
            isOneToOne: false
            referencedRelation: "commission_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
      landing_pages: {
        Row: {
          brand_logo_url: string | null
          brand_name: string
          canonical_url: string | null
          conversion_count: number | null
          coverage_content: Json | null
          created_at: string
          created_by: string | null
          faqs: Json | null
          featured_image_url: string | null
          features_content: Json | null
          focus_keyword: string | null
          h1_headline: string
          hero_content: Json | null
          id: string
          include_breadcrumb_schema: boolean | null
          include_faq_schema: boolean | null
          include_local_business_schema: boolean | null
          include_organization_schema: boolean | null
          include_product_schema: boolean | null
          include_review_schema: boolean | null
          internal_links: Json | null
          is_indexable: boolean | null
          last_edited_by: string | null
          local_business_address: Json | null
          local_business_email: string | null
          local_business_geo: Json | null
          local_business_name: string | null
          local_business_phone: string | null
          meta_description: string
          meta_title: string
          nav_order: number | null
          og_description: string | null
          og_image_url: string | null
          og_title: string | null
          page_type: string | null
          pricing_content: Json | null
          published_at: string | null
          robots_directive: string | null
          scheduled_for: string | null
          secondary_keywords: string[] | null
          show_in_footer: boolean | null
          show_in_main_nav: boolean | null
          show_on_homepage: boolean | null
          slug: string
          status: string | null
          supporting_images: Json | null
          testimonials_content: Json | null
          updated_at: string
          view_count: number | null
        }
        Insert: {
          brand_logo_url?: string | null
          brand_name: string
          canonical_url?: string | null
          conversion_count?: number | null
          coverage_content?: Json | null
          created_at?: string
          created_by?: string | null
          faqs?: Json | null
          featured_image_url?: string | null
          features_content?: Json | null
          focus_keyword?: string | null
          h1_headline: string
          hero_content?: Json | null
          id?: string
          include_breadcrumb_schema?: boolean | null
          include_faq_schema?: boolean | null
          include_local_business_schema?: boolean | null
          include_organization_schema?: boolean | null
          include_product_schema?: boolean | null
          include_review_schema?: boolean | null
          internal_links?: Json | null
          is_indexable?: boolean | null
          last_edited_by?: string | null
          local_business_address?: Json | null
          local_business_email?: string | null
          local_business_geo?: Json | null
          local_business_name?: string | null
          local_business_phone?: string | null
          meta_description: string
          meta_title: string
          nav_order?: number | null
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          page_type?: string | null
          pricing_content?: Json | null
          published_at?: string | null
          robots_directive?: string | null
          scheduled_for?: string | null
          secondary_keywords?: string[] | null
          show_in_footer?: boolean | null
          show_in_main_nav?: boolean | null
          show_on_homepage?: boolean | null
          slug: string
          status?: string | null
          supporting_images?: Json | null
          testimonials_content?: Json | null
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          brand_logo_url?: string | null
          brand_name?: string
          canonical_url?: string | null
          conversion_count?: number | null
          coverage_content?: Json | null
          created_at?: string
          created_by?: string | null
          faqs?: Json | null
          featured_image_url?: string | null
          features_content?: Json | null
          focus_keyword?: string | null
          h1_headline?: string
          hero_content?: Json | null
          id?: string
          include_breadcrumb_schema?: boolean | null
          include_faq_schema?: boolean | null
          include_local_business_schema?: boolean | null
          include_organization_schema?: boolean | null
          include_product_schema?: boolean | null
          include_review_schema?: boolean | null
          internal_links?: Json | null
          is_indexable?: boolean | null
          last_edited_by?: string | null
          local_business_address?: Json | null
          local_business_email?: string | null
          local_business_geo?: Json | null
          local_business_name?: string | null
          local_business_phone?: string | null
          meta_description?: string
          meta_title?: string
          nav_order?: number | null
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          page_type?: string | null
          pricing_content?: Json | null
          published_at?: string | null
          robots_directive?: string | null
          scheduled_for?: string | null
          secondary_keywords?: string[] | null
          show_in_footer?: boolean | null
          show_in_main_nav?: boolean | null
          show_on_homepage?: boolean | null
          slug?: string
          status?: string | null
          supporting_images?: Json | null
          testimonials_content?: Json | null
          updated_at?: string
          view_count?: number | null
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          id: string
          lead_id: string
          outcome: string | null
          performed_by: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          outcome?: string | null
          performed_by?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          outcome?: string | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sales_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_quick_notes: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          is_pinned: boolean | null
          lead_id: string
          note_text: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          is_pinned?: boolean | null
          lead_id: string
          note_text: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          is_pinned?: boolean | null
          lead_id?: string
          note_text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_quick_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_quick_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sales_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_reminders: {
        Row: {
          created_at: string
          id: string
          label: string | null
          lead_id: string
          reminder_time: string
          snoozed_until: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          lead_id: string
          reminder_time: string
          snoozed_until?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          lead_id?: string
          reminder_time?: string
          snoozed_until?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_tag_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          lead_id: string
          tag_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          lead_id: string
          tag_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          lead_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tag_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tag_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sales_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "lead_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      live_quotes: {
        Row: {
          access_token: string
          additional_notes: string | null
          bonus_months: number
          boost_addon: boolean | null
          breakdown_included: boolean | null
          claim_limit: number
          created_at: string
          created_by: string | null
          created_by_name: string | null
          currency: string | null
          customer_email: string
          customer_name: string
          customer_phone: string | null
          duration_months: number
          excess_amount: number
          expires_at: string
          id: string
          labour_rate: number | null
          monthly_price: number
          paid_at: string | null
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_source: string | null
          plan_type: string
          policy_id: string | null
          policy_number: string | null
          rental_included: boolean | null
          share_link: string | null
          status: string
          updated_at: string
          upfront_price: number
          vehicle_fuel_type: string | null
          vehicle_make: string | null
          vehicle_mileage: string | null
          vehicle_model: string | null
          vehicle_reg: string
          vehicle_transmission: string | null
          vehicle_type: string | null
          vehicle_year: string | null
          viewed_at: string | null
        }
        Insert: {
          access_token: string
          additional_notes?: string | null
          bonus_months?: number
          boost_addon?: boolean | null
          breakdown_included?: boolean | null
          claim_limit?: number
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          currency?: string | null
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          duration_months?: number
          excess_amount?: number
          expires_at?: string
          id?: string
          labour_rate?: number | null
          monthly_price: number
          paid_at?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_source?: string | null
          plan_type?: string
          policy_id?: string | null
          policy_number?: string | null
          rental_included?: boolean | null
          share_link?: string | null
          status?: string
          updated_at?: string
          upfront_price: number
          vehicle_fuel_type?: string | null
          vehicle_make?: string | null
          vehicle_mileage?: string | null
          vehicle_model?: string | null
          vehicle_reg: string
          vehicle_transmission?: string | null
          vehicle_type?: string | null
          vehicle_year?: string | null
          viewed_at?: string | null
        }
        Update: {
          access_token?: string
          additional_notes?: string | null
          bonus_months?: number
          boost_addon?: boolean | null
          breakdown_included?: boolean | null
          claim_limit?: number
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          currency?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          duration_months?: number
          excess_amount?: number
          expires_at?: string
          id?: string
          labour_rate?: number | null
          monthly_price?: number
          paid_at?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_source?: string | null
          plan_type?: string
          policy_id?: string | null
          policy_number?: string | null
          rental_included?: boolean | null
          share_link?: string | null
          status?: string
          updated_at?: string
          upfront_price?: number
          vehicle_fuel_type?: string | null
          vehicle_make?: string | null
          vehicle_mileage?: string | null
          vehicle_model?: string | null
          vehicle_reg?: string
          vehicle_transmission?: string | null
          vehicle_type?: string | null
          vehicle_year?: string | null
          viewed_at?: string | null
        }
        Relationships: []
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
      permission_policies: {
        Row: {
          action_permissions: Json
          approval_required_for_export: boolean | null
          column_masking: Json
          created_at: string
          created_by: string | null
          department: string | null
          description: string | null
          elevated_until: string | null
          export_rate_limit_per_hour: number | null
          id: string
          is_template: boolean | null
          name: string
          require_2fa: boolean | null
          require_sso: boolean | null
          scope_region: string | null
          scope_team: string | null
          session_timeout_minutes: number | null
          tabs_permissions: Json
          updated_at: string
        }
        Insert: {
          action_permissions?: Json
          approval_required_for_export?: boolean | null
          column_masking?: Json
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          elevated_until?: string | null
          export_rate_limit_per_hour?: number | null
          id?: string
          is_template?: boolean | null
          name: string
          require_2fa?: boolean | null
          require_sso?: boolean | null
          scope_region?: string | null
          scope_team?: string | null
          session_timeout_minutes?: number | null
          tabs_permissions?: Json
          updated_at?: string
        }
        Update: {
          action_permissions?: Json
          approval_required_for_export?: boolean | null
          column_masking?: Json
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          elevated_until?: string | null
          export_rate_limit_per_hour?: number | null
          id?: string
          is_template?: boolean | null
          name?: string
          require_2fa?: boolean | null
          require_sso?: boolean | null
          scope_region?: string | null
          scope_team?: string | null
          session_timeout_minutes?: number | null
          tabs_permissions?: Json
          updated_at?: string
        }
        Relationships: []
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
      round_robin_state: {
        Row: {
          id: string
          last_assigned_user_id: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          last_assigned_user_id?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          last_assigned_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_robin_state_last_assigned_user_id_fkey"
            columns: ["last_assigned_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_badges: {
        Row: {
          color: string | null
          created_at: string
          criteria_type: string
          criteria_value: number
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          criteria_type: string
          criteria_value: number
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          criteria_type?: string
          criteria_value?: number
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      sales_leads: {
        Row: {
          abandoned_cart_id: string | null
          assigned_at: string | null
          assigned_to: string | null
          cart_value: number | null
          converted_at: string | null
          created_at: string
          email: string
          first_name: string | null
          follow_up_status: string | null
          id: string
          is_paid: boolean | null
          last_activity_date: string | null
          last_contacted_at: string | null
          last_name: string | null
          lead_source: Database["public"]["Enums"]["lead_source"] | null
          lost_at: string | null
          lost_reason: string | null
          mileage: string | null
          next_action_date: string | null
          next_action_type: string | null
          notes: string | null
          payment_amount: number | null
          payment_date: string | null
          payment_method: string | null
          phone: string | null
          plan_interest: string | null
          priority: Database["public"]["Enums"]["lead_priority"] | null
          priority_score: number | null
          quote_amount: number | null
          status: Database["public"]["Enums"]["lead_status"] | null
          step_two_completed_at: string | null
          updated_at: string
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_reg: string | null
          vehicle_type: string | null
          vehicle_year: string | null
        }
        Insert: {
          abandoned_cart_id?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          cart_value?: number | null
          converted_at?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          follow_up_status?: string | null
          id?: string
          is_paid?: boolean | null
          last_activity_date?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          lead_source?: Database["public"]["Enums"]["lead_source"] | null
          lost_at?: string | null
          lost_reason?: string | null
          mileage?: string | null
          next_action_date?: string | null
          next_action_type?: string | null
          notes?: string | null
          payment_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          phone?: string | null
          plan_interest?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"] | null
          priority_score?: number | null
          quote_amount?: number | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          step_two_completed_at?: string | null
          updated_at?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_reg?: string | null
          vehicle_type?: string | null
          vehicle_year?: string | null
        }
        Update: {
          abandoned_cart_id?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          cart_value?: number | null
          converted_at?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          follow_up_status?: string | null
          id?: string
          is_paid?: boolean | null
          last_activity_date?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          lead_source?: Database["public"]["Enums"]["lead_source"] | null
          lost_at?: string | null
          lost_reason?: string | null
          mileage?: string | null
          next_action_date?: string | null
          next_action_type?: string | null
          notes?: string | null
          payment_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          phone?: string | null
          plan_interest?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"] | null
          priority_score?: number | null
          quote_amount?: number | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          step_two_completed_at?: string | null
          updated_at?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_reg?: string | null
          vehicle_type?: string | null
          vehicle_year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_leads_abandoned_cart_id_fkey"
            columns: ["abandoned_cart_id"]
            isOneToOne: false
            referencedRelation: "abandoned_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "admin_users"
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
      salesperson_stats: {
        Row: {
          avg_response_time_hours: number | null
          conversion_rate: number | null
          created_at: string
          id: string
          leads_assigned: number | null
          leads_contacted: number | null
          leads_converted: number | null
          leads_lost: number | null
          period_end: string
          period_start: string
          total_calls: number | null
          total_emails: number | null
          total_meetings: number | null
          total_revenue: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_response_time_hours?: number | null
          conversion_rate?: number | null
          created_at?: string
          id?: string
          leads_assigned?: number | null
          leads_contacted?: number | null
          leads_converted?: number | null
          leads_lost?: number | null
          period_end: string
          period_start: string
          total_calls?: number | null
          total_emails?: number | null
          total_meetings?: number | null
          total_revenue?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_response_time_hours?: number | null
          conversion_rate?: number | null
          created_at?: string
          id?: string
          leads_assigned?: number | null
          leads_contacted?: number | null
          leads_converted?: number | null
          leads_lost?: number | null
          period_end?: string
          period_start?: string
          total_calls?: number | null
          total_emails?: number | null
          total_meetings?: number | null
          total_revenue?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salesperson_stats_user_id_fkey"
            columns: ["user_id"]
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
      selling_tips: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_pinned: boolean | null
          is_resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean | null
          is_resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean | null
          is_resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "selling_tips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selling_tips_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
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
      staff_timesheets: {
        Row: {
          admin_user_id: string | null
          approved_at: string | null
          approved_by: string | null
          break_minutes: number | null
          created_at: string
          end_time: string | null
          entry_date: string
          entry_type: Database["public"]["Enums"]["timesheet_entry_type"]
          hours_worked: number | null
          id: string
          is_approved: boolean | null
          notes: string | null
          start_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_user_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number | null
          created_at?: string
          end_time?: string | null
          entry_date: string
          entry_type?: Database["public"]["Enums"]["timesheet_entry_type"]
          hours_worked?: number | null
          id?: string
          is_approved?: boolean | null
          notes?: string | null
          start_time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_user_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number | null
          created_at?: string
          end_time?: string | null
          entry_date?: string
          entry_type?: Database["public"]["Enums"]["timesheet_entry_type"]
          hours_worked?: number | null
          id?: string
          is_approved?: boolean | null
          notes?: string | null
          start_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_timesheets_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      structured_customer_notes: {
        Row: {
          actions_taken: Json | null
          call_recording_id: string | null
          claim_reference: string | null
          compliance_notes: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          deadlines: Json | null
          document_ids: string[] | null
          id: string
          interaction_date: string | null
          interaction_type:
            | Database["public"]["Enums"]["interaction_type"]
            | null
          next_steps: Json | null
          policy_number: string | null
          purpose: Database["public"]["Enums"]["note_purpose"] | null
          risk_level: Database["public"]["Enums"]["risk_level"] | null
          risk_reason: string | null
          summary: string
          tags: string[] | null
          title: string
          updated_at: string | null
          updated_by: string | null
          vehicle_reg: string | null
        }
        Insert: {
          actions_taken?: Json | null
          call_recording_id?: string | null
          claim_reference?: string | null
          compliance_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          deadlines?: Json | null
          document_ids?: string[] | null
          id?: string
          interaction_date?: string | null
          interaction_type?:
            | Database["public"]["Enums"]["interaction_type"]
            | null
          next_steps?: Json | null
          policy_number?: string | null
          purpose?: Database["public"]["Enums"]["note_purpose"] | null
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
          risk_reason?: string | null
          summary: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
          vehicle_reg?: string | null
        }
        Update: {
          actions_taken?: Json | null
          call_recording_id?: string | null
          claim_reference?: string | null
          compliance_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          deadlines?: Json | null
          document_ids?: string[] | null
          id?: string
          interaction_date?: string | null
          interaction_type?:
            | Database["public"]["Enums"]["interaction_type"]
            | null
          next_steps?: Json | null
          policy_number?: string | null
          purpose?: Database["public"]["Enums"]["note_purpose"] | null
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
          risk_reason?: string | null
          summary?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          vehicle_reg?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "structured_customer_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structured_customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structured_customer_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
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
      user_activity_log: {
        Row: {
          activity_type: string
          admin_user_id: string | null
          created_at: string
          current_tab: string | null
          id: string
          user_id: string
        }
        Insert: {
          activity_type: string
          admin_user_id?: string | null
          created_at?: string
          current_tab?: string | null
          id?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          admin_user_id?: string | null
          created_at?: string
          current_tab?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_log_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "sales_badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_daily_online_time: {
        Row: {
          admin_user_id: string | null
          created_at: string
          date: string
          first_online_at: string | null
          id: string
          last_online_at: string | null
          session_count: number
          total_online_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_user_id?: string | null
          created_at?: string
          date: string
          first_online_at?: string | null
          id?: string
          last_online_at?: string | null
          session_count?: number
          total_online_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_user_id?: string | null
          created_at?: string
          date?: string
          first_online_at?: string | null
          id?: string
          last_online_at?: string | null
          session_count?: number
          total_online_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_daily_online_time_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_presence: {
        Row: {
          admin_user_id: string | null
          created_at: string
          current_tab: string | null
          device_info: Json | null
          id: string
          last_activity_at: string
          last_seen_at: string
          session_started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_user_id?: string | null
          created_at?: string
          current_tab?: string | null
          device_info?: Json | null
          id?: string
          last_activity_at?: string
          last_seen_at?: string
          session_started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_user_id?: string | null
          created_at?: string
          current_tab?: string | null
          device_info?: Json | null
          id?: string
          last_activity_at?: string
          last_seen_at?: string
          session_started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_presence_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
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
      video_play_tracking: {
        Row: {
          completed: boolean | null
          id: string
          page_url: string | null
          play_duration_seconds: number | null
          played_at: string
          session_id: string | null
          user_agent: string | null
          video_id: string
          video_title: string | null
        }
        Insert: {
          completed?: boolean | null
          id?: string
          page_url?: string | null
          play_duration_seconds?: number | null
          played_at?: string
          session_id?: string | null
          user_agent?: string | null
          video_id: string
          video_title?: string | null
        }
        Update: {
          completed?: boolean | null
          id?: string
          page_url?: string | null
          play_duration_seconds?: number | null
          played_at?: string
          session_id?: string | null
          user_agent?: string | null
          video_id?: string
          video_title?: string | null
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
      calculate_lead_priority_score: {
        Args: {
          p_cart_value: number
          p_has_quote?: boolean
          p_last_activity_date: string
        }
        Returns: number
      }
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
      get_column_mask: {
        Args: { p_column: string; p_user_id: string }
        Returns: string
      }
      get_next_sales_user: { Args: never; Returns: string }
      get_next_warranty_serial: { Args: never; Returns: number }
      get_user_permissions: { Args: { p_user_id: string }; Returns: Json }
      has_admin_permission: {
        Args: { permission_key: string; user_id: string }
        Returns: boolean
      }
      has_tab_permission: {
        Args: { p_action?: string; p_tab: string; p_user_id: string }
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
      set_user_offline: { Args: never; Returns: undefined }
      soft_delete_customer: {
        Args: { admin_uuid: string; customer_uuid: string }
        Returns: undefined
      }
      update_campaign_analytics: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      update_user_presence: {
        Args: { p_current_tab?: string; p_status?: string }
        Returns: string
      }
      verify_warranty_selection: { Args: { audit_id: string }; Returns: Json }
    }
    Enums: {
      action_scope: "none" | "own" | "team" | "department" | "global"
      interaction_type: "call" | "email" | "chat" | "in_person"
      lead_priority: "low" | "medium" | "high" | "urgent"
      lead_source:
        | "website"
        | "referral"
        | "social_ad"
        | "google_ad"
        | "phone"
        | "email"
        | "partner"
        | "other"
      lead_status:
        | "new"
        | "contacted"
        | "follow_up"
        | "quote_sent"
        | "negotiating"
        | "converted"
        | "lost"
      mask_level: "none" | "partial" | "full"
      note_purpose:
        | "claim_query"
        | "sales_enquiry"
        | "cancellation"
        | "renewal"
        | "payment"
        | "general"
        | "complaint"
      risk_level: "low" | "medium" | "high"
      timesheet_entry_type:
        | "worked"
        | "sick"
        | "holiday"
        | "unpaid_leave"
        | "training"
        | "wfh"
      user_role:
        | "admin"
        | "customer"
        | "member"
        | "viewer"
        | "guest"
        | "blog_writer"
        | "sales"
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
      action_scope: ["none", "own", "team", "department", "global"],
      interaction_type: ["call", "email", "chat", "in_person"],
      lead_priority: ["low", "medium", "high", "urgent"],
      lead_source: [
        "website",
        "referral",
        "social_ad",
        "google_ad",
        "phone",
        "email",
        "partner",
        "other",
      ],
      lead_status: [
        "new",
        "contacted",
        "follow_up",
        "quote_sent",
        "negotiating",
        "converted",
        "lost",
      ],
      mask_level: ["none", "partial", "full"],
      note_purpose: [
        "claim_query",
        "sales_enquiry",
        "cancellation",
        "renewal",
        "payment",
        "general",
        "complaint",
      ],
      risk_level: ["low", "medium", "high"],
      timesheet_entry_type: [
        "worked",
        "sick",
        "holiday",
        "unpaid_leave",
        "training",
        "wfh",
      ],
      user_role: [
        "admin",
        "customer",
        "member",
        "viewer",
        "guest",
        "blog_writer",
        "sales",
      ],
    },
  },
} as const
