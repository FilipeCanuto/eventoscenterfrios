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
      email_templates: {
        Row: {
          body: string
          enabled: boolean
          event_id: string
          id: string
          subject: string
          template_type: Database["public"]["Enums"]["email_template_type"]
        }
        Insert: {
          body?: string
          enabled?: boolean
          event_id: string
          id?: string
          subject?: string
          template_type: Database["public"]["Enums"]["email_template_type"]
        }
        Update: {
          body?: string
          enabled?: boolean
          event_id?: string
          id?: string
          subject?: string
          template_type?: Database["public"]["Enums"]["email_template_type"]
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_page_views: {
        Row: {
          converted_registration_id: string | null
          created_at: string
          device_type: string | null
          event_id: string
          form_abandoned_at: string | null
          form_started_at: string | null
          id: string
          landing_url: string | null
          partial_email: string | null
          partial_name: string | null
          partial_whatsapp: string | null
          referrer: string | null
          session_id: string
          updated_at: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string
        }
        Insert: {
          converted_registration_id?: string | null
          created_at?: string
          device_type?: string | null
          event_id: string
          form_abandoned_at?: string | null
          form_started_at?: string | null
          id?: string
          landing_url?: string | null
          partial_email?: string | null
          partial_name?: string | null
          partial_whatsapp?: string | null
          referrer?: string | null
          session_id: string
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id: string
        }
        Update: {
          converted_registration_id?: string | null
          created_at?: string
          device_type?: string | null
          event_id?: string
          form_abandoned_at?: string | null
          form_started_at?: string | null
          id?: string
          landing_url?: string | null
          partial_email?: string | null
          partial_name?: string | null
          partial_whatsapp?: string | null
          referrer?: string | null
          session_id?: string
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_page_views_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          background_image_url: string | null
          capacity: number | null
          color_mode: string | null
          created_at: string
          description: string | null
          event_date: string | null
          event_end_date: string | null
          event_type: string | null
          id: string
          location_type: string | null
          location_value: string | null
          logo_url: string | null
          name: string
          primary_color: string | null
          registration_deadline: string | null
          registration_limit: number | null
          requires_approval: boolean | null
          slug: string
          status: Database["public"]["Enums"]["event_status"]
          template: string | null
          ticket_price: number | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          background_image_url?: string | null
          capacity?: number | null
          color_mode?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          event_end_date?: string | null
          event_type?: string | null
          id?: string
          location_type?: string | null
          location_value?: string | null
          logo_url?: string | null
          name: string
          primary_color?: string | null
          registration_deadline?: string | null
          registration_limit?: number | null
          requires_approval?: boolean | null
          slug: string
          status?: Database["public"]["Enums"]["event_status"]
          template?: string | null
          ticket_price?: number | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          background_image_url?: string | null
          capacity?: number | null
          color_mode?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          event_end_date?: string | null
          event_type?: string | null
          id?: string
          location_type?: string | null
          location_value?: string | null
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          registration_deadline?: string | null
          registration_limit?: number | null
          requires_approval?: boolean | null
          slug?: string
          status?: Database["public"]["Enums"]["event_status"]
          template?: string | null
          ticket_price?: number | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      form_fields: {
        Row: {
          event_id: string
          field_type: string
          id: string
          label: string
          placeholder: string | null
          position: number
          required: boolean
        }
        Insert: {
          event_id: string
          field_type?: string
          id?: string
          label: string
          placeholder?: string | null
          position?: number
          required?: boolean
        }
        Update: {
          event_id?: string
          field_type?: string
          id?: string
          label?: string
          placeholder?: string | null
          position?: number
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          email: string
          event_id: string | null
          id: string
          metadata: Json | null
          name: string | null
          phone: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          event_id?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          phone?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          event_id?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          phone?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          company_description: string | null
          company_slug: string | null
          created_at: string
          full_name: string | null
          id: string
          social_links: Json | null
          updated_at: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          company_description?: string | null
          company_slug?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          social_links?: Json | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          company_description?: string | null
          company_slug?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          social_links?: Json | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      registrations: {
        Row: {
          created_at: string
          data: Json
          event_id: string
          id: string
          lead_email: string | null
          lead_name: string | null
          lead_whatsapp: string | null
          status: Database["public"]["Enums"]["registration_status"]
          tracking: Json
        }
        Insert: {
          created_at?: string
          data?: Json
          event_id: string
          id?: string
          lead_email?: string | null
          lead_name?: string | null
          lead_whatsapp?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          tracking?: Json
        }
        Update: {
          created_at?: string
          data?: Json
          event_id?: string
          id?: string
          lead_email?: string | null
          lead_name?: string | null
          lead_whatsapp?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          tracking?: Json
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_company_profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          company_description: string | null
          company_slug: string | null
          full_name: string | null
          id: string | null
          social_links: Json | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          company_description?: string | null
          company_slug?: string | null
          full_name?: string | null
          id?: string | null
          social_links?: Json | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          company_description?: string | null
          company_slug?: string | null
          full_name?: string | null
          id?: string | null
          social_links?: Json | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_registration_count: { Args: { p_event_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      register_for_event:
        | { Args: { p_data: Json; p_event_id: string }; Returns: string }
        | {
            Args: { p_data: Json; p_event_id: string; p_tracking?: Json }
            Returns: string
          }
      track_page_view: {
        Args: {
          p_data?: Json
          p_event_id: string
          p_session_id: string
          p_visitor_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
      email_template_type: "confirmation" | "reminder" | "followup"
      event_status: "draft" | "live" | "past"
      registration_status: "registered" | "checked_in" | "cancelled"
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
      app_role: ["admin", "editor", "viewer"],
      email_template_type: ["confirmation", "reminder", "followup"],
      event_status: ["draft", "live", "past"],
      registration_status: ["registered", "checked_in", "cancelled"],
    },
  },
} as const
