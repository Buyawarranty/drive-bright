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
      ab_variant_visits: {
        Row: {
          created_at: string
          experiment_key: string
          id: string
          landed_at: string
          page_path: string | null
          session_id: string | null
          source: string | null
          variant: string
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          experiment_key: string
          id?: string
          landed_at?: string
          page_path?: string | null
          session_id?: string | null
          source?: string | null
          variant: string
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          experiment_key?: string
          id?: string
          landed_at?: string
          page_path?: string | null
          session_id?: string | null
          source?: string | null
          variant?: string
          visitor_id?: string | null
        }
        Relationships: []
      }
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
      abandoned_cart_export_items: {
        Row: {
          abandoned_cart_id: string
          created_at: string
          email: string | null
          export_id: string
          id: string
          platform: string
        }
        Insert: {
          abandoned_cart_id: string
          created_at?: string
          email?: string | null
          export_id: string
          id?: string
          platform: string
        }
        Update: {
          abandoned_cart_id?: string
          created_at?: string
          email?: string | null
          export_id?: string
          id?: string
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_cart_export_items_export_id_fkey"
            columns: ["export_id"]
            isOneToOne: false
            referencedRelation: "abandoned_cart_exports"
            referencedColumns: ["id"]
          },
        ]
      }
      abandoned_cart_exports: {
        Row: {
          cart_count: number
          created_at: string
          date_from: string
          date_to: string
          exported_by: string | null
          exported_by_email: string | null
          id: string
          notes: string | null
          platform: string
        }
        Insert: {
          cart_count?: number
          created_at?: string
          date_from: string
          date_to: string
          exported_by?: string | null
          exported_by_email?: string | null
          id?: string
          notes?: string | null
          platform: string
        }
        Update: {
          cart_count?: number
          created_at?: string
          date_from?: string
          date_to?: string
          exported_by?: string | null
          exported_by_email?: string | null
          id?: string
          notes?: string | null
          platform?: string
        }
        Relationships: []
      }
      abandoned_carts: {
        Row: {
          address: Json | null
          boost_addon: boolean | null
          call_count: number | null
          cart_metadata: Json | null
          claim_limit: number | null
          contact_notes: string | null
          contact_status: string | null
          contacted_by: string | null
          converted_at: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_converted: boolean | null
          labour_rate: number | null
          last_contacted_at: string | null
          mileage: string | null
          payment_type: string | null
          phone: string | null
          plan_id: string | null
          plan_name: string | null
          protection_addons: Json | null
          step_abandoned: number
          total_price: number | null
          updated_at: string
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_reg: string | null
          vehicle_type: string | null
          vehicle_year: string | null
          voluntary_excess: number | null
        }
        Insert: {
          address?: Json | null
          boost_addon?: boolean | null
          call_count?: number | null
          cart_metadata?: Json | null
          claim_limit?: number | null
          contact_notes?: string | null
          contact_status?: string | null
          contacted_by?: string | null
          converted_at?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_converted?: boolean | null
          labour_rate?: number | null
          last_contacted_at?: string | null
          mileage?: string | null
          payment_type?: string | null
          phone?: string | null
          plan_id?: string | null
          plan_name?: string | null
          protection_addons?: Json | null
          step_abandoned: number
          total_price?: number | null
          updated_at?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_reg?: string | null
          vehicle_type?: string | null
          vehicle_year?: string | null
          voluntary_excess?: number | null
        }
        Update: {
          address?: Json | null
          boost_addon?: boolean | null
          call_count?: number | null
          cart_metadata?: Json | null
          claim_limit?: number | null
          contact_notes?: string | null
          contact_status?: string | null
          contacted_by?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_converted?: boolean | null
          labour_rate?: number | null
          last_contacted_at?: string | null
          mileage?: string | null
          payment_type?: string | null
          phone?: string | null
          plan_id?: string | null
          plan_name?: string | null
          protection_addons?: Json | null
          step_abandoned?: number
          total_price?: number | null
          updated_at?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_reg?: string | null
          vehicle_type?: string | null
          vehicle_year?: string | null
          voluntary_excess?: number | null
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
          delivery_error: string | null
          delivery_events: Json
          delivery_status: string
          delivery_status_at: string | null
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
          provider_message_id: string | null
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
          delivery_error?: string | null
          delivery_events?: Json
          delivery_status?: string
          delivery_status_at?: string | null
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
          provider_message_id?: string | null
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
          delivery_error?: string | null
          delivery_events?: Json
          delivery_status?: string
          delivery_status_at?: string | null
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
          provider_message_id?: string | null
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
      admin_user_access_periods: {
        Row: {
          admin_user_id: string
          created_at: string
          email: string
          end_date: string | null
          ended_by: string | null
          full_name: string | null
          id: string
          reason: string | null
          role: string
          start_date: string
          started_by: string | null
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          email: string
          end_date?: string | null
          ended_by?: string | null
          full_name?: string | null
          id?: string
          reason?: string | null
          role: string
          start_date?: string
          started_by?: string | null
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          email?: string
          end_date?: string | null
          ended_by?: string | null
          full_name?: string | null
          id?: string
          reason?: string | null
          role?: string
          start_date?: string
          started_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_user_access_periods_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          archived_at: string | null
          blocked_promos: string[]
          callrail_banner_enabled: boolean
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
          max_discount_pct: number | null
          permissions: Json
          policy_id: string | null
          require_2fa: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          sip_extension: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          archived_at?: string | null
          blocked_promos?: string[]
          callrail_banner_enabled?: boolean
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
          max_discount_pct?: number | null
          permissions?: Json
          policy_id?: string | null
          require_2fa?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          sip_extension?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          archived_at?: string | null
          blocked_promos?: string[]
          callrail_banner_enabled?: boolean
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
          max_discount_pct?: number | null
          permissions?: Json
          policy_id?: string | null
          require_2fa?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          sip_extension?: string | null
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
      agent_daily_lead_stats: {
        Row: {
          active_leads_eod: number
          agent_id: string
          callbacks_completed: number
          callbacks_set: number
          calls_logged: number
          created_at: string
          id: string
          leads_assigned: number
          locked_at: string | null
          marked_converted: number
          marked_fake: number
          marked_lost: number
          notes_added: number
          self_assigned: number
          stat_date: string
          status_changes: number
          team_id: string | null
          updated_at: string
        }
        Insert: {
          active_leads_eod?: number
          agent_id: string
          callbacks_completed?: number
          callbacks_set?: number
          calls_logged?: number
          created_at?: string
          id?: string
          leads_assigned?: number
          locked_at?: string | null
          marked_converted?: number
          marked_fake?: number
          marked_lost?: number
          notes_added?: number
          self_assigned?: number
          stat_date: string
          status_changes?: number
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          active_leads_eod?: number
          agent_id?: string
          callbacks_completed?: number
          callbacks_set?: number
          calls_logged?: number
          created_at?: string
          id?: string
          leads_assigned?: number
          locked_at?: string | null
          marked_converted?: number
          marked_fake?: number
          marked_lost?: number
          notes_added?: number
          self_assigned?: number
          stat_date?: string
          status_changes?: number
          team_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agent_daily_targets: {
        Row: {
          actual_leads: number
          actual_sales: number
          agent_id: string
          created_at: string
          id: string
          notes: string | null
          set_by: string
          target_date: string
          target_leads: number
          target_sales: number
          updated_at: string
        }
        Insert: {
          actual_leads?: number
          actual_sales?: number
          agent_id: string
          created_at?: string
          id?: string
          notes?: string | null
          set_by: string
          target_date: string
          target_leads?: number
          target_sales?: number
          updated_at?: string
        }
        Update: {
          actual_leads?: number
          actual_sales?: number
          agent_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          set_by?: string
          target_date?: string
          target_leads?: number
          target_sales?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_daily_targets_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_daily_targets_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_distribution_caps: {
        Row: {
          admin_user_id: string
          allowed_sources: string[] | null
          assigned_today: number | null
          assignment_mode: string
          can_reassign_leads: boolean
          cap_reset_date: string | null
          created_at: string | null
          daily_cap: number | null
          id: string
          last_assigned_at: string | null
          paused: boolean | null
          percentage: number | null
          priority: number | null
          reassign_scope: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          admin_user_id: string
          allowed_sources?: string[] | null
          assigned_today?: number | null
          assignment_mode?: string
          can_reassign_leads?: boolean
          cap_reset_date?: string | null
          created_at?: string | null
          daily_cap?: number | null
          id?: string
          last_assigned_at?: string | null
          paused?: boolean | null
          percentage?: number | null
          priority?: number | null
          reassign_scope?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          admin_user_id?: string
          allowed_sources?: string[] | null
          assigned_today?: number | null
          assignment_mode?: string
          can_reassign_leads?: boolean
          cap_reset_date?: string | null
          created_at?: string | null
          daily_cap?: number | null
          id?: string
          last_assigned_at?: string | null
          paused?: boolean | null
          percentage?: number | null
          priority?: number | null
          reassign_scope?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_distribution_caps_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: true
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_feedback: {
        Row: {
          attachments: Json
          created_at: string
          feedback_type: Database["public"]["Enums"]["agent_feedback_type"]
          id: string
          lead_id: string | null
          lead_reference_text: string | null
          message: string
          resolution_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["agent_feedback_status"]
          submitted_by: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          created_at?: string
          feedback_type: Database["public"]["Enums"]["agent_feedback_type"]
          id?: string
          lead_id?: string | null
          lead_reference_text?: string | null
          message: string
          resolution_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["agent_feedback_status"]
          submitted_by: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          created_at?: string
          feedback_type?: Database["public"]["Enums"]["agent_feedback_type"]
          id?: string
          lead_id?: string | null
          lead_reference_text?: string | null
          message?: string
          resolution_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["agent_feedback_status"]
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_feedback_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sales_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_feedback_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_feedback_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_offboarding_events: {
        Row: {
          also_deactivated: boolean
          created_at: string
          executed_by: string | null
          executed_by_name: string | null
          id: string
          lead_count: number
          notes: string | null
          paid_lead_count: number
          reminder_count: number
          reset_to_new: boolean
          restored_at: string | null
          restored_by: string | null
          restored_lead_count: number | null
          source_admin_user_id: string
          source_email: string | null
          source_name: string | null
          target_admin_user_id: string
          target_email: string | null
          target_name: string | null
        }
        Insert: {
          also_deactivated?: boolean
          created_at?: string
          executed_by?: string | null
          executed_by_name?: string | null
          id?: string
          lead_count?: number
          notes?: string | null
          paid_lead_count?: number
          reminder_count?: number
          reset_to_new?: boolean
          restored_at?: string | null
          restored_by?: string | null
          restored_lead_count?: number | null
          source_admin_user_id: string
          source_email?: string | null
          source_name?: string | null
          target_admin_user_id: string
          target_email?: string | null
          target_name?: string | null
        }
        Update: {
          also_deactivated?: boolean
          created_at?: string
          executed_by?: string | null
          executed_by_name?: string | null
          id?: string
          lead_count?: number
          notes?: string | null
          paid_lead_count?: number
          reminder_count?: number
          reset_to_new?: boolean
          restored_at?: string | null
          restored_by?: string | null
          restored_lead_count?: number | null
          source_admin_user_id?: string
          source_email?: string | null
          source_name?: string | null
          target_admin_user_id?: string
          target_email?: string | null
          target_name?: string | null
        }
        Relationships: []
      }
      agent_offboarding_lead_snapshots: {
        Row: {
          call_logs: Json | null
          changelog: Json | null
          created_at: string
          event_id: string
          id: string
          lead_id: string
          lead_snapshot: Json
          original_assigned_to: string | null
          original_is_paid: boolean | null
          original_status: string | null
          quick_notes: Json | null
          reminders: Json | null
        }
        Insert: {
          call_logs?: Json | null
          changelog?: Json | null
          created_at?: string
          event_id: string
          id?: string
          lead_id: string
          lead_snapshot: Json
          original_assigned_to?: string | null
          original_is_paid?: boolean | null
          original_status?: string | null
          quick_notes?: Json | null
          reminders?: Json | null
        }
        Update: {
          call_logs?: Json | null
          changelog?: Json | null
          created_at?: string
          event_id?: string
          id?: string
          lead_id?: string
          lead_snapshot?: Json
          original_assigned_to?: string | null
          original_is_paid?: boolean | null
          original_status?: string | null
          quick_notes?: Json | null
          reminders?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_offboarding_lead_snapshots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "agent_offboarding_events"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_schedules: {
        Row: {
          admin_user_id: string
          break_end: string | null
          break_start: string | null
          created_at: string | null
          day_of_week: number
          id: string
          is_available: boolean
          shift_end: string
          shift_start: string
          updated_at: string | null
        }
        Insert: {
          admin_user_id: string
          break_end?: string | null
          break_start?: string | null
          created_at?: string | null
          day_of_week: number
          id?: string
          is_available?: boolean
          shift_end?: string
          shift_start?: string
          updated_at?: string | null
        }
        Update: {
          admin_user_id?: string
          break_end?: string | null
          break_start?: string | null
          created_at?: string | null
          day_of_week?: number
          id?: string
          is_available?: boolean
          shift_end?: string
          shift_start?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_schedules_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_weekend_shifts: {
        Row: {
          admin_user_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          shift_date: string
          slot: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          shift_date: string
          slot: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          shift_date?: string
          slot?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_weekend_shifts_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_working_days: {
        Row: {
          admin_user_id: string
          created_at: string
          created_by: string | null
          day_type: string
          id: string
          updated_at: string
          work_date: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          created_by?: string | null
          day_type?: string
          id?: string
          updated_at?: string
          work_date: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          created_by?: string | null
          day_type?: string
          id?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_working_days_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      api_webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          dealer_id: string
          endpoint_id: string
          event_type: string
          id: string
          last_attempt_at: string | null
          max_attempts: number
          next_retry_at: string | null
          payload: Json
          response_body: string | null
          response_status: number | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dealer_id: string
          endpoint_id: string
          event_type: string
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          payload: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dealer_id?: string
          endpoint_id?: string
          event_type?: string
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "api_webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      api_webhook_endpoints: {
        Row: {
          active: boolean
          created_at: string
          dealer_id: string
          events: string[]
          id: string
          secret: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dealer_id: string
          events?: string[]
          id?: string
          secret: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dealer_id?: string
          events?: string[]
          id?: string
          secret?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_webhook_endpoints_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
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
          google_ads_conversion_status: string | null
          google_ads_conversion_uploaded_at: string | null
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
          google_ads_conversion_status?: string | null
          google_ads_conversion_uploaded_at?: string | null
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
          google_ads_conversion_status?: string | null
          google_ads_conversion_uploaded_at?: string | null
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
      callrail_calls: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          answered_at: string | null
          assigned_admin_user_id: string | null
          callback_lead_id: string | null
          caller_city: string | null
          caller_name: string | null
          caller_number: string | null
          caller_state: string | null
          callrail_call_id: string
          created_at: string
          direction: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          matched_customer_id: string | null
          matched_lead_id: string | null
          raw: Json | null
          recording_url: string | null
          started_at: string | null
          status: string
          tracked_number: string | null
          tracker_id: string | null
          tracking_number_id: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          answered_at?: string | null
          assigned_admin_user_id?: string | null
          callback_lead_id?: string | null
          caller_city?: string | null
          caller_name?: string | null
          caller_number?: string | null
          caller_state?: string | null
          callrail_call_id: string
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          matched_customer_id?: string | null
          matched_lead_id?: string | null
          raw?: Json | null
          recording_url?: string | null
          started_at?: string | null
          status?: string
          tracked_number?: string | null
          tracker_id?: string | null
          tracking_number_id?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          answered_at?: string | null
          assigned_admin_user_id?: string | null
          callback_lead_id?: string | null
          caller_city?: string | null
          caller_name?: string | null
          caller_number?: string | null
          caller_state?: string | null
          callrail_call_id?: string
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          matched_customer_id?: string | null
          matched_lead_id?: string | null
          raw?: Json | null
          recording_url?: string | null
          started_at?: string | null
          status?: string
          tracked_number?: string | null
          tracker_id?: string | null
          tracking_number_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "callrail_calls_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callrail_calls_assigned_admin_user_id_fkey"
            columns: ["assigned_admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callrail_calls_tracking_number_id_fkey"
            columns: ["tracking_number_id"]
            isOneToOne: false
            referencedRelation: "callrail_tracking_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      callrail_tracking_numbers: {
        Row: {
          active: boolean
          assigned_admin_user_id: string | null
          callrail_tracker_id: string
          created_at: string
          id: string
          label: string | null
          phone_e164: string | null
          raw: Json | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          assigned_admin_user_id?: string | null
          callrail_tracker_id: string
          created_at?: string
          id?: string
          label?: string | null
          phone_e164?: string | null
          raw?: Json | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          assigned_admin_user_id?: string | null
          callrail_tracker_id?: string
          created_at?: string
          id?: string
          label?: string | null
          phone_e164?: string | null
          raw?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "callrail_tracking_numbers_assigned_admin_user_id_fkey"
            columns: ["assigned_admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
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
      checkout_struggle_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          amount: number | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          details: Json | null
          device_type: string | null
          id: string
          payment_method: string | null
          plan_name: string | null
          resolved_at: string | null
          session_key: string
          signal_type: string
          status: string
          updated_at: string
          vehicle_reg: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          amount?: number | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          details?: Json | null
          device_type?: string | null
          id?: string
          payment_method?: string | null
          plan_name?: string | null
          resolved_at?: string | null
          session_key: string
          signal_type: string
          status?: string
          updated_at?: string
          vehicle_reg?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          amount?: number | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          details?: Json | null
          device_type?: string | null
          id?: string
          payment_method?: string | null
          plan_name?: string | null
          resolved_at?: string | null
          session_key?: string
          signal_type?: string
          status?: string
          updated_at?: string
          vehicle_reg?: string | null
        }
        Relationships: []
      }
      claim_appeals: {
        Row: {
          claim_id: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          new_evidence: string | null
          outcome: string | null
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          claim_id: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          new_evidence?: string | null
          outcome?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          claim_id?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          new_evidence?: string | null
          outcome?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_appeals_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          claim_id: string
          created_at: string
          field: string | null
          id: string
          new_value: string | null
          old_value: string | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          claim_id: string
          created_at?: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          claim_id?: string
          created_at?: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_audit_log_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_call_logs: {
        Row: {
          called_party: string
          claim_id: string
          created_at: string
          direction: string | null
          follow_up_date: string | null
          follow_up_required: boolean
          id: string
          logged_by: string | null
          logged_by_name: string | null
          outcome: string | null
          summary: string | null
        }
        Insert: {
          called_party: string
          claim_id: string
          created_at?: string
          direction?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean
          id?: string
          logged_by?: string | null
          logged_by_name?: string | null
          outcome?: string | null
          summary?: string | null
        }
        Update: {
          called_party?: string
          claim_id?: string
          created_at?: string
          direction?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean
          id?: string
          logged_by?: string | null
          logged_by_name?: string | null
          outcome?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_call_logs_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims_submissions"
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
      claim_documents: {
        Row: {
          claim_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          label: string | null
          notes: string | null
          uploaded_by: string | null
          uploaded_by_name: string | null
          uploaded_by_role: string | null
          visibility: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          label?: string | null
          notes?: string | null
          uploaded_by?: string | null
          uploaded_by_name?: string | null
          uploaded_by_role?: string | null
          visibility?: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          label?: string | null
          notes?: string | null
          uploaded_by?: string | null
          uploaded_by_name?: string | null
          uploaded_by_role?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_documents_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_email_retry_queue: {
        Row: {
          attempts: number
          created_at: string
          email_kind: string
          id: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          sent_at: string | null
          status: string
          submission_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          email_kind: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload: Json
          sent_at?: string | null
          status?: string
          submission_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          email_kind?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          submission_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_email_retry_queue_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "claims_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_notes: {
        Row: {
          claim_id: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          id: string
          note: string
          note_type: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          note: string
          note_type?: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          note?: string
          note_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_notes_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_quick_notes: {
        Row: {
          claim_id: string
          created_at: string | null
          created_by: string
          id: string
          is_pinned: boolean | null
          note_text: string
          updated_at: string | null
        }
        Insert: {
          claim_id: string
          created_at?: string | null
          created_by: string
          id?: string
          is_pinned?: boolean | null
          note_text: string
          updated_at?: string | null
        }
        Update: {
          claim_id?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_pinned?: boolean | null
          note_text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_quick_notes_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_reminders: {
        Row: {
          assigned_to: string | null
          claim_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_at: string
          id: string
          is_muted: boolean
          lead_time_minutes: number
          notes: string | null
          reminder_kind: string
          snoozed_until: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          claim_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_at: string
          id?: string
          is_muted?: boolean
          lead_time_minutes?: number
          notes?: string | null
          reminder_kind?: string
          snoozed_until?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          claim_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string
          id?: string
          is_muted?: boolean
          lead_time_minutes?: number
          notes?: string | null
          reminder_kind?: string
          snoozed_until?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_reminders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_reminders_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_settlements: {
        Row: {
          approved_amount: number | null
          claim_id: string
          created_at: string
          created_by: string | null
          excess_deducted: number | null
          final_paid_amount: number | null
          id: string
          invoice_reference: string | null
          notes: string | null
          paid_to: string | null
          payment_date: string | null
          payment_method: string | null
          updated_at: string
        }
        Insert: {
          approved_amount?: number | null
          claim_id: string
          created_at?: string
          created_by?: string | null
          excess_deducted?: number | null
          final_paid_amount?: number | null
          id?: string
          invoice_reference?: string | null
          notes?: string | null
          paid_to?: string | null
          payment_date?: string | null
          payment_method?: string | null
          updated_at?: string
        }
        Update: {
          approved_amount?: number | null
          claim_id?: string
          created_at?: string
          created_by?: string | null
          excess_deducted?: number | null
          final_paid_amount?: number | null
          id?: string
          invoice_reference?: string | null
          notes?: string | null
          paid_to?: string | null
          payment_date?: string | null
          payment_method?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_settlements_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: true
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
      claim_update_requests: {
        Row: {
          claim_id: string
          claim_reason: string | null
          created_at: string | null
          customer_name: string | null
          expires_at: string | null
          id: string
          is_responded: boolean | null
          recipient_email: string
          sent_at: string | null
          sent_by: string | null
          token: string
          vehicle_registration: string | null
        }
        Insert: {
          claim_id: string
          claim_reason?: string | null
          created_at?: string | null
          customer_name?: string | null
          expires_at?: string | null
          id?: string
          is_responded?: boolean | null
          recipient_email: string
          sent_at?: string | null
          sent_by?: string | null
          token?: string
          vehicle_registration?: string | null
        }
        Update: {
          claim_id?: string
          claim_reason?: string | null
          created_at?: string | null
          customer_name?: string | null
          expires_at?: string | null
          id?: string
          is_responded?: boolean | null
          recipient_email?: string
          sent_at?: string | null
          sent_by?: string | null
          token?: string
          vehicle_registration?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_update_requests_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_update_responses: {
        Row: {
          claim_id: string
          created_at: string | null
          estimated_completion: string | null
          file_name: string | null
          file_url: string | null
          id: string
          invoice_amount: number | null
          invoice_number: string | null
          is_read: boolean | null
          notes: string | null
          request_id: string
          respondent_email: string | null
          respondent_name: string | null
          status_update: string | null
        }
        Insert: {
          claim_id: string
          created_at?: string | null
          estimated_completion?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          invoice_amount?: number | null
          invoice_number?: string | null
          is_read?: boolean | null
          notes?: string | null
          request_id: string
          respondent_email?: string | null
          respondent_name?: string | null
          status_update?: string | null
        }
        Update: {
          claim_id?: string
          created_at?: string | null
          estimated_completion?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          invoice_amount?: number | null
          invoice_number?: string | null
          is_read?: boolean | null
          notes?: string | null
          request_id?: string
          respondent_email?: string | null
          respondent_name?: string | null
          status_update?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_update_responses_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_update_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "claim_update_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      claims_submissions: {
        Row: {
          approved_at: string | null
          assigned_to: string | null
          claim_reason: string | null
          claimed_amount: number | null
          created_at: string
          date_of_incident: string | null
          days_on_risk: number | null
          email: string
          file_name: string | null
          file_size: number | null
          file_url: string | null
          file_urls: Json
          follow_up_date: string | null
          garage_email: string | null
          garage_name: string | null
          garage_phone: string | null
          id: string
          internal_notes: string | null
          last_contacted_at: string | null
          message: string | null
          mileage_at_claim: number | null
          mileage_driven: number | null
          name: string
          paid_amount: number | null
          paid_at: string | null
          payment_amount: number | null
          phone: string | null
          policy_id: string | null
          priority: string | null
          purchase_mileage: number | null
          rejected_at: string | null
          rejection_reason: string | null
          review_sentiment: string | null
          status: string
          tag_id: string | null
          updated_at: string
          vehicle_registration: string | null
          warranty_start_date: string | null
          warranty_type: string | null
        }
        Insert: {
          approved_at?: string | null
          assigned_to?: string | null
          claim_reason?: string | null
          claimed_amount?: number | null
          created_at?: string
          date_of_incident?: string | null
          days_on_risk?: number | null
          email: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          file_urls?: Json
          follow_up_date?: string | null
          garage_email?: string | null
          garage_name?: string | null
          garage_phone?: string | null
          id?: string
          internal_notes?: string | null
          last_contacted_at?: string | null
          message?: string | null
          mileage_at_claim?: number | null
          mileage_driven?: number | null
          name: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_amount?: number | null
          phone?: string | null
          policy_id?: string | null
          priority?: string | null
          purchase_mileage?: number | null
          rejected_at?: string | null
          rejection_reason?: string | null
          review_sentiment?: string | null
          status?: string
          tag_id?: string | null
          updated_at?: string
          vehicle_registration?: string | null
          warranty_start_date?: string | null
          warranty_type?: string | null
        }
        Update: {
          approved_at?: string | null
          assigned_to?: string | null
          claim_reason?: string | null
          claimed_amount?: number | null
          created_at?: string
          date_of_incident?: string | null
          days_on_risk?: number | null
          email?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          file_urls?: Json
          follow_up_date?: string | null
          garage_email?: string | null
          garage_name?: string | null
          garage_phone?: string | null
          id?: string
          internal_notes?: string | null
          last_contacted_at?: string | null
          message?: string | null
          mileage_at_claim?: number | null
          mileage_driven?: number | null
          name?: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_amount?: number | null
          phone?: string | null
          policy_id?: string | null
          priority?: string | null
          purchase_mileage?: number | null
          rejected_at?: string | null
          rejection_reason?: string | null
          review_sentiment?: string | null
          status?: string
          tag_id?: string | null
          updated_at?: string
          vehicle_registration?: string | null
          warranty_start_date?: string | null
          warranty_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_submissions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "customer_policies"
            referencedColumns: ["id"]
          },
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
      commission_claims: {
        Row: {
          agent_id: string
          claim_notes: string | null
          claim_reason: string
          created_at: string
          customer_id: string | null
          deal_value: number | null
          evidence_type: string | null
          id: string
          lead_id: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          claim_notes?: string | null
          claim_reason: string
          created_at?: string
          customer_id?: string | null
          deal_value?: number | null
          evidence_type?: string | null
          id?: string
          lead_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          claim_notes?: string | null
          claim_reason?: string
          created_at?: string
          customer_id?: string | null
          deal_value?: number | null
          evidence_type?: string | null
          id?: string
          lead_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_claims_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_claims_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_claims_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
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
      complaints: {
        Row: {
          acknowledged_at: string | null
          assigned_to: string | null
          category: string
          closed_at: string | null
          created_at: string
          description: string
          desired_outcome: string | null
          email: string
          first_name: string
          id: string
          internal_notes: string | null
          last_name: string
          phone: string | null
          preferred_contact_method: string | null
          reference: string
          registration_plate: string | null
          resolution: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["complaint_status"]
          updated_at: string
          warranty_ref: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          assigned_to?: string | null
          category: string
          closed_at?: string | null
          created_at?: string
          description: string
          desired_outcome?: string | null
          email: string
          first_name: string
          id?: string
          internal_notes?: string | null
          last_name: string
          phone?: string | null
          preferred_contact_method?: string | null
          reference: string
          registration_plate?: string | null
          resolution?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          updated_at?: string
          warranty_ref?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          description?: string
          desired_outcome?: string | null
          email?: string
          first_name?: string
          id?: string
          internal_notes?: string | null
          last_name?: string
          phone?: string | null
          preferred_contact_method?: string | null
          reference?: string
          registration_plate?: string | null
          resolution?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          updated_at?: string
          warranty_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaints_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      concession_allowances: {
        Row: {
          admin_user_id: string
          allow_1mo: number
          allow_3mo: number
          allow_6mo: number
          created_at: string
          id: string
          updated_at: string
          year_month: string
        }
        Insert: {
          admin_user_id: string
          allow_1mo?: number
          allow_3mo?: number
          allow_6mo?: number
          created_at?: string
          id?: string
          updated_at?: string
          year_month: string
        }
        Update: {
          admin_user_id?: string
          allow_1mo?: number
          allow_3mo?: number
          allow_6mo?: number
          created_at?: string
          id?: string
          updated_at?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "concession_allowances_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      concession_auth_requests: {
        Row: {
          admin_user_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decided_by_name: string | null
          decision_note: string | null
          id: string
          reason: string
          request_type: string
          seen_by_requester: boolean
          status: string
          updated_at: string
          year_month: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decided_by_name?: string | null
          decision_note?: string | null
          id?: string
          reason: string
          request_type: string
          seen_by_requester?: boolean
          status?: string
          updated_at?: string
          year_month: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decided_by_name?: string | null
          decision_note?: string | null
          id?: string
          reason?: string
          request_type?: string
          seen_by_requester?: boolean
          status?: string
          updated_at?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "concession_auth_requests_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concession_auth_requests_decided_by_fkey"
            columns: ["decided_by"]
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
          effective_from: string | null
          effective_to: string | null
          file_size: number | null
          file_url: string
          id: string
          plan_type: string
          updated_at: string
          uploaded_by: string | null
          vehicle_type: string | null
          version: string | null
        }
        Insert: {
          created_at?: string
          document_name: string
          effective_from?: string | null
          effective_to?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          plan_type: string
          updated_at?: string
          uploaded_by?: string | null
          vehicle_type?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string
          document_name?: string
          effective_from?: string | null
          effective_to?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          plan_type?: string
          updated_at?: string
          uploaded_by?: string | null
          vehicle_type?: string | null
          version?: string | null
        }
        Relationships: []
      }
      customer_lock_events: {
        Row: {
          agent_id: string | null
          created_at: string
          customer_id: string
          from_state: string | null
          id: string
          lead_id: string | null
          phone_normalized: string | null
          reason: string | null
          source: string | null
          to_state: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          customer_id: string
          from_state?: string | null
          id?: string
          lead_id?: string | null
          phone_normalized?: string | null
          reason?: string | null
          source?: string | null
          to_state: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          customer_id?: string
          from_state?: string | null
          id?: string
          lead_id?: string | null
          phone_normalized?: string | null
          reason?: string | null
          source?: string | null
          to_state?: string
        }
        Relationships: []
      }
      customer_login_attempts: {
        Row: {
          created_at: string
          customer_id: string | null
          email: string
          event_type: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          metadata: Json
          success: boolean
          triggered_by_admin_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          email: string
          event_type: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          success?: boolean
          triggered_by_admin_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          email?: string
          event_type?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          success?: boolean
          triggered_by_admin_id?: string | null
          user_agent?: string | null
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
      customer_part_payment_plans: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          next_due_date: string | null
          notes: string | null
          reminder_dismissed_until: string | null
          reminder_enabled: boolean
          reminder_note: string | null
          status: string
          total_due: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          next_due_date?: string | null
          notes?: string | null
          reminder_dismissed_until?: string | null
          reminder_enabled?: boolean
          reminder_note?: string | null
          status?: string
          total_due?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          next_due_date?: string | null
          notes?: string | null
          reminder_dismissed_until?: string | null
          reminder_enabled?: boolean
          reminder_note?: string | null
          status?: string
          total_due?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_part_payment_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_part_payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          paid_on: string
          payment_method: string
          proof_url: string | null
          recorded_by: string | null
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          paid_on?: string
          payment_method?: string
          proof_url?: string | null
          recorded_by?: string | null
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          paid_on?: string
          payment_method?: string
          proof_url?: string | null
          recorded_by?: string | null
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_part_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_policies: {
        Row: {
          additional_notes: string | null
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
          payment_confirmed_by: string | null
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
          quote_sent_by: string | null
          retention_outcome: string | null
          retention_worked_at: string | null
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
          additional_notes?: string | null
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
          payment_confirmed_by?: string | null
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
          quote_sent_by?: string | null
          retention_outcome?: string | null
          retention_worked_at?: string | null
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
          additional_notes?: string | null
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
          payment_confirmed_by?: string | null
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
          quote_sent_by?: string | null
          retention_outcome?: string | null
          retention_worked_at?: string | null
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
          acquisition_source: string | null
          assigned_to: string | null
          balance_due_amount: number | null
          breakdown_recovery: boolean | null
          brevo_contact_id: string | null
          building_name: string | null
          building_number: string | null
          bumper_order_id: string | null
          cancellation_note: string | null
          cancellation_note_updated_at: string | null
          cancellation_note_updated_by: string | null
          claim_limit: number | null
          consequential: boolean | null
          contact_notes: string | null
          country: string | null
          county: string | null
          created_at: string
          customer_dob: string | null
          dealer_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          deposit_amount: number | null
          deposit_taken: boolean
          deposit_taken_at: string | null
          deposit_taken_by: string | null
          device_type: string | null
          discount_amount: number | null
          discount_code: string | null
          email: string
          europe_cover: boolean | null
          final_amount: number | null
          first_name: string | null
          flat_number: string | null
          ga_client_id: string | null
          gclid: string | null
          google_ads_conversion_status: string | null
          google_ads_conversion_uploaded_at: string | null
          google_review_completed: boolean | null
          google_review_completed_at: string | null
          google_review_requested: boolean | null
          google_review_requested_at: string | null
          id: string
          is_deleted: boolean | null
          is_manual_entry: boolean | null
          is_test_cancellation: boolean
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
          ni_verified: boolean
          ni_verified_at: string | null
          ni_verified_by: string | null
          original_amount: number | null
          payment_collected_at: string | null
          payment_collected_by: string | null
          payment_collection_note: string | null
          payment_confirmed_by: string | null
          payment_due_date: string | null
          payment_status: string | null
          payment_type: string | null
          payment_verified: boolean | null
          phone: string | null
          plan_type: string
          postcode: string | null
          price_comparison_proof_url: string | null
          price_match_applied: boolean
          price_match_competitor: string | null
          price_match_competitor_price: number | null
          price_match_our_price: number | null
          purchase_source: string | null
          quote_sent_by: string | null
          registration_plate: string | null
          review_email_sent_at: string | null
          sale_credit_admin_user_id: string | null
          sale_credit_overridden_at: string | null
          sale_credit_overridden_by: string | null
          sale_credit_override_reason: string | null
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
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
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
          acquisition_source?: string | null
          assigned_to?: string | null
          balance_due_amount?: number | null
          breakdown_recovery?: boolean | null
          brevo_contact_id?: string | null
          building_name?: string | null
          building_number?: string | null
          bumper_order_id?: string | null
          cancellation_note?: string | null
          cancellation_note_updated_at?: string | null
          cancellation_note_updated_by?: string | null
          claim_limit?: number | null
          consequential?: boolean | null
          contact_notes?: string | null
          country?: string | null
          county?: string | null
          created_at?: string
          customer_dob?: string | null
          dealer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deposit_amount?: number | null
          deposit_taken?: boolean
          deposit_taken_at?: string | null
          deposit_taken_by?: string | null
          device_type?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          email: string
          europe_cover?: boolean | null
          final_amount?: number | null
          first_name?: string | null
          flat_number?: string | null
          ga_client_id?: string | null
          gclid?: string | null
          google_ads_conversion_status?: string | null
          google_ads_conversion_uploaded_at?: string | null
          google_review_completed?: boolean | null
          google_review_completed_at?: string | null
          google_review_requested?: boolean | null
          google_review_requested_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_manual_entry?: boolean | null
          is_test_cancellation?: boolean
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
          ni_verified?: boolean
          ni_verified_at?: string | null
          ni_verified_by?: string | null
          original_amount?: number | null
          payment_collected_at?: string | null
          payment_collected_by?: string | null
          payment_collection_note?: string | null
          payment_confirmed_by?: string | null
          payment_due_date?: string | null
          payment_status?: string | null
          payment_type?: string | null
          payment_verified?: boolean | null
          phone?: string | null
          plan_type: string
          postcode?: string | null
          price_comparison_proof_url?: string | null
          price_match_applied?: boolean
          price_match_competitor?: string | null
          price_match_competitor_price?: number | null
          price_match_our_price?: number | null
          purchase_source?: string | null
          quote_sent_by?: string | null
          registration_plate?: string | null
          review_email_sent_at?: string | null
          sale_credit_admin_user_id?: string | null
          sale_credit_overridden_at?: string | null
          sale_credit_overridden_by?: string | null
          sale_credit_override_reason?: string | null
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
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
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
          acquisition_source?: string | null
          assigned_to?: string | null
          balance_due_amount?: number | null
          breakdown_recovery?: boolean | null
          brevo_contact_id?: string | null
          building_name?: string | null
          building_number?: string | null
          bumper_order_id?: string | null
          cancellation_note?: string | null
          cancellation_note_updated_at?: string | null
          cancellation_note_updated_by?: string | null
          claim_limit?: number | null
          consequential?: boolean | null
          contact_notes?: string | null
          country?: string | null
          county?: string | null
          created_at?: string
          customer_dob?: string | null
          dealer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deposit_amount?: number | null
          deposit_taken?: boolean
          deposit_taken_at?: string | null
          deposit_taken_by?: string | null
          device_type?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          email?: string
          europe_cover?: boolean | null
          final_amount?: number | null
          first_name?: string | null
          flat_number?: string | null
          ga_client_id?: string | null
          gclid?: string | null
          google_ads_conversion_status?: string | null
          google_ads_conversion_uploaded_at?: string | null
          google_review_completed?: boolean | null
          google_review_completed_at?: string | null
          google_review_requested?: boolean | null
          google_review_requested_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_manual_entry?: boolean | null
          is_test_cancellation?: boolean
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
          ni_verified?: boolean
          ni_verified_at?: string | null
          ni_verified_by?: string | null
          original_amount?: number | null
          payment_collected_at?: string | null
          payment_collected_by?: string | null
          payment_collection_note?: string | null
          payment_confirmed_by?: string | null
          payment_due_date?: string | null
          payment_status?: string | null
          payment_type?: string | null
          payment_verified?: boolean | null
          phone?: string | null
          plan_type?: string
          postcode?: string | null
          price_comparison_proof_url?: string | null
          price_match_applied?: boolean
          price_match_competitor?: string | null
          price_match_competitor_price?: number | null
          price_match_our_price?: number | null
          purchase_source?: string | null
          quote_sent_by?: string | null
          registration_plate?: string | null
          review_email_sent_at?: string | null
          sale_credit_admin_user_id?: string | null
          sale_credit_overridden_at?: string | null
          sale_credit_overridden_by?: string | null
          sale_credit_override_reason?: string | null
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
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
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
          {
            foreignKeyName: "customers_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_payment_confirmed_by_fkey"
            columns: ["payment_confirmed_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_quote_sent_by_fkey"
            columns: ["quote_sent_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_sale_credit_admin_user_id_fkey"
            columns: ["sale_credit_admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_lead_stats_snapshot: {
        Row: {
          counts: Json
          is_locked: boolean
          lead_count: number
          snapshot_date: string
          snapshotted_at: string
          team_scope: string
        }
        Insert: {
          counts: Json
          is_locked?: boolean
          lead_count?: number
          snapshot_date: string
          snapshotted_at?: string
          team_scope?: string
        }
        Update: {
          counts?: Json
          is_locked?: boolean
          lead_count?: number
          snapshot_date?: string
          snapshotted_at?: string
          team_scope?: string
        }
        Relationships: []
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
      dealer_admin_blog_posts: {
        Row: {
          author: string | null
          content: string
          created_at: string
          created_by: string | null
          excerpt: string | null
          featured_image: string | null
          id: string
          keywords: string[] | null
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      dealer_admin_bulk_pricing_uploads: {
        Row: {
          created_at: string
          error_count: number
          errors: Json | null
          filename: string
          id: string
          status: string
          success_count: number
          total_rows: number
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          error_count?: number
          errors?: Json | null
          filename: string
          id?: string
          status?: string
          success_count?: number
          total_rows?: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          error_count?: number
          errors?: Json | null
          filename?: string
          id?: string
          status?: string
          success_count?: number
          total_rows?: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      dealer_admin_claims: {
        Row: {
          approved_amount: number | null
          assigned_to: string | null
          attachments: Json | null
          claim_reference: string
          created_at: string
          customer_email: string | null
          customer_email_normalized: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          dealer_id: string | null
          fault_description: string | null
          id: string
          internal_notes: string | null
          is_test: boolean
          paid_amount: number | null
          registration_plate: string | null
          registration_plate_normalized: string | null
          repair_estimate: number | null
          repair_garage: string | null
          risk_level: string | null
          status: string
          updated_at: string
          vehicle_make: string | null
          vehicle_model: string | null
        }
        Insert: {
          approved_amount?: number | null
          assigned_to?: string | null
          attachments?: Json | null
          claim_reference?: string
          created_at?: string
          customer_email?: string | null
          customer_email_normalized?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          dealer_id?: string | null
          fault_description?: string | null
          id?: string
          internal_notes?: string | null
          is_test?: boolean
          paid_amount?: number | null
          registration_plate?: string | null
          registration_plate_normalized?: string | null
          repair_estimate?: number | null
          repair_garage?: string | null
          risk_level?: string | null
          status?: string
          updated_at?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
        }
        Update: {
          approved_amount?: number | null
          assigned_to?: string | null
          attachments?: Json | null
          claim_reference?: string
          created_at?: string
          customer_email?: string | null
          customer_email_normalized?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          dealer_id?: string | null
          fault_description?: string | null
          id?: string
          internal_notes?: string | null
          is_test?: boolean
          paid_amount?: number | null
          registration_plate?: string | null
          registration_plate_normalized?: string | null
          repair_estimate?: number | null
          repair_garage?: string | null
          risk_level?: string | null
          status?: string
          updated_at?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_admin_claims_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "dealer_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_admin_claims_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_admin_contact_submissions: {
        Row: {
          admin_notes: string | null
          assigned_to: string | null
          company_name: string | null
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          id: string
          message: string
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_to?: string | null
          company_name?: string | null
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          message: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          assigned_to?: string | null
          company_name?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          message?: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dealer_admin_discount_codes: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          times_used: number
          updated_at: string
          usage_limit: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          times_used?: number
          updated_at?: string
          usage_limit?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          times_used?: number
          updated_at?: string
          usage_limit?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      dealer_admin_document_mappings: {
        Row: {
          created_at: string
          document_path: string
          id: string
          notes: string | null
          plan_name: string
          updated_at: string
          vehicle_type: string
        }
        Insert: {
          created_at?: string
          document_path: string
          id?: string
          notes?: string | null
          plan_name: string
          updated_at?: string
          vehicle_type?: string
        }
        Update: {
          created_at?: string
          document_path?: string
          id?: string
          notes?: string | null
          plan_name?: string
          updated_at?: string
          vehicle_type?: string
        }
        Relationships: []
      }
      dealer_admin_email_campaigns: {
        Row: {
          audience: string
          body: string | null
          created_at: string
          id: string
          name: string
          scheduled_at: string | null
          sent_at: string | null
          sent_count: number
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          audience?: string
          body?: string | null
          created_at?: string
          id?: string
          name: string
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string | null
          created_at?: string
          id?: string
          name?: string
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      dealer_admin_landing_pages: {
        Row: {
          body_content: string
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          hero_heading: string | null
          hero_subheading: string | null
          id: string
          keywords: string[] | null
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          slug: string
          status: string
          target_location: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body_content?: string
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          hero_heading?: string | null
          hero_subheading?: string | null
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug: string
          status?: string
          target_location?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body_content?: string
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          hero_heading?: string | null
          hero_subheading?: string | null
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          target_location?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      dealer_admin_lead_backups: {
        Row: {
          backup_name: string
          backup_type: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          record_count: number
          snapshot: Json
          updated_at: string
        }
        Insert: {
          backup_name: string
          backup_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          record_count?: number
          snapshot?: Json
          updated_at?: string
        }
        Update: {
          backup_name?: string
          backup_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          record_count?: number
          snapshot?: Json
          updated_at?: string
        }
        Relationships: []
      }
      dealer_admin_marketing_contacts: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          notes: string | null
          phone: string | null
          source: string | null
          status: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      dealer_admin_orders: {
        Row: {
          amount_paid: number | null
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_email_normalized: string | null
          customer_name: string | null
          customer_phone: string | null
          dealer_id: string | null
          dealer_name: string | null
          duration_months: number | null
          id: string
          notes: string | null
          payment_method: string | null
          payment_status: string
          plan_type: string | null
          quote_id: string | null
          status: string
          updated_at: string
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_reg: string | null
          vehicle_reg_normalized: string | null
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_email_normalized?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          dealer_id?: string | null
          dealer_name?: string | null
          duration_months?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string
          plan_type?: string | null
          quote_id?: string | null
          status?: string
          updated_at?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_reg?: string | null
          vehicle_reg_normalized?: string | null
        }
        Update: {
          amount_paid?: number | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_email_normalized?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          dealer_id?: string | null
          dealer_name?: string | null
          duration_months?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string
          plan_type?: string | null
          quote_id?: string | null
          status?: string
          updated_at?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_reg?: string | null
          vehicle_reg_normalized?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_admin_orders_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_admin_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "dealer_admin_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_admin_page_views: {
        Row: {
          id: string
          path: string
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          path: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          id?: string
          path?: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: []
      }
      dealer_admin_pending_registrations: {
        Row: {
          company_name: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          notes: string | null
          phone: string | null
          registration_type: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          registration_type?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          registration_type?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dealer_admin_plans: {
        Row: {
          coverage_details: Json | null
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean
          monthly_price: number | null
          name: string
          plan_type: string
          pricing_matrix: Json | null
          three_yearly_price: number | null
          updated_at: string
          vehicle_type: string | null
          yearly_price: number | null
        }
        Insert: {
          coverage_details?: Json | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          monthly_price?: number | null
          name: string
          plan_type?: string
          pricing_matrix?: Json | null
          three_yearly_price?: number | null
          updated_at?: string
          vehicle_type?: string | null
          yearly_price?: number | null
        }
        Update: {
          coverage_details?: Json | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          monthly_price?: number | null
          name?: string
          plan_type?: string
          pricing_matrix?: Json | null
          three_yearly_price?: number | null
          updated_at?: string
          vehicle_type?: string | null
          yearly_price?: number | null
        }
        Relationships: []
      }
      dealer_admin_policy_letters: {
        Row: {
          body: string
          created_at: string
          id: string
          is_active: boolean
          letter_name: string
          letter_type: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean
          letter_name: string
          letter_type?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean
          letter_name?: string
          letter_type?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dealer_admin_posted_letters_log: {
        Row: {
          created_at: string
          customer_address: string | null
          customer_name: string
          id: string
          letter_id: string | null
          letter_type: string
          notes: string | null
          posted_at: string
          posted_by: string | null
          status: string
          tracking_ref: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_address?: string | null
          customer_name: string
          id?: string
          letter_id?: string | null
          letter_type?: string
          notes?: string | null
          posted_at?: string
          posted_by?: string | null
          status?: string
          tracking_ref?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_address?: string | null
          customer_name?: string
          id?: string
          letter_id?: string | null
          letter_type?: string
          notes?: string | null
          posted_at?: string
          posted_by?: string | null
          status?: string
          tracking_ref?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dealer_admin_quotes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_email_normalized: string | null
          customer_name: string | null
          customer_phone: string | null
          dealer_id: string | null
          dealer_name: string | null
          dealer_price: number | null
          discount_pct: number | null
          duration_months: number | null
          expires_at: string | null
          id: string
          notes: string | null
          plan_type: string | null
          retail_price: number | null
          status: string
          updated_at: string
          vehicle_make: string | null
          vehicle_mileage: number | null
          vehicle_model: string | null
          vehicle_reg: string | null
          vehicle_reg_normalized: string | null
          vehicle_year: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_email_normalized?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          dealer_id?: string | null
          dealer_name?: string | null
          dealer_price?: number | null
          discount_pct?: number | null
          duration_months?: number | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          plan_type?: string | null
          retail_price?: number | null
          status?: string
          updated_at?: string
          vehicle_make?: string | null
          vehicle_mileage?: number | null
          vehicle_model?: string | null
          vehicle_reg?: string | null
          vehicle_reg_normalized?: string | null
          vehicle_year?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_email_normalized?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          dealer_id?: string | null
          dealer_name?: string | null
          dealer_price?: number | null
          discount_pct?: number | null
          duration_months?: number | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          plan_type?: string | null
          retail_price?: number | null
          status?: string
          updated_at?: string
          vehicle_make?: string | null
          vehicle_mileage?: number | null
          vehicle_model?: string | null
          vehicle_reg?: string | null
          vehicle_reg_normalized?: string | null
          vehicle_year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_admin_quotes_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_admin_reviews: {
        Row: {
          admin_response: string | null
          body: string | null
          created_at: string
          dealer_id: string | null
          id: string
          rating: number
          reviewer_email: string | null
          reviewer_name: string
          source: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          admin_response?: string | null
          body?: string | null
          created_at?: string
          dealer_id?: string | null
          id?: string
          rating: number
          reviewer_email?: string | null
          reviewer_name: string
          source?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          admin_response?: string | null
          body?: string | null
          created_at?: string
          dealer_id?: string | null
          id?: string
          rating?: number
          reviewer_email?: string | null
          reviewer_name?: string
          source?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dealer_admin_test_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          id: string
          payload: Json | null
          result: Json | null
          run_by: string | null
          status: string
          test_name: string
          test_type: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          payload?: Json | null
          result?: Json | null
          run_by?: string | null
          status?: string
          test_name: string
          test_type?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          payload?: Json | null
          result?: Json | null
          run_by?: string | null
          status?: string
          test_name?: string
          test_type?: string
        }
        Relationships: []
      }
      dealer_admin_timesheet_entries: {
        Row: {
          commission_amount: number
          created_at: string
          deals_closed: number
          hours_worked: number
          id: string
          notes: string | null
          updated_at: string
          user_email: string | null
          user_id: string
          work_date: string
        }
        Insert: {
          commission_amount?: number
          created_at?: string
          deals_closed?: number
          hours_worked?: number
          id?: string
          notes?: string | null
          updated_at?: string
          user_email?: string | null
          user_id: string
          work_date: string
        }
        Update: {
          commission_amount?: number
          created_at?: string
          deals_closed?: number
          hours_worked?: number
          id?: string
          notes?: string | null
          updated_at?: string
          user_email?: string | null
          user_id?: string
          work_date?: string
        }
        Relationships: []
      }
      dealer_admin_user_permissions: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          invited_by: string | null
          last_login_at: string | null
          permissions: Json
          role: string
          status: string
          updated_at: string
          user_email: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          last_login_at?: string | null
          permissions?: Json
          role?: string
          status?: string
          updated_at?: string
          user_email: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          last_login_at?: string | null
          permissions?: Json
          role?: string
          status?: string
          updated_at?: string
          user_email?: string
        }
        Relationships: []
      }
      dealer_api_keys: {
        Row: {
          created_at: string
          dealer_id: string
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          mode: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          created_at?: string
          dealer_id: string
          id?: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at?: string | null
          mode?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          created_at?: string
          dealer_id?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          mode?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "dealer_api_keys_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_customers: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          archived_at: string | null
          assigned_to: string | null
          city: string | null
          country: string | null
          county: string | null
          created_at: string
          dealer_id: string | null
          email: string | null
          email_normalized: string | null
          first_name: string | null
          id: string
          last_name: string | null
          mobile: string | null
          notes: string | null
          phone: string | null
          plan_type: string | null
          postcode: string | null
          registration_plate: string | null
          registration_plate_normalized: string | null
          signup_date: string | null
          status: string
          updated_at: string
          vehicle_fuel_type: string | null
          vehicle_make: string | null
          vehicle_mileage: number | null
          vehicle_model: string | null
          vehicle_year: number | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          city?: string | null
          country?: string | null
          county?: string | null
          created_at?: string
          dealer_id?: string | null
          email?: string | null
          email_normalized?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          plan_type?: string | null
          postcode?: string | null
          registration_plate?: string | null
          registration_plate_normalized?: string | null
          signup_date?: string | null
          status?: string
          updated_at?: string
          vehicle_fuel_type?: string | null
          vehicle_make?: string | null
          vehicle_mileage?: number | null
          vehicle_model?: string | null
          vehicle_year?: number | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          city?: string | null
          country?: string | null
          county?: string | null
          created_at?: string
          dealer_id?: string | null
          email?: string | null
          email_normalized?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          plan_type?: string | null
          postcode?: string | null
          registration_plate?: string | null
          registration_plate_normalized?: string | null
          signup_date?: string | null
          status?: string
          updated_at?: string
          vehicle_fuel_type?: string | null
          vehicle_make?: string | null
          vehicle_mileage?: number | null
          vehicle_model?: string | null
          vehicle_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_customers_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_leads: {
        Row: {
          archived_at: string | null
          assigned_to: string | null
          callback_at: string | null
          created_at: string
          dealer_id: string | null
          email: string | null
          email_normalized: string | null
          first_name: string | null
          id: string
          last_contacted_at: string | null
          last_name: string | null
          mobile: string | null
          notes: string | null
          phone: string | null
          plan_interest: string | null
          registration_plate: string | null
          registration_plate_normalized: string | null
          source: string | null
          status: string
          updated_at: string
          vehicle_make: string | null
          vehicle_mileage: number | null
          vehicle_model: string | null
          vehicle_year: number | null
        }
        Insert: {
          archived_at?: string | null
          assigned_to?: string | null
          callback_at?: string | null
          created_at?: string
          dealer_id?: string | null
          email?: string | null
          email_normalized?: string | null
          first_name?: string | null
          id?: string
          last_contacted_at?: string | null
          last_name?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          plan_interest?: string | null
          registration_plate?: string | null
          registration_plate_normalized?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          vehicle_make?: string | null
          vehicle_mileage?: number | null
          vehicle_model?: string | null
          vehicle_year?: number | null
        }
        Update: {
          archived_at?: string | null
          assigned_to?: string | null
          callback_at?: string | null
          created_at?: string
          dealer_id?: string | null
          email?: string | null
          email_normalized?: string | null
          first_name?: string | null
          id?: string
          last_contacted_at?: string | null
          last_name?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          plan_interest?: string | null
          registration_plate?: string | null
          registration_plate_normalized?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          vehicle_make?: string | null
          vehicle_mileage?: number | null
          vehicle_model?: string | null
          vehicle_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_leads_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_quotes: {
        Row: {
          created_at: string
          current_step: number
          customer_address: Json | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          dealer_id: string
          dealer_price: number | null
          discount_pct: number | null
          id: string
          is_test: boolean
          mileage: string | null
          paid_at: string | null
          payment_method: string | null
          plan_type: string | null
          price: number | null
          retail_price: number | null
          status: string
          stripe_session_id: string | null
          updated_at: string
          vehicle_fuel_type: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_reg: string
          vehicle_transmission: string | null
          vehicle_year: string | null
          warranty_duration: string | null
        }
        Insert: {
          created_at?: string
          current_step?: number
          customer_address?: Json | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          dealer_id: string
          dealer_price?: number | null
          discount_pct?: number | null
          id?: string
          is_test?: boolean
          mileage?: string | null
          paid_at?: string | null
          payment_method?: string | null
          plan_type?: string | null
          price?: number | null
          retail_price?: number | null
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          vehicle_fuel_type?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_reg: string
          vehicle_transmission?: string | null
          vehicle_year?: string | null
          warranty_duration?: string | null
        }
        Update: {
          created_at?: string
          current_step?: number
          customer_address?: Json | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          dealer_id?: string
          dealer_price?: number | null
          discount_pct?: number | null
          id?: string
          is_test?: boolean
          mileage?: string | null
          paid_at?: string | null
          payment_method?: string | null
          plan_type?: string | null
          price?: number | null
          retail_price?: number | null
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          vehicle_fuel_type?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_reg?: string
          vehicle_transmission?: string | null
          vehicle_year?: string | null
          warranty_duration?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_quotes_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_warranties: {
        Row: {
          created_at: string
          customer_name: string
          dealer_id: string
          end_date: string
          id: string
          is_test: boolean
          quote_id: string | null
          start_date: string
          status: string
          updated_at: string
          vehicle_reg: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          dealer_id: string
          end_date: string
          id?: string
          is_test?: boolean
          quote_id?: string | null
          start_date: string
          status?: string
          updated_at?: string
          vehicle_reg: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          dealer_id?: string
          end_date?: string
          id?: string
          is_test?: boolean
          quote_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          vehicle_reg?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealer_warranties_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_warranties_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "dealer_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      dealers: {
        Row: {
          commission_tier: string | null
          company_name: string
          created_at: string
          discount_pct: number
          email: string
          fca_number: string | null
          finance_limit: number | null
          id: string
          name: string
          phone: string | null
          status: string | null
          trading_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          commission_tier?: string | null
          company_name: string
          created_at?: string
          discount_pct?: number
          email: string
          fca_number?: string | null
          finance_limit?: number | null
          id?: string
          name: string
          phone?: string | null
          status?: string | null
          trading_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          commission_tier?: string | null
          company_name?: string
          created_at?: string
          discount_pct?: number
          email?: string
          fca_number?: string | null
          finance_limit?: number | null
          id?: string
          name?: string
          phone?: string | null
          status?: string | null
          trading_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      discount_auth_requests: {
        Row: {
          base_price: number | null
          created_at: string
          customer_name: string | null
          decided_at: string | null
          decided_by_name: string | null
          decided_by_user_id: string | null
          decision_note: string | null
          discount_pct: number | null
          id: string
          mileage: string | null
          payment_type: string | null
          reason: string
          registration_plate: string | null
          request_type: string
          requested_by_name: string | null
          requested_by_user_id: string
          requested_price: number | null
          seen_by_requester: boolean
          status: string
          updated_at: string
          vehicle_description: string | null
        }
        Insert: {
          base_price?: number | null
          created_at?: string
          customer_name?: string | null
          decided_at?: string | null
          decided_by_name?: string | null
          decided_by_user_id?: string | null
          decision_note?: string | null
          discount_pct?: number | null
          id?: string
          mileage?: string | null
          payment_type?: string | null
          reason: string
          registration_plate?: string | null
          request_type?: string
          requested_by_name?: string | null
          requested_by_user_id?: string
          requested_price?: number | null
          seen_by_requester?: boolean
          status?: string
          updated_at?: string
          vehicle_description?: string | null
        }
        Update: {
          base_price?: number | null
          created_at?: string
          customer_name?: string | null
          decided_at?: string | null
          decided_by_name?: string | null
          decided_by_user_id?: string | null
          decision_note?: string | null
          discount_pct?: number | null
          id?: string
          mileage?: string | null
          payment_type?: string | null
          reason?: string
          registration_plate?: string | null
          request_type?: string
          requested_by_name?: string | null
          requested_by_user_id?: string
          requested_price?: number | null
          seen_by_requester?: boolean
          status?: string
          updated_at?: string
          vehicle_description?: string | null
        }
        Relationships: []
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
          vehicle_reg: string | null
        }
        Insert: {
          customer_email: string
          discount_amount: number
          discount_code_id: string
          id?: string
          order_amount: number
          stripe_session_id?: string | null
          used_at?: string
          vehicle_reg?: string | null
        }
        Update: {
          customer_email?: string
          discount_amount?: number
          discount_code_id?: string
          id?: string
          order_amount?: number
          stripe_session_id?: string | null
          used_at?: string
          vehicle_reg?: string | null
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
          is_public: boolean
          is_referral_code: boolean | null
          min_order_amount: number
          public_description: string | null
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
          is_public?: boolean
          is_referral_code?: boolean | null
          min_order_amount?: number
          public_description?: string | null
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
          is_public?: boolean
          is_referral_code?: boolean | null
          min_order_amount?: number
          public_description?: string | null
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
          is_essential: boolean
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
          is_essential?: boolean
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
          is_essential?: boolean
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
      email_unsubscribes: {
        Row: {
          created_at: string
          customer_name: string | null
          email: string
          frequency: string
          id: string
          reason: string | null
          source: string | null
          unsubscribed_by: string | null
          unsubscribed_by_name: string | null
          vehicle_reg: string | null
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          email: string
          frequency?: string
          id?: string
          reason?: string | null
          source?: string | null
          unsubscribed_by?: string | null
          unsubscribed_by_name?: string | null
          vehicle_reg?: string | null
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          email?: string
          frequency?: string
          id?: string
          reason?: string | null
          source?: string | null
          unsubscribed_by?: string | null
          unsubscribed_by_name?: string | null
          vehicle_reg?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          category: string
          description: string | null
          enabled: boolean
          key: string
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          description?: string | null
          enabled?: boolean
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          description?: string | null
          enabled?: boolean
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      finance_application_docs: {
        Row: {
          application_id: string
          created_at: string
          doc_type: string
          file_path: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          application_id: string
          created_at?: string
          doc_type: string
          file_path: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          doc_type?: string
          file_path?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_application_docs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "finance_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_application_events: {
        Row: {
          actor: string | null
          application_id: string
          created_at: string
          event_type: string
          from_status:
            | Database["public"]["Enums"]["finance_application_status"]
            | null
          id: string
          payload: Json | null
          to_status:
            | Database["public"]["Enums"]["finance_application_status"]
            | null
        }
        Insert: {
          actor?: string | null
          application_id: string
          created_at?: string
          event_type: string
          from_status?:
            | Database["public"]["Enums"]["finance_application_status"]
            | null
          id?: string
          payload?: Json | null
          to_status?:
            | Database["public"]["Enums"]["finance_application_status"]
            | null
        }
        Update: {
          actor?: string | null
          application_id?: string
          created_at?: string
          event_type?: string
          from_status?:
            | Database["public"]["Enums"]["finance_application_status"]
            | null
          id?: string
          payload?: Json | null
          to_status?:
            | Database["public"]["Enums"]["finance_application_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "finance_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_application_finance: {
        Row: {
          application_id: string
          apr: number | null
          balloon: number | null
          cash_price: number | null
          commission: number | null
          data: Json | null
          deposit: number | null
          lender_id: string | null
          monthly: number | null
          product: string | null
          term_months: number | null
        }
        Insert: {
          application_id: string
          apr?: number | null
          balloon?: number | null
          cash_price?: number | null
          commission?: number | null
          data?: Json | null
          deposit?: number | null
          lender_id?: string | null
          monthly?: number | null
          product?: string | null
          term_months?: number | null
        }
        Update: {
          application_id?: string
          apr?: number | null
          balloon?: number | null
          cash_price?: number | null
          commission?: number | null
          data?: Json | null
          deposit?: number | null
          lender_id?: string | null
          monthly?: number | null
          product?: string | null
          term_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_application_finance_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "finance_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_application_messages: {
        Row: {
          application_id: string
          author: string | null
          author_role: string
          body: string
          created_at: string
          id: string
        }
        Insert: {
          application_id: string
          author?: string | null
          author_role: string
          body: string
          created_at?: string
          id?: string
        }
        Update: {
          application_id?: string
          author?: string | null
          author_role?: string
          body?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_application_messages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "finance_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_application_vehicle: {
        Row: {
          application_id: string
          condition: string | null
          data: Json | null
          derivative: string | null
          hpi_clear: boolean | null
          make: string | null
          mileage: number | null
          model: string | null
          valuation: number | null
          vrm: string | null
          year: number | null
        }
        Insert: {
          application_id: string
          condition?: string | null
          data?: Json | null
          derivative?: string | null
          hpi_clear?: boolean | null
          make?: string | null
          mileage?: number | null
          model?: string | null
          valuation?: number | null
          vrm?: string | null
          year?: number | null
        }
        Update: {
          application_id?: string
          condition?: string | null
          data?: Json | null
          derivative?: string | null
          hpi_clear?: boolean | null
          make?: string | null
          mileage?: number | null
          model?: string | null
          valuation?: number | null
          vrm?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_application_vehicle_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "finance_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_applications: {
        Row: {
          assigned_underwriter: string | null
          created_at: string
          customer: Json
          dealer_id: string
          decided_at: string | null
          decision: Json | null
          id: string
          notes: string | null
          reference: string
          status: Database["public"]["Enums"]["finance_application_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          assigned_underwriter?: string | null
          created_at?: string
          customer?: Json
          dealer_id: string
          decided_at?: string | null
          decision?: Json | null
          id?: string
          notes?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["finance_application_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          assigned_underwriter?: string | null
          created_at?: string
          customer?: Json
          dealer_id?: string
          decided_at?: string | null
          decision?: Json | null
          id?: string
          notes?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["finance_application_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_applications_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_lenders: {
        Row: {
          active: boolean
          contact: Json | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          contact?: Json | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          contact?: Json | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      finance_products: {
        Row: {
          active: boolean
          commission_split: Json | null
          created_at: string
          id: string
          lender_id: string
          name: string
          product_type: string
          rate_card: Json
        }
        Insert: {
          active?: boolean
          commission_split?: Json | null
          created_at?: string
          id?: string
          lender_id: string
          name: string
          product_type: string
          rate_card?: Json
        }
        Update: {
          active?: boolean
          commission_split?: Json | null
          created_at?: string
          id?: string
          lender_id?: string
          name?: string
          product_type?: string
          rate_card?: Json
        }
        Relationships: [
          {
            foreignKeyName: "finance_products_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "finance_lenders"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_push_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          next_attempt_at: string
          payload: Json
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload: Json
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ghl_sync_log: {
        Row: {
          contact_id: string | null
          created_at: string
          email: string | null
          error: string | null
          http_status: number | null
          id: string
          payload: Json | null
          response: string | null
          status: string
          sync_type: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          email?: string | null
          error?: string | null
          http_status?: number | null
          id?: string
          payload?: Json | null
          response?: string | null
          status: string
          sync_type?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          email?: string | null
          error?: string | null
          http_status?: number | null
          id?: string
          payload?: Json | null
          response?: string | null
          status?: string
          sync_type?: string
        }
        Relationships: []
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
      lead_access_requests: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          lead_id: string
          reason: string | null
          requested_by: string
          reviewed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          lead_id: string
          reason?: string | null
          requested_by: string
          reviewed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          reason?: string | null
          requested_by?: string
          reviewed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_access_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_access_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sales_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_access_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
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
      lead_assignment_audit: {
        Row: {
          agent_assigned_today_at_time: number | null
          agent_cap_at_time: number | null
          agent_presence_status: string | null
          assigned_by: string | null
          assigned_to_id: string | null
          assignment_type: string
          changed_by_user_id: string | null
          created_at: string | null
          eligible_agents_count: number | null
          id: string
          lead_id: string
          previous_assigned_to_id: string | null
          reason: string | null
          was_worked: boolean | null
        }
        Insert: {
          agent_assigned_today_at_time?: number | null
          agent_cap_at_time?: number | null
          agent_presence_status?: string | null
          assigned_by?: string | null
          assigned_to_id?: string | null
          assignment_type: string
          changed_by_user_id?: string | null
          created_at?: string | null
          eligible_agents_count?: number | null
          id?: string
          lead_id: string
          previous_assigned_to_id?: string | null
          reason?: string | null
          was_worked?: boolean | null
        }
        Update: {
          agent_assigned_today_at_time?: number | null
          agent_cap_at_time?: number | null
          agent_presence_status?: string | null
          assigned_by?: string | null
          assigned_to_id?: string | null
          assignment_type?: string
          changed_by_user_id?: string | null
          created_at?: string | null
          eligible_agents_count?: number | null
          id?: string
          lead_id?: string
          previous_assigned_to_id?: string | null
          reason?: string | null
          was_worked?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignment_audit_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_call_logs: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          attempt_number: number
          call_ended_at: string | null
          call_started_at: string | null
          contact_made: boolean | null
          created_at: string
          id: string
          lead_id: string
          lead_type: string
          lock_state_at_end: string | null
          lock_state_at_start: string | null
          marked_dormant: boolean | null
          new_owner_id: string | null
          new_queue: string | null
          next_eligible_at: string | null
          next_follow_up_date: string | null
          notes: string | null
          outcome: string
          phone_normalized: string | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          agent_name?: string | null
          attempt_number: number
          call_ended_at?: string | null
          call_started_at?: string | null
          contact_made?: boolean | null
          created_at?: string
          id?: string
          lead_id: string
          lead_type?: string
          lock_state_at_end?: string | null
          lock_state_at_start?: string | null
          marked_dormant?: boolean | null
          new_owner_id?: string | null
          new_queue?: string | null
          next_eligible_at?: string | null
          next_follow_up_date?: string | null
          notes?: string | null
          outcome: string
          phone_normalized?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          agent_name?: string | null
          attempt_number?: number
          call_ended_at?: string | null
          call_started_at?: string | null
          contact_made?: boolean | null
          created_at?: string
          id?: string
          lead_id?: string
          lead_type?: string
          lock_state_at_end?: string | null
          lock_state_at_start?: string | null
          marked_dormant?: boolean | null
          new_owner_id?: string | null
          new_queue?: string | null
          next_eligible_at?: string | null
          next_follow_up_date?: string | null
          notes?: string | null
          outcome?: string
          phone_normalized?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_call_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_customers: {
        Row: {
          attempt_count: number
          callback_at: string | null
          contacted_at: string | null
          contacted_owner: string | null
          created_at: string
          do_not_call: boolean
          do_not_call_at: string | null
          do_not_call_reason: string | null
          dormant: boolean
          dormant_at: string | null
          id: string
          last_attempt_at: string | null
          last_call_end: string | null
          last_call_outcome: string | null
          last_call_start: string | null
          lock_agent_id: string | null
          lock_lead_id: string | null
          lock_owner: string | null
          lock_source: string | null
          lock_state: string
          lock_state_at: string
          lock_until: string | null
          next_eligible_at: string | null
          phone_normalized: string
          phone_original: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          callback_at?: string | null
          contacted_at?: string | null
          contacted_owner?: string | null
          created_at?: string
          do_not_call?: boolean
          do_not_call_at?: string | null
          do_not_call_reason?: string | null
          dormant?: boolean
          dormant_at?: string | null
          id?: string
          last_attempt_at?: string | null
          last_call_end?: string | null
          last_call_outcome?: string | null
          last_call_start?: string | null
          lock_agent_id?: string | null
          lock_lead_id?: string | null
          lock_owner?: string | null
          lock_source?: string | null
          lock_state?: string
          lock_state_at?: string
          lock_until?: string | null
          next_eligible_at?: string | null
          phone_normalized: string
          phone_original?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          callback_at?: string | null
          contacted_at?: string | null
          contacted_owner?: string | null
          created_at?: string
          do_not_call?: boolean
          do_not_call_at?: string | null
          do_not_call_reason?: string | null
          dormant?: boolean
          dormant_at?: string | null
          id?: string
          last_attempt_at?: string | null
          last_call_end?: string | null
          last_call_outcome?: string | null
          last_call_start?: string | null
          lock_agent_id?: string | null
          lock_lead_id?: string | null
          lock_owner?: string | null
          lock_source?: string | null
          lock_state?: string
          lock_state_at?: string
          lock_until?: string | null
          next_eligible_at?: string | null
          phone_normalized?: string
          phone_original?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lead_distribution_settings: {
        Row: {
          active_only_distribution: boolean | null
          alternating_counter_date: string | null
          alternating_next: string
          created_at: string | null
          distribution_mode: string
          drip_enabled: boolean
          drip_interval_seconds: number
          flow_mode: string
          id: string
          open_round_robin_enabled: boolean
          overflow_recipient_id: string | null
          solo_agent_id: string | null
          solo_mode_enabled: boolean | null
          strict_rotation_cursor: number
          strict_rotation_enabled: boolean
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          active_only_distribution?: boolean | null
          alternating_counter_date?: string | null
          alternating_next?: string
          created_at?: string | null
          distribution_mode?: string
          drip_enabled?: boolean
          drip_interval_seconds?: number
          flow_mode?: string
          id?: string
          open_round_robin_enabled?: boolean
          overflow_recipient_id?: string | null
          solo_agent_id?: string | null
          solo_mode_enabled?: boolean | null
          strict_rotation_cursor?: number
          strict_rotation_enabled?: boolean
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active_only_distribution?: boolean | null
          alternating_counter_date?: string | null
          alternating_next?: string
          created_at?: string | null
          distribution_mode?: string
          drip_enabled?: boolean
          drip_interval_seconds?: number
          flow_mode?: string
          id?: string
          open_round_robin_enabled?: boolean
          overflow_recipient_id?: string | null
          solo_agent_id?: string | null
          solo_mode_enabled?: boolean | null
          strict_rotation_cursor?: number
          strict_rotation_enabled?: boolean
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_distribution_settings_overflow_recipient_id_fkey"
            columns: ["overflow_recipient_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distribution_settings_solo_agent_id_fkey"
            columns: ["solo_agent_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distribution_settings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "lead_teams"
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
      lead_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
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
      lead_team_members: {
        Row: {
          admin_user_id: string
          call_data_scope: string
          can_see_team_leads: boolean
          created_at: string
          id: string
          notice_seen_at: string | null
          previous_team_id: string | null
          role_in_team: string
          team_changed_at: string | null
          team_id: string
          workstream_new_leads: boolean
          workstream_recontact: boolean
          workstream_renewals: boolean
        }
        Insert: {
          admin_user_id: string
          call_data_scope?: string
          can_see_team_leads?: boolean
          created_at?: string
          id?: string
          notice_seen_at?: string | null
          previous_team_id?: string | null
          role_in_team?: string
          team_changed_at?: string | null
          team_id: string
          workstream_new_leads?: boolean
          workstream_recontact?: boolean
          workstream_renewals?: boolean
        }
        Update: {
          admin_user_id?: string
          call_data_scope?: string
          can_see_team_leads?: boolean
          created_at?: string
          id?: string
          notice_seen_at?: string | null
          previous_team_id?: string | null
          role_in_team?: string
          team_changed_at?: string | null
          team_id?: string
          workstream_new_leads?: boolean
          workstream_recontact?: boolean
          workstream_renewals?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "lead_team_members_previous_team_id_fkey"
            columns: ["previous_team_id"]
            isOneToOne: false
            referencedRelation: "lead_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "lead_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_team_source_rules: {
        Row: {
          allowed: boolean
          conversion_threshold_pct: number | null
          created_at: string
          daily_cap: number | null
          id: string
          notes: string | null
          overflow_team_id: string | null
          percentage: number
          priority: number
          source: string
          team_id: string
          updated_at: string
        }
        Insert: {
          allowed?: boolean
          conversion_threshold_pct?: number | null
          created_at?: string
          daily_cap?: number | null
          id?: string
          notes?: string | null
          overflow_team_id?: string | null
          percentage?: number
          priority?: number
          source: string
          team_id: string
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          conversion_threshold_pct?: number | null
          created_at?: string
          daily_cap?: number | null
          id?: string
          notes?: string | null
          overflow_team_id?: string | null
          percentage?: number
          priority?: number
          source?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_team_source_rules_overflow_team_id_fkey"
            columns: ["overflow_team_id"]
            isOneToOne: false
            referencedRelation: "lead_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_team_source_rules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "lead_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_teams: {
        Row: {
          callrail_banner_enabled: boolean
          color: string
          created_at: string
          created_by: string | null
          emoji: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          callrail_banner_enabled?: boolean
          color?: string
          created_at?: string
          created_by?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          callrail_banner_enabled?: boolean
          color?: string
          created_at?: string
          created_by?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
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
          customer_dob: string | null
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
          warranty_start_date: string | null
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
          customer_dob?: string | null
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
          warranty_start_date?: string | null
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
          customer_dob?: string | null
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
          warranty_start_date?: string | null
        }
        Relationships: []
      }
      marketing_audience: {
        Row: {
          contact_count: number | null
          created_at: string
          email: string | null
          frequency: string
          full_name: string | null
          id: string
          is_subscribed: boolean | null
          last_contacted_at: string | null
          lead_id: string | null
          lead_status: string | null
          metadata: Json | null
          mileage: string | null
          phone: string | null
          reg_plate: string | null
          source: string | null
          source_type: string | null
          step_abandoned: number | null
          synced_at: string
          tags: string[] | null
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          contact_count?: number | null
          created_at?: string
          email?: string | null
          frequency?: string
          full_name?: string | null
          id?: string
          is_subscribed?: boolean | null
          last_contacted_at?: string | null
          lead_id?: string | null
          lead_status?: string | null
          metadata?: Json | null
          mileage?: string | null
          phone?: string | null
          reg_plate?: string | null
          source?: string | null
          source_type?: string | null
          step_abandoned?: number | null
          synced_at?: string
          tags?: string[] | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          contact_count?: number | null
          created_at?: string
          email?: string | null
          frequency?: string
          full_name?: string | null
          id?: string
          is_subscribed?: boolean | null
          last_contacted_at?: string | null
          lead_id?: string | null
          lead_status?: string | null
          metadata?: Json | null
          mileage?: string | null
          phone?: string | null
          reg_plate?: string | null
          source?: string | null
          source_type?: string | null
          step_abandoned?: number | null
          synced_at?: string
          tags?: string[] | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      marketing_audience_sync_log: {
        Row: {
          completed_at: string | null
          errors: Json | null
          id: string
          leads_added: number | null
          leads_processed: number | null
          leads_updated: number | null
          started_at: string
          status: string | null
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          errors?: Json | null
          id?: string
          leads_added?: number | null
          leads_processed?: number | null
          leads_updated?: number | null
          started_at?: string
          status?: string | null
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          errors?: Json | null
          id?: string
          leads_added?: number | null
          leads_processed?: number | null
          leads_updated?: number | null
          started_at?: string
          status?: string | null
          sync_type?: string
        }
        Relationships: []
      }
      marketing_spend: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          month_start: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month_start: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month_start?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      missed_calls: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          call_duration: number | null
          call_started_at: string | null
          call_status: string | null
          caller_name: string | null
          caller_phone: string | null
          created_at: string
          declined_by: string[]
          id: string
          matched_customer_id: string | null
          matched_lead_id: string | null
          offer_expires_at: string | null
          offered_at: string | null
          offered_to: string | null
          provider: string
          raw_payload: Json | null
          recording_url: string | null
          resolved_at: string | null
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          call_duration?: number | null
          call_started_at?: string | null
          call_status?: string | null
          caller_name?: string | null
          caller_phone?: string | null
          created_at?: string
          declined_by?: string[]
          id?: string
          matched_customer_id?: string | null
          matched_lead_id?: string | null
          offer_expires_at?: string | null
          offered_at?: string | null
          offered_to?: string | null
          provider?: string
          raw_payload?: Json | null
          recording_url?: string | null
          resolved_at?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          call_duration?: number | null
          call_started_at?: string | null
          call_status?: string | null
          caller_name?: string | null
          caller_phone?: string | null
          created_at?: string
          declined_by?: string[]
          id?: string
          matched_customer_id?: string | null
          matched_lead_id?: string | null
          offer_expires_at?: string | null
          offered_at?: string | null
          offered_to?: string | null
          provider?: string
          raw_payload?: Json | null
          recording_url?: string | null
          resolved_at?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
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
      offline_campaigns: {
        Row: {
          campaign_type: string
          created_at: string
          end_date: string | null
          id: string
          install_date: string
          is_active: boolean
          location: string | null
          monthly_cost: number | null
          name: string
          notes: string | null
          postcode_prefixes: string[]
          updated_at: string
        }
        Insert: {
          campaign_type?: string
          created_at?: string
          end_date?: string | null
          id?: string
          install_date: string
          is_active?: boolean
          location?: string | null
          monthly_cost?: number | null
          name: string
          notes?: string | null
          postcode_prefixes?: string[]
          updated_at?: string
        }
        Update: {
          campaign_type?: string
          created_at?: string
          end_date?: string | null
          id?: string
          install_date?: string
          is_active?: boolean
          location?: string | null
          monthly_cost?: number | null
          name?: string
          notes?: string | null
          postcode_prefixes?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      open_pool_restrictions: {
        Row: {
          active_hours_remaining: number | null
          agent_id: string
          agent_name: string | null
          created_at: string
          duration_active_hours: number | null
          duration_working_days: number | null
          ends_at: string | null
          id: string
          level: number
          mismatch_event_id: string | null
          reason: string | null
          starts_at: string
          status: string
          updated_at: string
          verification_id: string | null
        }
        Insert: {
          active_hours_remaining?: number | null
          agent_id: string
          agent_name?: string | null
          created_at?: string
          duration_active_hours?: number | null
          duration_working_days?: number | null
          ends_at?: string | null
          id?: string
          level: number
          mismatch_event_id?: string | null
          reason?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          verification_id?: string | null
        }
        Update: {
          active_hours_remaining?: number | null
          agent_id?: string
          agent_name?: string | null
          created_at?: string
          duration_active_hours?: number | null
          duration_working_days?: number | null
          ends_at?: string | null
          id?: string
          level?: number
          mismatch_event_id?: string | null
          reason?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          verification_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "open_pool_restrictions_mismatch_event_id_fkey"
            columns: ["mismatch_event_id"]
            isOneToOne: false
            referencedRelation: "phone_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_pool_restrictions_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "phone_event_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      orr_agent_status_overrides: {
        Row: {
          agent_id: string
          is_available: boolean
          reason: string | null
          set_by: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          is_available?: boolean
          reason?: string | null
          set_by?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          is_available?: boolean
          reason?: string | null
          set_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      orr_config: {
        Row: {
          id: boolean
          live_cutoff: string
          timezone: string
          updated_at: string
          weekend_days: number[]
          work_end: string
          work_start: string
        }
        Insert: {
          id?: boolean
          live_cutoff?: string
          timezone?: string
          updated_at?: string
          weekend_days?: number[]
          work_end?: string
          work_start?: string
        }
        Update: {
          id?: boolean
          live_cutoff?: string
          timezone?: string
          updated_at?: string
          weekend_days?: number[]
          work_end?: string
          work_start?: string
        }
        Relationships: []
      }
      orr_exceptional_closures: {
        Row: {
          closure_date: string
          created_at: string
          created_by: string | null
          reason: string | null
        }
        Insert: {
          closure_date: string
          created_at?: string
          created_by?: string | null
          reason?: string | null
        }
        Update: {
          closure_date?: string
          created_at?: string
          created_by?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      orr_manager_overrides: {
        Row: {
          allowed_extra_call: boolean
          created_at: string
          id: string
          lead_id: string | null
          manager_id: string
          new_owner_id: string | null
          new_value: Json | null
          override_type: string
          phone_normalized: string | null
          previous_owner_id: string | null
          previous_value: Json | null
          reason: string
          refused: boolean
          refused_reason: string | null
        }
        Insert: {
          allowed_extra_call?: boolean
          created_at?: string
          id?: string
          lead_id?: string | null
          manager_id: string
          new_owner_id?: string | null
          new_value?: Json | null
          override_type: string
          phone_normalized?: string | null
          previous_owner_id?: string | null
          previous_value?: Json | null
          reason: string
          refused?: boolean
          refused_reason?: string | null
        }
        Update: {
          allowed_extra_call?: boolean
          created_at?: string
          id?: string
          lead_id?: string | null
          manager_id?: string
          new_owner_id?: string | null
          new_value?: Json | null
          override_type?: string
          phone_normalized?: string | null
          previous_owner_id?: string | null
          previous_value?: Json | null
          reason?: string
          refused?: boolean
          refused_reason?: string | null
        }
        Relationships: []
      }
      orr_release_events: {
        Row: {
          agent_id: string | null
          id: string
          lead_id: string | null
          reason: string
          released_at: string
        }
        Insert: {
          agent_id?: string | null
          id?: string
          lead_id?: string | null
          reason: string
          released_at?: string
        }
        Update: {
          agent_id?: string | null
          id?: string
          lead_id?: string | null
          reason?: string
          released_at?: string
        }
        Relationships: []
      }
      overflow_recipients: {
        Row: {
          admin_user_id: string
          created_at: string
          id: string
          is_active: boolean
          sort_order: number
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "overflow_recipients_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: true
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      overflow_round_robin_state: {
        Row: {
          id: string
          last_assigned_overflow_id: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          last_assigned_overflow_id?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          last_assigned_overflow_id?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "overflow_round_robin_state_last_assigned_overflow_id_fkey"
            columns: ["last_assigned_overflow_id"]
            isOneToOne: false
            referencedRelation: "overflow_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overflow_round_robin_state_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "lead_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          created_at: string
          fbclid: string | null
          gclid: string | null
          id: string
          is_bing_ads: boolean | null
          is_facebook_ads: boolean | null
          is_google_ads: boolean | null
          msclkid: string | null
          page_path: string
          page_title: string | null
          referrer: string | null
          screen_height: number | null
          screen_width: number | null
          session_id: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          fbclid?: string | null
          gclid?: string | null
          id?: string
          is_bing_ads?: boolean | null
          is_facebook_ads?: boolean | null
          is_google_ads?: boolean | null
          msclkid?: string | null
          page_path: string
          page_title?: string | null
          referrer?: string | null
          screen_height?: number | null
          screen_width?: number | null
          session_id?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          fbclid?: string | null
          gclid?: string | null
          id?: string
          is_bing_ads?: boolean | null
          is_facebook_ads?: boolean | null
          is_google_ads?: boolean | null
          msclkid?: string | null
          page_path?: string
          page_title?: string | null
          referrer?: string | null
          screen_height?: number | null
          screen_width?: number | null
          session_id?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      payment_assist_transactions: {
        Row: {
          admin_user_id: string | null
          amount_pence: number
          application_url: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_first_name: string | null
          customer_last_name: string | null
          customer_phone: string | null
          description: string | null
          environment: string
          id: string
          last_error: string | null
          last_event: string | null
          provider_application_id: string | null
          raw_response: Json | null
          reference: string | null
          sales_lead_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_user_id?: string | null
          amount_pence: number
          application_url?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_first_name?: string | null
          customer_last_name?: string | null
          customer_phone?: string | null
          description?: string | null
          environment?: string
          id?: string
          last_error?: string | null
          last_event?: string | null
          provider_application_id?: string | null
          raw_response?: Json | null
          reference?: string | null
          sales_lead_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_user_id?: string | null
          amount_pence?: number
          application_url?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_first_name?: string | null
          customer_last_name?: string | null
          customer_phone?: string | null
          description?: string | null
          environment?: string
          id?: string
          last_error?: string | null
          last_event?: string | null
          provider_application_id?: string | null
          raw_response?: Json | null
          reference?: string | null
          sales_lead_id?: string | null
          status?: string
          updated_at?: string
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
      payouts: {
        Row: {
          amount: number
          application_id: string | null
          created_at: string
          dealer_id: string
          id: string
          paid_at: string | null
          period: string | null
          status: string
        }
        Insert: {
          amount: number
          application_id?: string | null
          created_at?: string
          dealer_id: string
          id?: string
          paid_at?: string | null
          period?: string | null
          status?: string
        }
        Update: {
          amount?: number
          application_id?: string | null
          created_at?: string
          dealer_id?: string
          id?: string
          paid_at?: string | null
          period?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "finance_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
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
      phone_event_verifications: {
        Row: {
          created_at: string
          id: string
          manager_id: string
          manager_name: string | null
          notes: string | null
          phone_event_id: string
          recording_url: string | null
          result: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id: string
          manager_name?: string | null
          notes?: string | null
          phone_event_id: string
          recording_url?: string | null
          result: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string
          manager_name?: string | null
          notes?: string | null
          phone_event_id?: string
          recording_url?: string | null
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_event_verifications_phone_event_id_fkey"
            columns: ["phone_event_id"]
            isOneToOne: false
            referencedRelation: "phone_events"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_events: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          event_type: string
          id: string
          ip_address: string | null
          lead_id: string | null
          lead_source: string | null
          lead_type: string | null
          metadata: Json
          phone_number: string | null
          recording_url: string | null
          reservation_id: string | null
          selected_outcome: string | null
          session_id: string | null
          source_page: string | null
        }
        Insert: {
          agent_id?: string | null
          agent_name?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          lead_source?: string | null
          lead_type?: string | null
          metadata?: Json
          phone_number?: string | null
          recording_url?: string | null
          reservation_id?: string | null
          selected_outcome?: string | null
          session_id?: string | null
          source_page?: string | null
        }
        Update: {
          agent_id?: string | null
          agent_name?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          lead_source?: string | null
          lead_type?: string | null
          metadata?: Json
          phone_number?: string | null
          recording_url?: string | null
          reservation_id?: string | null
          selected_outcome?: string | null
          session_id?: string | null
          source_page?: string | null
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
      posted_letters_log: {
        Row: {
          action_type: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          id: string
          marked_sent_by: string | null
          notes: string | null
          plan_type: string | null
          registration_plate: string
          sent_at: string
          warranty_number: string | null
        }
        Insert: {
          action_type?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          id?: string
          marked_sent_by?: string | null
          notes?: string | null
          plan_type?: string | null
          registration_plate: string
          sent_at?: string
          warranty_number?: string | null
        }
        Update: {
          action_type?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          id?: string
          marked_sent_by?: string | null
          notes?: string | null
          plan_type?: string | null
          registration_plate?: string
          sent_at?: string
          warranty_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posted_letters_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      price_override_audit: {
        Row: {
          admin_user_id: string | null
          agent_email: string | null
          agent_name: string | null
          below_floor: boolean
          claim_limit: number | null
          context: string
          created_at: string
          customer_email: string | null
          customer_name: string | null
          diff_amount: number | null
          diff_pct: number | null
          discount_auth_request_id: string | null
          entered_monthly: number | null
          entered_total: number | null
          excess_amount: number | null
          floor_amount: number | null
          id: string
          labour_rate: number | null
          matrix_monthly: number | null
          matrix_total: number | null
          notes: string | null
          payment_type: string | null
          price_match_company: string | null
          price_match_mode: boolean
          price_match_price: number | null
          user_id: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_reg: string | null
        }
        Insert: {
          admin_user_id?: string | null
          agent_email?: string | null
          agent_name?: string | null
          below_floor?: boolean
          claim_limit?: number | null
          context?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          diff_amount?: number | null
          diff_pct?: number | null
          discount_auth_request_id?: string | null
          entered_monthly?: number | null
          entered_total?: number | null
          excess_amount?: number | null
          floor_amount?: number | null
          id?: string
          labour_rate?: number | null
          matrix_monthly?: number | null
          matrix_total?: number | null
          notes?: string | null
          payment_type?: string | null
          price_match_company?: string | null
          price_match_mode?: boolean
          price_match_price?: number | null
          user_id?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_reg?: string | null
        }
        Update: {
          admin_user_id?: string | null
          agent_email?: string | null
          agent_name?: string | null
          below_floor?: boolean
          claim_limit?: number | null
          context?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          diff_amount?: number | null
          diff_pct?: number | null
          discount_auth_request_id?: string | null
          entered_monthly?: number | null
          entered_total?: number | null
          excess_amount?: number | null
          floor_amount?: number | null
          id?: string
          labour_rate?: number | null
          matrix_monthly?: number | null
          matrix_total?: number | null
          notes?: string | null
          payment_type?: string | null
          price_match_company?: string | null
          price_match_mode?: boolean
          price_match_price?: number | null
          user_id?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_reg?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_override_audit_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_matrix_versions: {
        Row: {
          admin_matrix: Json
          claim_limit_factors: Json | null
          config_checksum: string | null
          created_at: string
          created_by: string | null
          effective_date: string | null
          id: string
          label: string
          labour_rate_factors: Json | null
          model_version: number
          notes: string | null
          price_caps: Json | null
          price_floors: Json | null
          published_at: string | null
          published_by: string | null
          reference_factors: Json | null
          reference_vehicle: Json | null
          rounding_rule: string | null
          status: string
          step3_discount_pct: number
          updated_at: string
          vehicle_factor_model: Json | null
        }
        Insert: {
          admin_matrix: Json
          claim_limit_factors?: Json | null
          config_checksum?: string | null
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          id?: string
          label?: string
          labour_rate_factors?: Json | null
          model_version?: number
          notes?: string | null
          price_caps?: Json | null
          price_floors?: Json | null
          published_at?: string | null
          published_by?: string | null
          reference_factors?: Json | null
          reference_vehicle?: Json | null
          rounding_rule?: string | null
          status?: string
          step3_discount_pct?: number
          updated_at?: string
          vehicle_factor_model?: Json | null
        }
        Update: {
          admin_matrix?: Json
          claim_limit_factors?: Json | null
          config_checksum?: string | null
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          id?: string
          label?: string
          labour_rate_factors?: Json | null
          model_version?: number
          notes?: string | null
          price_caps?: Json | null
          price_floors?: Json | null
          published_at?: string | null
          published_by?: string | null
          reference_factors?: Json | null
          reference_vehicle?: Json | null
          rounding_rule?: string | null
          status?: string
          step3_discount_pct?: number
          updated_at?: string
          vehicle_factor_model?: Json | null
        }
        Relationships: []
      }
      pricing_vehicle_rules: {
        Row: {
          covered: boolean
          created_at: string
          id: string
          min_one_year: number | null
          sort_order: number
          treatment: string
          updated_at: string
          updated_by: string | null
          vehicle: string
        }
        Insert: {
          covered?: boolean
          created_at?: string
          id?: string
          min_one_year?: number | null
          sort_order?: number
          treatment?: string
          updated_at?: string
          updated_by?: string | null
          vehicle: string
        }
        Update: {
          covered?: boolean
          created_at?: string
          id?: string
          min_one_year?: number | null
          sort_order?: number
          treatment?: string
          updated_at?: string
          updated_by?: string | null
          vehicle?: string
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
      quote_detail_issues: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string | null
          id: string
          issue_message: string | null
          quote_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          vehicle_reg: string | null
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          issue_message?: string | null
          quote_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          vehicle_reg?: string | null
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          issue_message?: string | null
          quote_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          vehicle_reg?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_detail_issues_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
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
      recontact_agent_caps: {
        Row: {
          admin_user_id: string
          blocked: boolean
          can_reassign: boolean
          can_self_assign: boolean
          created_at: string
          daily_cap: number | null
          note: string | null
          skip_batch_check: boolean
          total_cap: number | null
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          blocked?: boolean
          can_reassign?: boolean
          can_self_assign?: boolean
          created_at?: string
          daily_cap?: number | null
          note?: string | null
          skip_batch_check?: boolean
          total_cap?: number | null
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          blocked?: boolean
          can_reassign?: boolean
          can_self_assign?: boolean
          created_at?: string
          daily_cap?: number | null
          note?: string | null
          skip_batch_check?: boolean
          total_cap?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recontact_agent_caps_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: true
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
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
      renewal_campaign_log: {
        Row: {
          assigned_agent_id: string | null
          clicked_at: string | null
          created_at: string
          customer_id: string | null
          discount_code: string | null
          discount_code_id: string | null
          discount_percent: number | null
          email_log_id: string | null
          id: string
          metadata: Json | null
          milestone_days: number
          opened_at: string | null
          policy_id: string
          recipient_email: string | null
          scheduled_at: string | null
          scheduled_email_id: string | null
          sent_at: string | null
          skip_reason: string | null
          status: string
          template_key: string
          updated_at: string
        }
        Insert: {
          assigned_agent_id?: string | null
          clicked_at?: string | null
          created_at?: string
          customer_id?: string | null
          discount_code?: string | null
          discount_code_id?: string | null
          discount_percent?: number | null
          email_log_id?: string | null
          id?: string
          metadata?: Json | null
          milestone_days: number
          opened_at?: string | null
          policy_id: string
          recipient_email?: string | null
          scheduled_at?: string | null
          scheduled_email_id?: string | null
          sent_at?: string | null
          skip_reason?: string | null
          status?: string
          template_key: string
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string | null
          clicked_at?: string | null
          created_at?: string
          customer_id?: string | null
          discount_code?: string | null
          discount_code_id?: string | null
          discount_percent?: number | null
          email_log_id?: string | null
          id?: string
          metadata?: Json | null
          milestone_days?: number
          opened_at?: string | null
          policy_id?: string
          recipient_email?: string | null
          scheduled_at?: string | null
          scheduled_email_id?: string | null
          sent_at?: string | null
          skip_reason?: string | null
          status?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "renewal_campaign_log_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "customer_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      renewal_offers: {
        Row: {
          active: boolean
          auto_assign_agent: boolean
          created_at: string
          discount_percent: number
          id: string
          label: string
          milestone_days: number
          send_sms: boolean
          sort_order: number
          template_key: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          auto_assign_agent?: boolean
          created_at?: string
          discount_percent?: number
          id?: string
          label: string
          milestone_days: number
          send_sms?: boolean
          sort_order?: number
          template_key: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          auto_assign_agent?: boolean
          created_at?: string
          discount_percent?: number
          id?: string
          label?: string
          milestone_days?: number
          send_sms?: boolean
          sort_order?: number
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      renewal_pool_reservations: {
        Row: {
          created_at: string
          id: string
          locked_at: string
          locked_by: string
          owned_at: string | null
          owned_by: string | null
          policy_id: string
          released_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          locked_at?: string
          locked_by: string
          owned_at?: string | null
          owned_by?: string | null
          policy_id: string
          released_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          locked_at?: string
          locked_by?: string
          owned_at?: string | null
          owned_by?: string | null
          policy_id?: string
          released_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "renewal_pool_reservations_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_pool_reservations_owned_by_fkey"
            columns: ["owned_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_pool_reservations_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: true
            referencedRelation: "customer_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      round_robin_state: {
        Row: {
          id: string
          last_assigned_user_id: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          last_assigned_user_id?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          last_assigned_user_id?: string | null
          team_id?: string | null
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
          {
            foreignKeyName: "round_robin_state_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "lead_teams"
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
      sales_lead_team_visibility: {
        Row: {
          admin_user_id: string
          created_at: string
          granted_by: string | null
          id: string
          team_id: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          granted_by?: string | null
          id?: string
          team_id: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          granted_by?: string | null
          id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_lead_team_visibility_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_lead_team_visibility_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_lead_team_visibility_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "lead_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_leads: {
        Row: {
          abandoned_cart_id: string | null
          assigned_at: string | null
          assigned_to: string | null
          auto_tags: string[]
          call_count: number | null
          call_outcome: string | null
          cart_value: number | null
          claim_count: number
          converted_at: string | null
          created_at: string
          customer_contact_id: string | null
          do_not_contact: boolean
          do_not_contact_at: string | null
          do_not_contact_by: string | null
          do_not_contact_reason: string | null
          drip_release_at: string | null
          eligible_at: string | null
          email: string
          fake_audit_status: string | null
          fake_audited_at: string | null
          fake_audited_by: string | null
          fake_marked_at: string | null
          fake_marked_by: string | null
          fake_reason: string | null
          fake_reason_note: string | null
          first_name: string | null
          follow_up_status: string | null
          hidden_from_agent_ids: string[]
          id: string
          intake_class: string | null
          is_callback: boolean | null
          is_paid: boolean | null
          is_recreated: boolean | null
          last_action_at: string | null
          last_activity_date: string | null
          last_claimed_at: string | null
          last_contacted_at: string | null
          last_name: string | null
          last_resubmitted_at: string | null
          lead_source: Database["public"]["Enums"]["lead_source"] | null
          locked_at: string | null
          locked_by: string | null
          lost_at: string | null
          lost_reason: string | null
          manual_call_adjustment: number
          manual_entry: boolean
          mileage: string | null
          next_action_at: string | null
          next_action_date: string | null
          next_action_type: string | null
          notes: string | null
          original_assigned_to: string | null
          original_source: string | null
          orr_attempt_count: number
          orr_dormant_at: string | null
          orr_first_call_deadline: string | null
          orr_first_call_kind: string | null
          orr_first_call_missed_at: string | null
          orr_first_call_missed_by: string | null
          orr_first_call_missed_count: number
          orr_first_call_notified_at: string | null
          orr_last_attempt_at: string | null
          orr_locked_until: string | null
          orr_next_release_at: string | null
          orr_offer_expires_at: string | null
          orr_offer_passed_by: string[]
          orr_pool_kind: string | null
          orr_pool_next_open_at: string | null
          orr_pool_since: string | null
          orr_pool_state: string | null
          orr_reassign_count: number
          orr_retry_deadline: string | null
          orr_retry_missed_at: string | null
          orr_retry_missed_by: string | null
          owner_agent: string | null
          payment_amount: number | null
          payment_date: string | null
          payment_method: string | null
          phone: string | null
          phone_normalized: string | null
          plan_interest: string | null
          pool_recycle_count: number
          pool_status: string | null
          priority: Database["public"]["Enums"]["lead_priority"] | null
          priority_score: number | null
          queue: string | null
          quote_amount: number | null
          reason: string | null
          recovery_outcome: string | null
          recovery_worked_at: string | null
          resubmission_count: number | null
          status: Database["public"]["Enums"]["lead_status"] | null
          step_two_completed_at: string | null
          updated_at: string
          upsold_at: string | null
          upsold_by: string | null
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
          auto_tags?: string[]
          call_count?: number | null
          call_outcome?: string | null
          cart_value?: number | null
          claim_count?: number
          converted_at?: string | null
          created_at?: string
          customer_contact_id?: string | null
          do_not_contact?: boolean
          do_not_contact_at?: string | null
          do_not_contact_by?: string | null
          do_not_contact_reason?: string | null
          drip_release_at?: string | null
          eligible_at?: string | null
          email: string
          fake_audit_status?: string | null
          fake_audited_at?: string | null
          fake_audited_by?: string | null
          fake_marked_at?: string | null
          fake_marked_by?: string | null
          fake_reason?: string | null
          fake_reason_note?: string | null
          first_name?: string | null
          follow_up_status?: string | null
          hidden_from_agent_ids?: string[]
          id?: string
          intake_class?: string | null
          is_callback?: boolean | null
          is_paid?: boolean | null
          is_recreated?: boolean | null
          last_action_at?: string | null
          last_activity_date?: string | null
          last_claimed_at?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          last_resubmitted_at?: string | null
          lead_source?: Database["public"]["Enums"]["lead_source"] | null
          locked_at?: string | null
          locked_by?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          manual_call_adjustment?: number
          manual_entry?: boolean
          mileage?: string | null
          next_action_at?: string | null
          next_action_date?: string | null
          next_action_type?: string | null
          notes?: string | null
          original_assigned_to?: string | null
          original_source?: string | null
          orr_attempt_count?: number
          orr_dormant_at?: string | null
          orr_first_call_deadline?: string | null
          orr_first_call_kind?: string | null
          orr_first_call_missed_at?: string | null
          orr_first_call_missed_by?: string | null
          orr_first_call_missed_count?: number
          orr_first_call_notified_at?: string | null
          orr_last_attempt_at?: string | null
          orr_locked_until?: string | null
          orr_next_release_at?: string | null
          orr_offer_expires_at?: string | null
          orr_offer_passed_by?: string[]
          orr_pool_kind?: string | null
          orr_pool_next_open_at?: string | null
          orr_pool_since?: string | null
          orr_pool_state?: string | null
          orr_reassign_count?: number
          orr_retry_deadline?: string | null
          orr_retry_missed_at?: string | null
          orr_retry_missed_by?: string | null
          owner_agent?: string | null
          payment_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          phone?: string | null
          phone_normalized?: string | null
          plan_interest?: string | null
          pool_recycle_count?: number
          pool_status?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"] | null
          priority_score?: number | null
          queue?: string | null
          quote_amount?: number | null
          reason?: string | null
          recovery_outcome?: string | null
          recovery_worked_at?: string | null
          resubmission_count?: number | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          step_two_completed_at?: string | null
          updated_at?: string
          upsold_at?: string | null
          upsold_by?: string | null
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
          auto_tags?: string[]
          call_count?: number | null
          call_outcome?: string | null
          cart_value?: number | null
          claim_count?: number
          converted_at?: string | null
          created_at?: string
          customer_contact_id?: string | null
          do_not_contact?: boolean
          do_not_contact_at?: string | null
          do_not_contact_by?: string | null
          do_not_contact_reason?: string | null
          drip_release_at?: string | null
          eligible_at?: string | null
          email?: string
          fake_audit_status?: string | null
          fake_audited_at?: string | null
          fake_audited_by?: string | null
          fake_marked_at?: string | null
          fake_marked_by?: string | null
          fake_reason?: string | null
          fake_reason_note?: string | null
          first_name?: string | null
          follow_up_status?: string | null
          hidden_from_agent_ids?: string[]
          id?: string
          intake_class?: string | null
          is_callback?: boolean | null
          is_paid?: boolean | null
          is_recreated?: boolean | null
          last_action_at?: string | null
          last_activity_date?: string | null
          last_claimed_at?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          last_resubmitted_at?: string | null
          lead_source?: Database["public"]["Enums"]["lead_source"] | null
          locked_at?: string | null
          locked_by?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          manual_call_adjustment?: number
          manual_entry?: boolean
          mileage?: string | null
          next_action_at?: string | null
          next_action_date?: string | null
          next_action_type?: string | null
          notes?: string | null
          original_assigned_to?: string | null
          original_source?: string | null
          orr_attempt_count?: number
          orr_dormant_at?: string | null
          orr_first_call_deadline?: string | null
          orr_first_call_kind?: string | null
          orr_first_call_missed_at?: string | null
          orr_first_call_missed_by?: string | null
          orr_first_call_missed_count?: number
          orr_first_call_notified_at?: string | null
          orr_last_attempt_at?: string | null
          orr_locked_until?: string | null
          orr_next_release_at?: string | null
          orr_offer_expires_at?: string | null
          orr_offer_passed_by?: string[]
          orr_pool_kind?: string | null
          orr_pool_next_open_at?: string | null
          orr_pool_since?: string | null
          orr_pool_state?: string | null
          orr_reassign_count?: number
          orr_retry_deadline?: string | null
          orr_retry_missed_at?: string | null
          orr_retry_missed_by?: string | null
          owner_agent?: string | null
          payment_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          phone?: string | null
          phone_normalized?: string | null
          plan_interest?: string | null
          pool_recycle_count?: number
          pool_status?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"] | null
          priority_score?: number | null
          queue?: string | null
          quote_amount?: number | null
          reason?: string | null
          recovery_outcome?: string | null
          recovery_worked_at?: string | null
          resubmission_count?: number | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          step_two_completed_at?: string | null
          updated_at?: string
          upsold_at?: string | null
          upsold_by?: string | null
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
          {
            foreignKeyName: "sales_leads_customer_contact_id_fkey"
            columns: ["customer_contact_id"]
            isOneToOne: false
            referencedRelation: "lead_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_leads_changelog: {
        Row: {
          change_type: string
          changed_at: string
          changed_by: string | null
          id: string
          lead_id: string
          new_assigned_to: string | null
          new_call_count: number | null
          new_contact_notes: string | null
          new_is_paid: boolean | null
          new_next_action_date: string | null
          new_next_action_type: string | null
          new_notes: string | null
          new_payment_amount: number | null
          new_priority: string | null
          new_record: Json | null
          new_status: string | null
          old_assigned_to: string | null
          old_call_count: number | null
          old_contact_notes: string | null
          old_is_paid: boolean | null
          old_next_action_date: string | null
          old_next_action_type: string | null
          old_notes: string | null
          old_payment_amount: number | null
          old_priority: string | null
          old_record: Json | null
          old_status: string | null
        }
        Insert: {
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          lead_id: string
          new_assigned_to?: string | null
          new_call_count?: number | null
          new_contact_notes?: string | null
          new_is_paid?: boolean | null
          new_next_action_date?: string | null
          new_next_action_type?: string | null
          new_notes?: string | null
          new_payment_amount?: number | null
          new_priority?: string | null
          new_record?: Json | null
          new_status?: string | null
          old_assigned_to?: string | null
          old_call_count?: number | null
          old_contact_notes?: string | null
          old_is_paid?: boolean | null
          old_next_action_date?: string | null
          old_next_action_type?: string | null
          old_notes?: string | null
          old_payment_amount?: number | null
          old_priority?: string | null
          old_record?: Json | null
          old_status?: string | null
        }
        Update: {
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          lead_id?: string
          new_assigned_to?: string | null
          new_call_count?: number | null
          new_contact_notes?: string | null
          new_is_paid?: boolean | null
          new_next_action_date?: string | null
          new_next_action_type?: string | null
          new_notes?: string | null
          new_payment_amount?: number | null
          new_priority?: string | null
          new_record?: Json | null
          new_status?: string | null
          old_assigned_to?: string | null
          old_call_count?: number | null
          old_contact_notes?: string | null
          old_is_paid?: boolean | null
          old_next_action_date?: string | null
          old_next_action_type?: string | null
          old_notes?: string | null
          old_payment_amount?: number | null
          old_priority?: string | null
          old_record?: Json | null
          old_status?: string | null
        }
        Relationships: []
      }
      sales_targets: {
        Row: {
          achieved_amount: number
          admin_user_id: string
          created_at: string
          end_date: string
          full_month_days: number | null
          id: string
          manual_actual_attempts: number | null
          manual_leads_count: number | null
          revenue_target: number
          start_date: string
          target_amount: number
          target_period: string
          updated_at: string
          working_days: number | null
        }
        Insert: {
          achieved_amount?: number
          admin_user_id: string
          created_at?: string
          end_date: string
          full_month_days?: number | null
          id?: string
          manual_actual_attempts?: number | null
          manual_leads_count?: number | null
          revenue_target?: number
          start_date: string
          target_amount: number
          target_period: string
          updated_at?: string
          working_days?: number | null
        }
        Update: {
          achieved_amount?: number
          admin_user_id?: string
          created_at?: string
          end_date?: string
          full_month_days?: number | null
          id?: string
          manual_actual_attempts?: number | null
          manual_leads_count?: number | null
          revenue_target?: number
          start_date?: string
          target_amount?: number
          target_period?: string
          updated_at?: string
          working_days?: number | null
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
      scheduled_sms: {
        Row: {
          created_at: string
          error_message: string | null
          first_name: string | null
          id: string
          phone: string
          send_after: string
          sent_at: string | null
          status: string
          vehicle_make: string | null
          vehicle_model: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          first_name?: string | null
          id?: string
          phone: string
          send_after: string
          sent_at?: string | null
          status?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          first_name?: string | null
          id?: string
          phone?: string
          send_after?: string
          sent_at?: string | null
          status?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
        }
        Relationships: []
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
      shark_tank_agent_caps: {
        Row: {
          admin_user_id: string
          blocked: boolean
          daily_cap: number | null
          note: string | null
          total_cap: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_user_id: string
          blocked?: boolean
          daily_cap?: number | null
          note?: string | null
          total_cap?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_user_id?: string
          blocked?: boolean
          daily_cap?: number | null
          note?: string | null
          total_cap?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shark_tank_agent_caps_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: true
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shark_tank_agent_caps_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      shark_tank_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          lead_id: string
          payload: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          lead_id: string
          payload?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          payload?: Json
        }
        Relationships: []
      }
      shark_tank_pool: {
        Row: {
          attempt_count: number
          chase_release_at: string | null
          created_at: string
          held_by: string | null
          held_until: string | null
          id: string
          last_outcome: string | null
          lead_id: string
          retry_until: string | null
          status: Database["public"]["Enums"]["shark_tank_status"]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          chase_release_at?: string | null
          created_at?: string
          held_by?: string | null
          held_until?: string | null
          id?: string
          last_outcome?: string | null
          lead_id: string
          retry_until?: string | null
          status?: Database["public"]["Enums"]["shark_tank_status"]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          chase_release_at?: string | null
          created_at?: string
          held_by?: string | null
          held_until?: string | null
          id?: string
          last_outcome?: string | null
          lead_id?: string
          retry_until?: string | null
          status?: Database["public"]["Enums"]["shark_tank_status"]
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shark_tank_pool_held_by_fkey"
            columns: ["held_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shark_tank_pool_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "sales_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shark_tank_pool_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "lead_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      shark_tank_settings: {
        Row: {
          chase_minutes: number
          dry_run: boolean
          enabled: boolean
          hold_seconds: number
          id: number
          no_answer_final_action: string
          renewal_enabled: boolean
          renewal_hold_seconds: number
          renewal_owner_inactive_days: number
          renewal_stale_days: number
          renewal_window_days: number
          retry_minutes: number
          team_ids: string[]
          updated_at: string
        }
        Insert: {
          chase_minutes?: number
          dry_run?: boolean
          enabled?: boolean
          hold_seconds?: number
          id?: number
          no_answer_final_action?: string
          renewal_enabled?: boolean
          renewal_hold_seconds?: number
          renewal_owner_inactive_days?: number
          renewal_stale_days?: number
          renewal_window_days?: number
          retry_minutes?: number
          team_ids?: string[]
          updated_at?: string
        }
        Update: {
          chase_minutes?: number
          dry_run?: boolean
          enabled?: boolean
          hold_seconds?: number
          id?: number
          no_answer_final_action?: string
          renewal_enabled?: boolean
          renewal_hold_seconds?: number
          renewal_owner_inactive_days?: number
          renewal_stale_days?: number
          renewal_window_days?: number
          retry_minutes?: number
          team_ids?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      sms_consents: {
        Row: {
          abandoned_cart_id: string | null
          consent_given_at: string | null
          consent_status: string | null
          created_at: string | null
          customer_name: string | null
          id: string
          last_interaction_at: string | null
          last_message_received: string | null
          last_message_sent: string | null
          lead_id: string | null
          normalized_phone: string
          opted_out_at: string | null
          phone: string
          updated_at: string | null
          vehicle_info: string | null
        }
        Insert: {
          abandoned_cart_id?: string | null
          consent_given_at?: string | null
          consent_status?: string | null
          created_at?: string | null
          customer_name?: string | null
          id?: string
          last_interaction_at?: string | null
          last_message_received?: string | null
          last_message_sent?: string | null
          lead_id?: string | null
          normalized_phone: string
          opted_out_at?: string | null
          phone: string
          updated_at?: string | null
          vehicle_info?: string | null
        }
        Update: {
          abandoned_cart_id?: string | null
          consent_given_at?: string | null
          consent_status?: string | null
          created_at?: string | null
          customer_name?: string | null
          id?: string
          last_interaction_at?: string | null
          last_message_received?: string | null
          last_message_sent?: string | null
          lead_id?: string | null
          normalized_phone?: string
          opted_out_at?: string | null
          phone?: string
          updated_at?: string | null
          vehicle_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_consents_abandoned_cart_id_fkey"
            columns: ["abandoned_cart_id"]
            isOneToOne: false
            referencedRelation: "abandoned_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_consents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sales_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_send_log: {
        Row: {
          clicksend_message_id: string | null
          clicksend_status: string | null
          cost: number | null
          created_at: string
          customer_id: string | null
          error_message: string | null
          http_status: number | null
          id: string
          lead_id: string | null
          message: string | null
          message_type: string | null
          phone: string
          raw_response: Json | null
          success: boolean
          triggered_by: string | null
        }
        Insert: {
          clicksend_message_id?: string | null
          clicksend_status?: string | null
          cost?: number | null
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          lead_id?: string | null
          message?: string | null
          message_type?: string | null
          phone: string
          raw_response?: Json | null
          success?: boolean
          triggered_by?: string | null
        }
        Update: {
          clicksend_message_id?: string | null
          clicksend_status?: string | null
          cost?: number | null
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          lead_id?: string | null
          message?: string | null
          message_type?: string | null
          phone?: string
          raw_response?: Json | null
          success?: boolean
          triggered_by?: string | null
        }
        Relationships: []
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
      staff_hub_documents: {
        Row: {
          allowed_roles: string[]
          allowed_team_ids: string[]
          category: string
          created_at: string
          description: string | null
          file_name: string
          file_size: number | null
          id: string
          is_archived: boolean
          mime_type: string | null
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          allowed_roles?: string[]
          allowed_team_ids?: string[]
          category?: string
          created_at?: string
          description?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          is_archived?: boolean
          mime_type?: string | null
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          allowed_roles?: string[]
          allowed_team_ids?: string[]
          category?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          is_archived?: boolean
          mime_type?: string | null
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
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
      staff_work_locations: {
        Row: {
          admin_user_id: string
          city: string | null
          country: string | null
          country_code: string | null
          created_at: string
          device_type: string | null
          email: string
          first_seen_at: string
          id: string
          ip_address: string
          is_vpn: boolean
          isp: string | null
          last_seen_at: string
          latitude: number | null
          longitude: number | null
          ping_count: number
          region: string | null
          session_date: string
          timezone: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          admin_user_id: string
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          device_type?: string | null
          email: string
          first_seen_at?: string
          id?: string
          ip_address: string
          is_vpn?: boolean
          isp?: string | null
          last_seen_at?: string
          latitude?: number | null
          longitude?: number | null
          ping_count?: number
          region?: string | null
          session_date?: string
          timezone?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          admin_user_id?: string
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          device_type?: string | null
          email?: string
          first_seen_at?: string
          id?: string
          ip_address?: string
          is_vpn?: boolean
          isp?: string | null
          last_seen_at?: string
          latitude?: number | null
          longitude?: number | null
          ping_count?: number
          region?: string | null
          session_date?: string
          timezone?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      step2_submission_attempts: {
        Row: {
          attempt_status: string
          created_at: string
          email: string | null
          error_message: string | null
          error_source: string | null
          first_name: string | null
          id: string
          mileage: string | null
          phone: string | null
          session_id: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_reg: string | null
          vehicle_year: string | null
        }
        Insert: {
          attempt_status?: string
          created_at?: string
          email?: string | null
          error_message?: string | null
          error_source?: string | null
          first_name?: string | null
          id?: string
          mileage?: string | null
          phone?: string | null
          session_id?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_reg?: string | null
          vehicle_year?: string | null
        }
        Update: {
          attempt_status?: string
          created_at?: string
          email?: string | null
          error_message?: string | null
          error_source?: string | null
          first_name?: string | null
          id?: string
          mileage?: string | null
          phone?: string | null
          session_id?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_reg?: string | null
          vehicle_year?: string | null
        }
        Relationships: []
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
      system_event_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_data: Json | null
          event_source: string | null
          event_type: string
          id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_data?: Json | null
          event_source?: string | null
          event_type: string
          id?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_data?: Json | null
          event_source?: string | null
          event_type?: string
          id?: string
        }
        Relationships: []
      }
      timesheet_bonuses: {
        Row: {
          admin_user_id: string | null
          amount: number | null
          bonus_type: string
          created_at: string
          description: string | null
          id: string
          month_year: string
          quantity: number
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_user_id?: string | null
          amount?: number | null
          bonus_type: string
          created_at?: string
          description?: string | null
          id?: string
          month_year: string
          quantity?: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_user_id?: string | null
          amount?: number | null
          bonus_type?: string
          created_at?: string
          description?: string | null
          id?: string
          month_year?: string
          quantity?: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_bonuses_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_bonuses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_comments: {
        Row: {
          admin_user_id: string
          author_id: string | null
          created_at: string
          id: string
          is_from_accounts: boolean | null
          message: string
          month_year: string
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          author_id?: string | null
          created_at?: string
          id?: string
          is_from_accounts?: boolean | null
          message: string
          month_year: string
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          author_id?: string | null
          created_at?: string
          id?: string
          is_from_accounts?: boolean | null
          message?: string
          month_year?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_comments_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_warranty_signups: {
        Row: {
          additional_information: string | null
          contact_name: string | null
          created_at: string
          current_warranty_provider: string | null
          dealership_name: string | null
          email_address: string
          heard_about_us: string | null
          id: string
          interested_in: string | null
          monthly_vehicle_sales: string | null
          phone_number: string
          status: Database["public"]["Enums"]["trade_warranty_signup_status"]
          updated_at: string
        }
        Insert: {
          additional_information?: string | null
          contact_name?: string | null
          created_at?: string
          current_warranty_provider?: string | null
          dealership_name?: string | null
          email_address: string
          heard_about_us?: string | null
          id?: string
          interested_in?: string | null
          monthly_vehicle_sales?: string | null
          phone_number: string
          status?: Database["public"]["Enums"]["trade_warranty_signup_status"]
          updated_at?: string
        }
        Update: {
          additional_information?: string | null
          contact_name?: string | null
          created_at?: string
          current_warranty_provider?: string | null
          dealership_name?: string | null
          email_address?: string
          heard_about_us?: string | null
          id?: string
          interested_in?: string | null
          monthly_vehicle_sales?: string | null
          phone_number?: string
          status?: Database["public"]["Enums"]["trade_warranty_signup_status"]
          updated_at?: string
        }
        Relationships: []
      }
      trader_pricing_config: {
        Row: {
          active: boolean
          category: string
          created_at: string
          id: string
          multiplier: number
          option_key: string
          option_label: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          id?: string
          multiplier: number
          option_key: string
          option_label?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          multiplier?: number
          option_key?: string
          option_label?: string | null
          updated_at?: string
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
          email_clicked: boolean | null
          email_log_id: string | null
          email_opened: boolean | null
          email_sequence_number: number | null
          email_subject: string | null
          id: string
          next_email_scheduled_for: string | null
          policy_id: string
          review_completed: boolean | null
          sent_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          email: string
          email_clicked?: boolean | null
          email_log_id?: string | null
          email_opened?: boolean | null
          email_sequence_number?: number | null
          email_subject?: string | null
          id?: string
          next_email_scheduled_for?: string | null
          policy_id: string
          review_completed?: boolean | null
          sent_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          email?: string
          email_clicked?: boolean | null
          email_log_id?: string | null
          email_opened?: boolean | null
          email_sequence_number?: number | null
          email_subject?: string | null
          id?: string
          next_email_scheduled_for?: string | null
          policy_id?: string
          review_completed?: boolean | null
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
      uk_bank_holidays: {
        Row: {
          created_at: string
          holiday_date: string
          name: string | null
        }
        Insert: {
          created_at?: string
          holiday_date: string
          name?: string | null
        }
        Update: {
          created_at?: string
          holiday_date?: string
          name?: string | null
        }
        Relationships: []
      }
      underwriting_rules: {
        Row: {
          active: boolean
          id: string
          name: string
          rules: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          id?: string
          name: string
          rules?: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          id?: string
          name?: string
          rules?: Json
          updated_at?: string
        }
        Relationships: []
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
          interaction_count: number | null
          is_paused_receiving: boolean | null
          last_activity_at: string
          last_interaction_at: string | null
          last_seen_at: string
          session_started_at: string | null
          status: string
          updated_at: string
          user_id: string
          visibility_state: string | null
        }
        Insert: {
          admin_user_id?: string | null
          created_at?: string
          current_tab?: string | null
          device_info?: Json | null
          id?: string
          interaction_count?: number | null
          is_paused_receiving?: boolean | null
          last_activity_at?: string
          last_interaction_at?: string | null
          last_seen_at?: string
          session_started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          visibility_state?: string | null
        }
        Update: {
          admin_user_id?: string | null
          created_at?: string
          current_tab?: string | null
          device_info?: Json | null
          id?: string
          interaction_count?: number | null
          is_paused_receiving?: boolean | null
          last_activity_at?: string
          last_interaction_at?: string | null
          last_seen_at?: string
          session_started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          visibility_state?: string | null
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
      whatsapp_message_log: {
        Row: {
          abandoned_cart_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          lead_id: string | null
          message_type: string
          normalized_phone: string
          phone: string
          status: string
          uchat_response: Json | null
        }
        Insert: {
          abandoned_cart_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          message_type?: string
          normalized_phone: string
          phone: string
          status?: string
          uchat_response?: Json | null
        }
        Update: {
          abandoned_cart_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          message_type?: string
          normalized_phone?: string
          phone?: string
          status?: string
          uchat_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_log_abandoned_cart_id_fkey"
            columns: ["abandoned_cart_id"]
            isOneToOne: false
            referencedRelation: "abandoned_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sales_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      worldpay_transactions: {
        Row: {
          admin_user_id: string | null
          amount_pence: number
          created_at: string
          currency: string
          customer_email: string | null
          customer_id: string | null
          customer_phone: string | null
          description: string | null
          environment: string
          flow: string
          id: string
          last_error: string | null
          last_event: string | null
          raw_response: Json | null
          sales_lead_id: string | null
          status: string
          updated_at: string
          worldpay_link_id: string | null
          worldpay_link_url: string | null
          worldpay_payment_id: string | null
        }
        Insert: {
          admin_user_id?: string | null
          amount_pence: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_phone?: string | null
          description?: string | null
          environment?: string
          flow: string
          id?: string
          last_error?: string | null
          last_event?: string | null
          raw_response?: Json | null
          sales_lead_id?: string | null
          status?: string
          updated_at?: string
          worldpay_link_id?: string | null
          worldpay_link_url?: string | null
          worldpay_payment_id?: string | null
        }
        Update: {
          admin_user_id?: string | null
          amount_pence?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_phone?: string | null
          description?: string | null
          environment?: string
          flow?: string
          id?: string
          last_error?: string | null
          last_event?: string | null
          raw_response?: Json | null
          sales_lead_id?: string | null
          status?: string
          updated_at?: string
          worldpay_link_id?: string | null
          worldpay_link_url?: string | null
          worldpay_payment_id?: string | null
        }
        Relationships: []
      }
      zoiper_call_events: {
        Row: {
          agent_email: string | null
          agent_extension: string | null
          agent_user_id: string | null
          answered_at: string | null
          caller_number: string | null
          created_at: string
          dialed_number: string | null
          direction: string
          duration_seconds: number | null
          ended_at: string | null
          external_call_id: string | null
          id: string
          raw_payload: Json | null
          started_at: string
          status: string
          talk_seconds: number | null
        }
        Insert: {
          agent_email?: string | null
          agent_extension?: string | null
          agent_user_id?: string | null
          answered_at?: string | null
          caller_number?: string | null
          created_at?: string
          dialed_number?: string | null
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          external_call_id?: string | null
          id?: string
          raw_payload?: Json | null
          started_at: string
          status?: string
          talk_seconds?: number | null
        }
        Update: {
          agent_email?: string | null
          agent_extension?: string | null
          agent_user_id?: string | null
          answered_at?: string | null
          caller_number?: string | null
          created_at?: string
          dialed_number?: string | null
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          external_call_id?: string | null
          id?: string
          raw_payload?: Json | null
          started_at?: string
          status?: string
          talk_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "zoiper_call_events_agent_user_id_fkey"
            columns: ["agent_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
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
      adjust_sales_lead_call_count: {
        Args: { p_delta: number; p_lead_id: string }
        Returns: number
      }
      agent_works_new_leads: {
        Args: { p_admin_user_id: string }
        Returns: boolean
      }
      archive_admin_user_preserve_sales: {
        Args: { p_admin_user_id: string }
        Returns: undefined
      }
      assign_lead_to_agent: {
        Args: {
          p_agent_id: string
          p_is_abandoned_cart?: boolean
          p_lead_id: string
          p_override_cap?: boolean
        }
        Returns: Json
      }
      assign_recontact_leads_to_agent: {
        Args: { _agent_id: string; _batch_size?: number }
        Returns: {
          assigned_count: number
          blocked_reason: string
          pool_remaining: number
        }[]
      }
      auto_expire_discount_codes: { Args: never; Returns: number }
      backfill_lead_data_from_step2: { Args: never; Returns: Json }
      bulk_reassign_leads_to_agent: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_from_agent: string
          p_include_customers?: boolean
          p_lead_ids?: string[]
          p_limit?: number
          p_override_cap?: boolean
          p_skip_worked?: boolean
          p_to_agent: string
        }
        Returns: Json
      }
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
      can_manage_claim_reminders: { Args: never; Returns: boolean }
      can_manage_lead_routing: { Args: { _user_id: string }; Returns: boolean }
      can_view_staff_hub_doc: {
        Args: { _allowed_roles: string[]; _allowed_team_ids: string[] }
        Returns: boolean
      }
      claim_lead_for_agent: {
        Args: { p_agent_id: string; p_lead_id: string }
        Returns: Json
      }
      claim_recontact_leads_batch: {
        Args: { _batch_size?: number; _force?: boolean }
        Returns: {
          blocked_reason: string
          claimed_count: number
          oldest_age_days: number
          pending_count: number
          pool_remaining: number
        }[]
      }
      claim_recontact_leads_self: {
        Args: { _lead_ids: string[] }
        Returns: {
          claimed_id: string
        }[]
      }
      count_recontact_leads_available: {
        Args: never
        Returns: {
          available_count: number
          oldest_age_days: number
          pool_total: number
        }[]
      }
      create_agent_offboarding_backup: {
        Args: {
          _also_deactivate?: boolean
          _notes?: string
          _reset_to_new?: boolean
          _source_admin_user_id: string
          _target_admin_user_id: string
        }
        Returns: Json
      }
      current_admin_user_id: { Args: never; Returns: string }
      current_dealer_id: { Args: never; Returns: string }
      current_policy_pdf_urls: {
        Args: never
        Returns: {
          platinum_url: string
          terms_url: string
        }[]
      }
      delete_admin_user_cascade: {
        Args: { p_admin_user_id: string }
        Returns: undefined
      }
      derive_lead_source: {
        Args: { p_cart_metadata: Json }
        Returns: Database["public"]["Enums"]["lead_source"]
      }
      enforce_agent_cap: {
        Args: { p_agent_id: string; p_override?: boolean }
        Returns: Json
      }
      find_open_cart_id_by_reg: {
        Args: { _vehicle_reg: string }
        Returns: string
      }
      find_sales_lead_by_phone_tail9: {
        Args: { tail_digits: string }
        Returns: {
          call_count: number
          id: string
        }[]
      }
      fix_customer_role: { Args: { p_user_id: string }; Returns: undefined }
      generate_admin_warranty_number: { Args: never; Returns: string }
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
      get_agent_live_stats: {
        Args: { p_date: string }
        Returns: {
          active_leads_eod: number
          agent_id: string
          callbacks_completed: number
          callbacks_set: number
          calls_logged: number
          leads_assigned: number
          marked_converted: number
          marked_fake: number
          marked_lost: number
          notes_added: number
          self_assigned: number
          stat_date: string
          status_changes: number
        }[]
      }
      get_blog_page_analytics: {
        Args: { _paths: string[]; _since_days?: number }
        Returns: {
          cta_sessions: number
          direct_views: number
          facebook_ads_views: number
          google_ads_views: number
          organic_views: number
          page_path: string
          top_referrer: string
          top_utm_source: string
          views: number
          visitors: number
        }[]
      }
      get_bumper_transaction_for_fallback: {
        Args: { p_transaction_id: string }
        Returns: {
          claim_limit: number
          customer_data: Json
          discount_code: string
          final_amount: number
          payment_type: string
          plan_id: string
          protection_addons: Json
          transaction_id: string
          vehicle_data: Json
        }[]
      }
      get_claim_update_request_by_token: {
        Args: { _token: string }
        Returns: {
          claim_id: string
          claim_reason: string
          customer_name: string
          expires_at: string
          id: string
          is_responded: boolean
          recipient_email: string
          sent_at: string
          token: string
          vehicle_registration: string
        }[]
      }
      get_clean_leads_per_agent: {
        Args: { _agent_ids: string[]; _end: string; _start: string }
        Returns: {
          assigned_to: string
          clean_converted: number
          clean_leads: number
        }[]
      }
      get_column_mask: {
        Args: { p_column: string; p_user_id: string }
        Returns: string
      }
      get_concession_usage: {
        Args: { p_admin_user_id: string; p_year_month: string }
        Returns: {
          used_1mo: number
          used_3mo: number
          used_6mo: number
        }[]
      }
      get_document_version_for_date: {
        Args: { _on_date: string; _plan_type: string }
        Returns: {
          document_name: string
          effective_from: string
          effective_to: string
          file_url: string
          id: string
          plan_type: string
          version: string
        }[]
      }
      get_lead_quick_note_counts: {
        Args: { p_lead_ids: string[] }
        Returns: {
          lead_id: string
          note_count: number
        }[]
      }
      get_mtd_leads_per_agent: {
        Args: { _agent_ids: string[] }
        Returns: {
          assigned_to: string
          lead_count: number
        }[]
      }
      get_next_eligible_agent:
        | { Args: { p_distribution_mode?: string }; Returns: string }
        | { Args: { p_exclude_agent_id?: string }; Returns: string }
      get_next_sales_user: { Args: never; Returns: string }
      get_next_warranty_serial: { Args: never; Returns: number }
      get_team_scoreboard: {
        Args: { p_end: string; p_start: string }
        Returns: {
          admin_user_id: string
          agent_name: string
          full_month_days: number
          full_month_target: number
          is_self: boolean
          pct_achieved: number
          revenue: number
          revenue_target: number
          sales_count: number
          team_id: string
          team_name: string
          team_pct: number
          team_revenue: number
          team_sort: number
          working_days: number
        }[]
      }
      get_user_permissions: { Args: { p_user_id: string }; Returns: Json }
      has_admin_permission: {
        Args: { permission_key: string; user_id: string }
        Returns: boolean
      }
      has_all_leads_permission: { Args: { _user_id: string }; Returns: boolean }
      has_tab_access: {
        Args: { _tab: string; _user_id: string }
        Returns: boolean
      }
      has_tab_permission: {
        Args: { p_action?: string; p_tab: string; p_user_id: string }
        Returns: boolean
      }
      is_active_admin_user: { Args: { _user_id: string }; Returns: boolean }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_admin_or_sales: { Args: { _user_id: string }; Returns: boolean }
      is_agent_on_duty: { Args: { p_admin_user_id: string }; Returns: boolean }
      is_agent_on_team_blue: { Args: { _agent: string }; Returns: boolean }
      is_agent_open_pool_restricted: {
        Args: { _agent_id: string }
        Returns: boolean
      }
      is_agent_receiving_enabled: {
        Args: { p_agent_id: string }
        Returns: boolean
      }
      is_blog_writer: { Args: { user_id: string }; Returns: boolean }
      is_ip_blocked: { Args: { check_ip: unknown }; Returns: boolean }
      is_management: { Args: { _user_id: string }; Returns: boolean }
      is_phone_logs_manager: { Args: { _user_id: string }; Returns: boolean }
      is_sales_lead: { Args: { _user_id: string }; Returns: boolean }
      is_staff:
        | { Args: never; Returns: boolean }
        | { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      lead_has_been_worked: { Args: { p_lead_id: string }; Returns: boolean }
      lead_has_human_activity: { Args: { p_lead_id: string }; Returns: boolean }
      lead_routing_scope: { Args: { _user_id: string }; Returns: string }
      list_recent_bulk_reassignments: {
        Args: { p_hours?: number; p_min_batch?: number }
        Returns: {
          batch_key: string
          bucket_start: string
          changed_by: string
          first_changed_at: string
          last_changed_at: string
          lead_count: number
          new_assigned_to: string
          old_assigned_to: string
          still_on_new_count: number
        }[]
      }
      log_agent_interaction: {
        Args: { p_event_type?: string }
        Returns: undefined
      }
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
      migrate_orphan_carts_to_leads: { Args: never; Returns: Json }
      missed_call_pass: { Args: { p_call_id: string }; Returns: boolean }
      missed_call_rotate_offers: { Args: never; Returns: number }
      normalize_phone_uk: { Args: { p: string }; Returns: string }
      normalize_uk_phone: { Args: { raw_phone: string }; Returns: string }
      offline_campaign_monthly_stats: {
        Args: { _from: string; _prefixes: string[]; _to: string }
        Returns: {
          month: string
          organic_revenue: number
          organic_sales: number
          revenue: number
          sales: number
        }[]
      }
      open_pool_bulk_assign_to_agent: {
        Args: {
          _count: number
          _target_admin_id: string
          _window_minutes?: number
        }
        Returns: {
          assigned_count: number
          lead_ids: string[]
        }[]
      }
      open_pool_check_unpaid_links: { Args: never; Returns: number }
      open_pool_drain_morning_queue: {
        Args: { _max_leads?: number }
        Returns: {
          assigned_pool: number
          assigned_rr: number
          skipped: number
        }[]
      }
      open_pool_flag_missed_callbacks: { Args: never; Returns: number }
      open_pool_get_next: {
        Args: { _agent: string }
        Returns: {
          lead_id: string
        }[]
      }
      open_pool_log_outcome: {
        Args: {
          _agent: string
          _lead_id: string
          _next_action_at?: string
          _outcome: string
          _reason?: string
        }
        Returns: undefined
      }
      open_pool_manager_alerts_sweep: { Args: never; Returns: number }
      open_pool_mark_paid: { Args: { _lead_id: string }; Returns: undefined }
      open_pool_next_working_day_9am: { Args: never; Returns: string }
      open_pool_promote_overnight: { Args: never; Returns: number }
      open_pool_reap_expired_locks: { Args: never; Returns: number }
      open_pool_recycle_stale: {
        Args: never
        Returns: {
          flagged_stale: number
          promoted_to_rr: number
          returned_to_pool: number
        }[]
      }
      open_pool_release_drip_now: {
        Args: { _lead_ids?: string[] }
        Returns: number
      }
      open_pool_schedule_drip: {
        Args: { _interval_seconds?: number; _lead_ids: string[] }
        Returns: number
      }
      orr_accept_offer: { Args: { _lead: string }; Returns: boolean }
      orr_add_business_days: {
        Args: { _from_date: string; _n: number }
        Returns: string
      }
      orr_agent_has_open_callback: {
        Args: { _agent_id: string }
        Returns: boolean
      }
      orr_agent_is_orr_mode: { Args: { _agent: string }; Returns: boolean }
      orr_agent_next_work: {
        Args: { _agent_id: string }
        Returns: {
          due_at: string
          kind: string
          lead_id: string
          tier: number
        }[]
      }
      orr_agent_on_active_call: {
        Args: { _agent_id: string }
        Returns: boolean
      }
      orr_agent_uncalled_hold: { Args: { _agent_id: string }; Returns: string }
      orr_apply_contact_outcome: {
        Args: {
          _agent_id: string
          _callback_at?: string
          _lead_id: string
          _notes?: string
          _outcome: string
          _reason?: string
        }
        Returns: Json
      }
      orr_assign_attempt_one: {
        Args: { _agent_id: string; _kind: string; _lead_id: string }
        Returns: Json
      }
      orr_assign_retry: {
        Args: { _agent_id: string; _lead_id: string; _queue: string }
        Returns: Json
      }
      orr_call_ended: {
        Args: {
          _call_log_id: string
          _callback_at?: string
          _notes?: string
          _outcome: string
          _reason?: string
        }
        Returns: Json
      }
      orr_call_started: {
        Args: { _agent_id: string; _agent_name?: string; _lead_id: string }
        Returns: Json
      }
      orr_can_dial_customer: {
        Args: { _agent_id: string; _lead_id: string; _phone_normalized: string }
        Returns: {
          ok: boolean
          reason: string
          state: string
        }[]
      }
      orr_claim_pool_lead: {
        Args: { _agent_id: string; _lead_id: string }
        Returns: Json
      }
      orr_classify_intake: {
        Args: { _arrived_at: string }
        Returns: {
          eligible_at: string
          intake_class: string
        }[]
      }
      orr_compute_next_release: {
        Args: { _last_attempt_at: string; _next_attempt_number: number }
        Returns: string
      }
      orr_current_retry_queue: {
        Args: never
        Returns: {
          can_assign: boolean
          closes_at: string
          final_assign_at: string
          is_open: boolean
          opens_at: string
          queue_name: string
        }[]
      }
      orr_customer_for_lead: { Args: { _lead_id: string }; Returns: string }
      orr_expire_stale_customer_locks: { Args: never; Returns: number }
      orr_is_agent_available: { Args: { _agent_id: string }; Returns: boolean }
      orr_is_business_day: { Args: { _d: string }; Returns: boolean }
      orr_is_business_now: { Args: never; Returns: boolean }
      orr_is_team_blue_source: { Args: { _source: string }; Returns: boolean }
      orr_list_pool_leads: {
        Args: { _pool_state?: string }
        Returns: {
          attempt_number: number
          first_name: string
          last_name: string
          lead_id: string
          lead_source: string
          missed_at: string
          missed_by: string
          phone: string
          pool_since: string
          pool_state: string
        }[]
      }
      orr_log_callback_no_answer: {
        Args: {
          _agent_id: string
          _follow_up_at?: string
          _lead_id: string
          _notes?: string
        }
        Returns: Json
      }
      orr_manager_override: {
        Args: {
          _allow_extra_call?: boolean
          _lead_id: string
          _manager_id: string
          _new_value?: Json
          _override_type: string
          _reason: string
        }
        Returns: Json
      }
      orr_mark_call_ended: {
        Args: {
          _agent_id: string
          _lead_id: string
          _next_eligible_at?: string
          _outcome: string
          _phone_normalized: string
        }
        Returns: boolean
      }
      orr_mark_call_started: {
        Args: { _agent_id: string; _lead_id: string; _phone_normalized: string }
        Returns: boolean
      }
      orr_mark_dialing: {
        Args: { _agent_id: string; _lead_id: string; _phone_normalized: string }
        Returns: boolean
      }
      orr_next_business_open: { Args: { _ts: string }; Returns: string }
      orr_next_retry_lead: { Args: never; Returns: string }
      orr_offer_lead_to_next: { Args: { _lead: string }; Returns: string }
      orr_pass_offer: { Args: { _lead: string }; Returns: string }
      orr_pick_available_blue_agents: {
        Args: never
        Returns: {
          agent_id: string
        }[]
      }
      orr_pick_weekend_agent: { Args: { _d: string }; Returns: string }
      orr_queue_dashboard_snapshot: { Args: never; Returns: Json }
      orr_reassign_callback: {
        Args: {
          _actor_id: string
          _lead_id: string
          _new_agent_id: string
          _reason?: string
        }
        Returns: Json
      }
      orr_release_customer_lock: {
        Args: { _agent_id: string; _phone_normalized: string; _reason: string }
        Returns: boolean
      }
      orr_release_retry_hold: {
        Args: { _lead_id: string; _reason: string }
        Returns: boolean
      }
      orr_rollover_uncalled_queues: { Args: never; Returns: Json }
      orr_sweep_attempt_one_expiries: { Args: never; Returns: Json }
      orr_sweep_expired_offers: { Args: never; Returns: number }
      orr_sweep_retry_expiries: { Args: never; Returns: Json }
      orr_try_acquire_customer_lock: {
        Args: {
          _agent_id: string
          _lead_id: string
          _phone_normalized: string
          _source?: string
        }
        Returns: {
          customer_id: string
          ok: boolean
          reason: string
          state: string
        }[]
      }
      orr_weekend_roster: { Args: { _d: string }; Returns: string[] }
      pick_agent_for_distribution:
        | { Args: { p_team_id: string }; Returns: string }
        | { Args: { p_source?: string; p_team_id: string }; Returns: string }
      pick_agent_for_distribution_legacy: {
        Args: { p_source?: string; p_team_id: string }
        Returns: string
      }
      postcode_area_monthly_claims: {
        Args: { _from: string; _to: string }
        Returns: {
          area: string
          claim_cost: number
          claims: number
          month: string
        }[]
      }
      postcode_area_monthly_sales: {
        Args: { _from: string; _to: string }
        Returns: {
          area: string
          month: string
          organic_revenue: number
          organic_sales: number
          revenue: number
          sales: number
        }[]
      }
      postcode_district_stats: {
        Args: { _area: string; _from: string; _to: string }
        Returns: {
          claim_cost: number
          claims: number
          district: string
          revenue: number
          sales: number
        }[]
      }
      preview_agent_offboarding_backup: {
        Args: {
          _also_deactivate?: boolean
          _reset_to_new?: boolean
          _source_admin_user_id: string
          _target_admin_user_id: string
        }
        Returns: Json
      }
      process_scheduled_sms: { Args: never; Returns: number }
      publish_pricing_version: {
        Args: { _version_id: string }
        Returns: undefined
      }
      recompute_sales_lead_call_count: {
        Args: { p_lead_id: string }
        Returns: undefined
      }
      recontact_agent_stats: {
        Args: never
        Returns: {
          admin_user_id: string
          last_taken_at: string
          taken_today: number
          taken_total: number
        }[]
      }
      recover_leads_from_step2: {
        Args: { p_lookback_hours?: number }
        Returns: Json
      }
      recover_orphaned_leads: { Args: never; Returns: Json }
      recover_single_lead: {
        Args: { p_agent_id?: string; p_cart_id: string }
        Returns: Json
      }
      release_stale_recontact_leads: {
        Args: { _silence_days?: number }
        Returns: {
          released_count: number
        }[]
      }
      renewal_pool_get_next: {
        Args: { _agent: string }
        Returns: {
          policy_id: string
        }[]
      }
      renewal_pool_release_expired: { Args: never; Returns: number }
      renewal_pool_stamp_ownership: {
        Args: { _agent: string; _policy: string }
        Returns: undefined
      }
      reset_agent_caps_daily: { Args: never; Returns: undefined }
      reset_daily_caps: { Args: never; Returns: undefined }
      restore_agent_offboarding_backup: {
        Args: { _event_id: string; _restore_to_admin_user_id?: string }
        Returns: Json
      }
      restore_customer: { Args: { customer_uuid: string }; Returns: undefined }
      restore_lead_to_snapshot: {
        Args: { p_changelog_id: string; p_restored_by?: string }
        Returns: Json
      }
      restore_quote_data: {
        Args: { _email: string; _quote_id: string }
        Returns: {
          customer_email: string
          expires_at: string
          plan_data: Json
          quote_id: string
          vehicle_data: Json
        }[]
      }
      revert_pricing_to_code_defaults: { Args: never; Returns: undefined }
      rolling_rr_distribute: {
        Args: {
          _batch_cap?: number
          _max_total?: number
          _window_minutes?: number
        }
        Returns: {
          agents_used: number
          assigned_count: number
        }[]
      }
      rolling_rr_reclaim_overdue: {
        Args: never
        Returns: {
          lead_ids: string[]
          reclaimed_count: number
        }[]
      }
      set_user_offline: { Args: never; Returns: undefined }
      shark_tank_agent_stats: {
        Args: never
        Returns: {
          admin_user_id: string
          claimed_today: number
          claimed_total: number
          last_taken_at: string
          taken_today: number
          taken_total: number
        }[]
      }
      shark_tank_is_active: { Args: { _team_id: string }; Returns: boolean }
      shark_tank_is_live: { Args: never; Returns: boolean }
      shark_tank_is_management: { Args: never; Returns: boolean }
      shark_tank_log_outcome: {
        Args: {
          _call_reference?: string
          _lead_id: string
          _next_action?: string
          _outcome: string
        }
        Returns: string
      }
      shark_tank_reap: { Args: never; Returns: number }
      shark_tank_take_next: {
        Args: { _team_id: string }
        Returns: {
          held_until: string
          lead_id: string
        }[]
      }
      simulate_lead_routing: { Args: { p_source: string }; Returns: Json }
      snapshot_agent_daily_stats: { Args: { p_date: string }; Returns: number }
      snapshot_daily_lead_counts: {
        Args: { p_date: string; p_tz?: string }
        Returns: undefined
      }
      soft_delete_customer: {
        Args: { admin_uuid: string; customer_uuid: string }
        Returns: undefined
      }
      sweep_open_round_robin: { Args: never; Returns: Json }
      sync_leads_to_marketing_audience: { Args: never; Returns: Json }
      undo_bulk_reassignment: {
        Args: {
          p_bucket_start: string
          p_changed_by: string
          p_new_assigned_to: string
          p_old_assigned_to: string
        }
        Returns: Json
      }
      update_campaign_analytics: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      update_lead_status: {
        Args: {
          p_force?: boolean
          p_is_abandoned_cart?: boolean
          p_lead_id: string
          p_status: string
        }
        Returns: Json
      }
      update_user_presence: {
        Args: { p_current_tab?: string; p_status?: string }
        Returns: string
      }
      verify_warranty_selection: { Args: { audit_id: string }; Returns: Json }
    }
    Enums: {
      action_scope: "none" | "own" | "team" | "department" | "global"
      agent_feedback_status: "new" | "reviewed" | "resolved"
      agent_feedback_type:
        | "technical_issue"
        | "customer_feedback"
        | "lead_timestamp"
      complaint_status:
        | "new"
        | "acknowledged"
        | "in_progress"
        | "resolved"
        | "closed"
      finance_application_status:
        | "draft"
        | "submitted"
        | "pre_screen"
        | "underwriting"
        | "referred"
        | "approved"
        | "docs_pending"
        | "payout_pending"
        | "paid"
        | "completed"
        | "declined"
        | "withdrawn"
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
        | "bing_ad"
      lead_status:
        | "new"
        | "contacted"
        | "follow_up"
        | "quote_sent"
        | "negotiating"
        | "upsell"
        | "upgraded"
        | "converted"
        | "lost"
        | "fake_lead"
        | "urgent_callback"
        | "archived"
        | "not_interested"
        | "dormant"
        | "no_answer"
        | "left_voicemail"
        | "wrong_number"
        | "callback_booked"
        | "bought_elsewhere"
        | "vehicle_sold"
        | "do_not_contact"
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
      shark_tank_status:
        | "queued"
        | "held"
        | "retry_hold"
        | "chase_hold"
        | "claimed"
        | "expired"
      timesheet_entry_type:
        | "worked"
        | "sick"
        | "holiday"
        | "unpaid_leave"
        | "training"
        | "wfh"
      trade_warranty_signup_status: "new" | "contacted" | "qualified" | "closed"
      user_role:
        | "admin"
        | "customer"
        | "member"
        | "viewer"
        | "guest"
        | "blog_writer"
        | "sales"
        | "sales_lead"
        | "dev_tester"
        | "super_admin"
        | "accounts_manager"
        | "lead_gen"
        | "accounts"
        | "claims_agent"
        | "claims_manager"
        | "performance_manager"
        | "sales_manager"
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
      agent_feedback_status: ["new", "reviewed", "resolved"],
      agent_feedback_type: [
        "technical_issue",
        "customer_feedback",
        "lead_timestamp",
      ],
      complaint_status: [
        "new",
        "acknowledged",
        "in_progress",
        "resolved",
        "closed",
      ],
      finance_application_status: [
        "draft",
        "submitted",
        "pre_screen",
        "underwriting",
        "referred",
        "approved",
        "docs_pending",
        "payout_pending",
        "paid",
        "completed",
        "declined",
        "withdrawn",
      ],
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
        "bing_ad",
      ],
      lead_status: [
        "new",
        "contacted",
        "follow_up",
        "quote_sent",
        "negotiating",
        "upsell",
        "upgraded",
        "converted",
        "lost",
        "fake_lead",
        "urgent_callback",
        "archived",
        "not_interested",
        "dormant",
        "no_answer",
        "left_voicemail",
        "wrong_number",
        "callback_booked",
        "bought_elsewhere",
        "vehicle_sold",
        "do_not_contact",
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
      shark_tank_status: [
        "queued",
        "held",
        "retry_hold",
        "chase_hold",
        "claimed",
        "expired",
      ],
      timesheet_entry_type: [
        "worked",
        "sick",
        "holiday",
        "unpaid_leave",
        "training",
        "wfh",
      ],
      trade_warranty_signup_status: ["new", "contacted", "qualified", "closed"],
      user_role: [
        "admin",
        "customer",
        "member",
        "viewer",
        "guest",
        "blog_writer",
        "sales",
        "sales_lead",
        "dev_tester",
        "super_admin",
        "accounts_manager",
        "lead_gen",
        "accounts",
        "claims_agent",
        "claims_manager",
        "performance_manager",
        "sales_manager",
      ],
    },
  },
} as const
