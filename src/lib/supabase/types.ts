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
      admins: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admins_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admins_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admins_with_users"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          address: string | null
          booking_date: string
          booking_time: string
          created_at: string
          hairdresser_id: string
          id: string
          location_type: string
          number_of_cuts: number
          payment_method: string | null
          service_id: string
          status: string | null
          stripe_payment_intent_id: string | null
          total_price: number
          user_id: string
        }
        Insert: {
          address?: string | null
          booking_date: string
          booking_time: string
          created_at?: string
          hairdresser_id: string
          id?: string
          location_type: string
          number_of_cuts?: number
          payment_method?: string | null
          service_id: string
          status?: string | null
          stripe_payment_intent_id?: string | null
          total_price: number
          user_id: string
        }
        Update: {
          address?: string | null
          booking_date?: string
          booking_time?: string
          created_at?: string
          hairdresser_id?: string
          id?: string
          location_type?: string
          number_of_cuts?: number
          payment_method?: string | null
          service_id?: string
          status?: string | null
          stripe_payment_intent_id?: string | null
          total_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_hairdresser_id_fkey"
            columns: ["hairdresser_id"]
            isOneToOne: false
            referencedRelation: "hairdressers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "hairdresser_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_banned_words: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          word: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          word: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          word?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string | null
          hairdresser_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          hairdresser_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          hairdresser_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_hairdresser_id_fkey"
            columns: ["hairdresser_id"]
            isOneToOne: false
            referencedRelation: "hairdressers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      fady_pro_device_tokens: {
        Row: {
          created_at: string | null
          device_token: string
          id: string
          platform: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_token: string
          id?: string
          platform?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_token?: string
          id?: string
          platform?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fady_pro_device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hairdresser_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          hairdresser_id: string
          id: string
          is_available: boolean | null
          slot_order: number
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          hairdresser_id: string
          id?: string
          is_available?: boolean | null
          slot_order?: number
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          hairdresser_id?: string
          id?: string
          is_available?: boolean | null
          slot_order?: number
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "hairdresser_availability_hairdresser_id_fkey"
            columns: ["hairdresser_id"]
            isOneToOne: false
            referencedRelation: "hairdressers"
            referencedColumns: ["id"]
          },
        ]
      }
      hairdresser_diploma_verification: {
        Row: {
          created_at: string | null
          diploma_file_url: string | null
          hairdresser_id: string
          has_accepted_attestation: boolean
          id: string
          rejection_reason: string | null
          submitted_at: string | null
          updated_at: string | null
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          diploma_file_url?: string | null
          hairdresser_id: string
          has_accepted_attestation?: boolean
          id?: string
          rejection_reason?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          diploma_file_url?: string | null
          hairdresser_id?: string
          has_accepted_attestation?: boolean
          id?: string
          rejection_reason?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hairdresser_diploma_verification_hairdresser_id_fkey"
            columns: ["hairdresser_id"]
            isOneToOne: false
            referencedRelation: "hairdressers"
            referencedColumns: ["id"]
          },
        ]
      }
      hairdresser_gallery: {
        Row: {
          caption: string | null
          created_at: string | null
          display_order: number | null
          featured: boolean
          hairdresser_id: string
          id: string
          image_url: string
          media_type: string | null
          updated_at: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          featured?: boolean
          hairdresser_id: string
          id?: string
          image_url: string
          media_type?: string | null
          updated_at?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          featured?: boolean
          hairdresser_id?: string
          id?: string
          image_url?: string
          media_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hairdresser_gallery_hairdresser_id_fkey"
            columns: ["hairdresser_id"]
            isOneToOne: false
            referencedRelation: "hairdressers"
            referencedColumns: ["id"]
          },
        ]
      }
      hairdresser_schedule_exceptions: {
        Row: {
          created_at: string | null
          end_time: string | null
          exception_date: string
          exception_type: string
          hairdresser_id: string
          id: string
          slot_order: number | null
          start_time: string | null
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          exception_date: string
          exception_type: string
          hairdresser_id: string
          id?: string
          slot_order?: number | null
          start_time?: string | null
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          exception_date?: string
          exception_type?: string
          hairdresser_id?: string
          id?: string
          slot_order?: number | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hairdresser_schedule_exceptions_hairdresser_id_fkey"
            columns: ["hairdresser_id"]
            isOneToOne: false
            referencedRelation: "hairdressers"
            referencedColumns: ["id"]
          },
        ]
      }
      hairdresser_services: {
        Row: {
          created_at: string
          duration_minutes: number
          hairdresser_id: string
          id: string
          price: number | null
          service_name: string
          service_type: string
        }
        Insert: {
          created_at?: string
          duration_minutes: number
          hairdresser_id: string
          id?: string
          price?: number | null
          service_name: string
          service_type?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          hairdresser_id?: string
          id?: string
          price?: number | null
          service_name?: string
          service_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "hairdresser_services_hairdresser_id_fkey"
            columns: ["hairdresser_id"]
            isOneToOne: false
            referencedRelation: "hairdressers"
            referencedColumns: ["id"]
          },
        ]
      }
      hairdresser_stripe_accounts: {
        Row: {
          charges_enabled: boolean | null
          created_at: string
          hairdresser_id: string
          id: string
          onboarding_link: string | null
          onboarding_status: string
          payouts_enabled: boolean | null
          stripe_account_id: string
          updated_at: string
        }
        Insert: {
          charges_enabled?: boolean | null
          created_at?: string
          hairdresser_id: string
          id?: string
          onboarding_link?: string | null
          onboarding_status?: string
          payouts_enabled?: boolean | null
          stripe_account_id: string
          updated_at?: string
        }
        Update: {
          charges_enabled?: boolean | null
          created_at?: string
          hairdresser_id?: string
          id?: string
          onboarding_link?: string | null
          onboarding_status?: string
          payouts_enabled?: boolean | null
          stripe_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hairdresser_stripe_accounts_hairdresser_id_fkey"
            columns: ["hairdresser_id"]
            isOneToOne: true
            referencedRelation: "hairdressers"
            referencedColumns: ["id"]
          },
        ]
      }
      hairdresser_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          hairdresser_id: string
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          subscription_type: string
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          hairdresser_id: string
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_type: string
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          hairdresser_id?: string
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hairdresser_subscriptions_hairdresser_id_fkey"
            columns: ["hairdresser_id"]
            isOneToOne: false
            referencedRelation: "hairdressers"
            referencedColumns: ["id"]
          },
        ]
      }
      hairdressers: {
        Row: {
          accepts_home_service: boolean | null
          accepts_salon_service: boolean
          address: string
          available_now: boolean
          available_now_end_at: string | null
          avatar_url: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          minimum_interval_time: number
          name: string
          phone: string | null
          rating: number | null
          statut: string | null
          total_reviews: number | null
          user_id: string | null
        }
        Insert: {
          accepts_home_service?: boolean | null
          accepts_salon_service?: boolean
          address: string
          available_now?: boolean
          available_now_end_at?: string | null
          avatar_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          minimum_interval_time?: number
          name: string
          phone?: string | null
          rating?: number | null
          statut?: string | null
          total_reviews?: number | null
          user_id?: string | null
        }
        Update: {
          accepts_home_service?: boolean | null
          accepts_salon_service?: boolean
          address?: string
          available_now?: boolean
          available_now_end_at?: string | null
          avatar_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          minimum_interval_time?: number
          name?: string
          phone?: string | null
          rating?: number | null
          statut?: string | null
          total_reviews?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          is_read: boolean | null
          receiver_id: string | null
          sender_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          receiver_id?: string | null
          sender_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          receiver_id?: string | null
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
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          booking_confirmations: boolean
          booking_reminders: boolean
          created_at: string | null
          id: string
          nearby_hairdressers: boolean
          new_messages: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          booking_confirmations?: boolean
          booking_reminders?: boolean
          created_at?: string | null
          id?: string
          nearby_hairdressers?: boolean
          new_messages?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          booking_confirmations?: boolean
          booking_reminders?: boolean
          created_at?: string | null
          id?: string
          nearby_hairdressers?: boolean
          new_messages?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      preferences: {
        Row: {
          accept_cash_payment: boolean
          created_at: string | null
          favorite_transport_mode: string | null
          hairdresser_id: string
          id: string
          minimum_travel_fee: number | null
          travel_hourly_rate: number | null
          updated_at: string | null
        }
        Insert: {
          accept_cash_payment?: boolean
          created_at?: string | null
          favorite_transport_mode?: string | null
          hairdresser_id: string
          id?: string
          minimum_travel_fee?: number | null
          travel_hourly_rate?: number | null
          updated_at?: string | null
        }
        Update: {
          accept_cash_payment?: boolean
          created_at?: string | null
          favorite_transport_mode?: string | null
          hairdresser_id?: string
          id?: string
          minimum_travel_fee?: number | null
          travel_hourly_rate?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preferences_hairdresser_id_fkey"
            columns: ["hairdresser_id"]
            isOneToOne: true
            referencedRelation: "hairdressers"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_views: {
        Row: {
          client_id: string
          hairdresser_id: string
          id: string
          viewed_at: string | null
          year_month: string
        }
        Insert: {
          client_id: string
          hairdresser_id: string
          id?: string
          viewed_at?: string | null
          year_month: string
        }
        Update: {
          client_id?: string
          hairdresser_id?: string
          id?: string
          viewed_at?: string | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_hairdresser_id_fkey"
            columns: ["hairdresser_id"]
            isOneToOne: false
            referencedRelation: "hairdressers"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          admin_id: string | null
          amount: number
          booking_id: string
          commission_handling: string
          created_at: string
          hairdresser_amount_reversed: number
          id: string
          payment_intent_id: string
          platform_amount_kept: number
          reason: string | null
          refund_type: string
          status: string
          stripe_refund_id: string | null
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          booking_id: string
          commission_handling: string
          created_at?: string
          hairdresser_amount_reversed?: number
          id?: string
          payment_intent_id: string
          platform_amount_kept?: number
          reason?: string | null
          refund_type: string
          status?: string
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          booking_id?: string
          commission_handling?: string
          created_at?: string
          hairdresser_amount_reversed?: number
          id?: string
          payment_intent_id?: string
          platform_amount_kept?: number
          reason?: string | null
          refund_type?: string
          status?: string
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins_with_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          hairdresser_id: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          hairdresser_id: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          hairdresser_id?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_hairdresser_id_fkey"
            columns: ["hairdresser_id"]
            isOneToOne: false
            referencedRelation: "hairdressers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_payments: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          currency: string | null
          hairdresser_id: string
          id: string
          payment_type: string
          status: string
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string
          currency?: string | null
          hairdresser_id: string
          id?: string
          payment_type: string
          status?: string
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          currency?: string | null
          hairdresser_id?: string
          id?: string
          payment_type?: string
          status?: string
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payments_hairdresser_id_fkey"
            columns: ["hairdresser_id"]
            isOneToOne: false
            referencedRelation: "hairdressers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_fees: {
        Row: {
          commission_percentage: number
          created_at: string
          id: string
          subscription_type: string
          updated_at: string
        }
        Insert: {
          commission_percentage: number
          created_at?: string
          id?: string
          subscription_type: string
          updated_at?: string
        }
        Update: {
          commission_percentage?: number
          created_at?: string
          id?: string
          subscription_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_response: string | null
          booking_id: string
          category: string
          created_at: string | null
          email: string
          id: string
          message: string
          phone: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          booking_id: string
          category: string
          created_at?: string | null
          email: string
          id?: string
          message: string
          phone: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_response?: string | null
          booking_id?: string
          category?: string
          created_at?: string | null
          email?: string
          id?: string
          message?: string
          phone?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_device_tokens: {
        Row: {
          created_at: string | null
          device_token: string
          id: string
          platform: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_token: string
          id?: string
          platform?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_token?: string
          id?: string
          platform?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorites: {
        Row: {
          created_at: string
          hairdresser_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hairdresser_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hairdresser_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_hairdresser_id_fkey"
            columns: ["hairdresser_id"]
            isOneToOne: false
            referencedRelation: "hairdressers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          email: string
          email_confirmed: boolean | null
          full_name: string | null
          gender: string | null
          id: string
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          email: string
          email_confirmed?: boolean | null
          full_name?: string | null
          gender?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string
          email_confirmed?: boolean | null
          full_name?: string | null
          gender?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      admins_with_users: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_by_email: string | null
          email: string | null
          full_name: string | null
          id: string | null
          role: string | null
          user_created_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admins_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admins_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admins_with_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_hairdresser_rating: {
        Args: { p_hairdresser_id: string }
        Returns: {
          average_rating: number
          total_reviews: number
        }[]
      }
      cron_update_past_bookings: { Args: Record<PropertyKey, never>; Returns: undefined }
      delete_user_account: { Args: Record<PropertyKey, never>; Returns: undefined }
      get_admin_info: {
        Args: { user_uuid?: string }
        Returns: {
          created_at: string
          created_by: string
          id: string
          role: string
          user_id: string
        }[]
      }
      get_current_booking_status: {
        Args: { booking_id_param: string }
        Returns: string
      }
      get_reviews_with_users: {
        Args: { p_hairdresser_id: string }
        Returns: {
          booking_id: string
          comment: string
          created_at: string
          hairdresser_id: string
          id: string
          rating: number
          user_id: string
          user_name: string
        }[]
      }
      is_admin: { Args: { user_uuid?: string }; Returns: boolean }
      send_push_notification: {
        Args: {
          p_body: string
          p_data?: Json
          p_title: string
          p_user_id: string
        }
        Returns: undefined
      }
      update_bookings_in_progress_status: { Args: Record<PropertyKey, never>; Returns: undefined }
      update_hairdresser_stats: {
        Args: { p_hairdresser_id: string }
        Returns: undefined
      }
      update_past_bookings: { Args: Record<PropertyKey, never>; Returns: undefined }
      update_past_bookings_manual: { Args: Record<PropertyKey, never>; Returns: undefined }
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
    Enums: {},
  },
} as const
