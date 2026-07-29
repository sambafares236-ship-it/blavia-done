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
      approval_logs: {
        Row: {
          action: string
          business_id: string | null
          id: number
          ip_address: unknown
          new_category: string | null
          previous_category: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_via: string | null
          txn_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          business_id?: string | null
          id?: number
          ip_address?: unknown
          new_category?: string | null
          previous_category?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_via?: string | null
          txn_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          business_id?: string | null
          id?: number
          ip_address?: unknown
          new_category?: string | null
          previous_category?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_via?: string | null
          txn_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      assets: {
        Row: {
          acquired_on: string | null
          business_id: string | null
          category: string | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          acquired_on?: string | null
          business_id?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          acquired_on?: string | null
          business_id?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          business_id: string | null
          details: Json | null
          id: string
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          business_id?: string | null
          details?: Json | null
          id?: string
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          business_id?: string | null
          details?: Json | null
          id?: string
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_sheet: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          business_id: string | null
          created_at: string | null
          current_assets: number | null
          current_liabilities: number | null
          fixed_assets: number | null
          id: string
          is_balanced: boolean | null
          long_term_liabilities: number | null
          owner_equity: number | null
          period_date: string
          report_type: string | null
          retained_earnings: number | null
          total_assets: number | null
          total_equity: number | null
          total_liabilities: number | null
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          business_id?: string | null
          created_at?: string | null
          current_assets?: number | null
          current_liabilities?: number | null
          fixed_assets?: number | null
          id?: string
          is_balanced?: boolean | null
          long_term_liabilities?: number | null
          owner_equity?: number | null
          period_date: string
          report_type?: string | null
          retained_earnings?: number | null
          total_assets?: number | null
          total_equity?: number | null
          total_liabilities?: number | null
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          business_id?: string | null
          created_at?: string | null
          current_assets?: number | null
          current_liabilities?: number | null
          fixed_assets?: number | null
          id?: string
          is_balanced?: boolean | null
          long_term_liabilities?: number | null
          owner_equity?: number | null
          period_date?: string
          report_type?: string | null
          retained_earnings?: number | null
          total_assets?: number | null
          total_equity?: number | null
          total_liabilities?: number | null
        }
        Relationships: []
      }
      balance_snapshots: {
        Row: {
          business_id: string | null
          generated_at: string | null
          generated_by: string | null
          grants_received: number | null
          id: number
          loans_received: number | null
          loans_repaid: number | null
          net_profit: number | null
          pending_count: number | null
          rejected_count: number | null
          snapshot_date: string
          total_expenses: number | null
          total_income: number | null
          total_transactions: number | null
        }
        Insert: {
          business_id?: string | null
          generated_at?: string | null
          generated_by?: string | null
          grants_received?: number | null
          id?: number
          loans_received?: number | null
          loans_repaid?: number | null
          net_profit?: number | null
          pending_count?: number | null
          rejected_count?: number | null
          snapshot_date: string
          total_expenses?: number | null
          total_income?: number | null
          total_transactions?: number | null
        }
        Update: {
          business_id?: string | null
          generated_at?: string | null
          generated_by?: string | null
          grants_received?: number | null
          id?: number
          loans_received?: number | null
          loans_repaid?: number | null
          net_profit?: number | null
          pending_count?: number | null
          rejected_count?: number | null
          snapshot_date?: string
          total_expenses?: number | null
          total_income?: number | null
          total_transactions?: number | null
        }
        Relationships: []
      }
      budgets: {
        Row: {
          actual_amount: number | null
          budget_name: string
          budget_period_end: string
          budget_period_start: string
          budgeted_amount: number
          business_id: string | null
          category: string | null
          created_at: string | null
          created_by: string | null
          id: string
          status: string | null
          updated_at: string | null
          variance_amount: number | null
          variance_percentage: number | null
        }
        Insert: {
          actual_amount?: number | null
          budget_name: string
          budget_period_end: string
          budget_period_start: string
          budgeted_amount: number
          business_id?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          variance_amount?: number | null
          variance_percentage?: number | null
        }
        Update: {
          actual_amount?: number | null
          budget_name?: string
          budget_period_end?: string
          budget_period_start?: string
          budgeted_amount?: number
          business_id?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          variance_amount?: number | null
          variance_percentage?: number | null
        }
        Relationships: []
      }
      businesses: {
        Row: {
          alert_threshold: number | null
          annual_turnover: number | null
          area: string | null
          business_category: string | null
          business_name: string
          cashflow_alert_sent_at: string | null
          city: string | null
          county: string | null
          created_at: string | null
          currency: string | null
          id: string
          logo_url: string | null
          owner_email: string | null
          owner_id: string | null
          postal_code: string | null
          street_address: string | null
          updated_at: string | null
          vat_registered: boolean | null
          welcome_sent_at: string | null
          whatsapp_number: string | null
        }
        Insert: {
          alert_threshold?: number | null
          annual_turnover?: number | null
          area?: string | null
          business_category?: string | null
          business_name: string
          cashflow_alert_sent_at?: string | null
          city?: string | null
          county?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          logo_url?: string | null
          owner_email?: string | null
          owner_id?: string | null
          postal_code?: string | null
          street_address?: string | null
          updated_at?: string | null
          vat_registered?: boolean | null
          welcome_sent_at?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          alert_threshold?: number | null
          annual_turnover?: number | null
          area?: string | null
          business_category?: string | null
          business_name?: string
          cashflow_alert_sent_at?: string | null
          city?: string | null
          county?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          logo_url?: string | null
          owner_email?: string | null
          owner_id?: string | null
          postal_code?: string | null
          street_address?: string | null
          updated_at?: string | null
          vat_registered?: boolean | null
          welcome_sent_at?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      cashflow_forecasts: {
        Row: {
          actual_expenses: number | null
          actual_income: number | null
          actual_net_cashflow: number | null
          alert_message: string | null
          alert_threshold_breach: boolean | null
          business_id: string | null
          confidence_level: number | null
          factors_applied: Json | null
          forecast_date: string
          forecast_horizon: string | null
          generated_at: string | null
          id: string
          model_version: string | null
          predicted_closing_balance: number | null
          predicted_expenses: number | null
          predicted_income: number | null
          predicted_net_cashflow: number | null
          prediction_method: string | null
          variance_percentage: number | null
        }
        Insert: {
          actual_expenses?: number | null
          actual_income?: number | null
          actual_net_cashflow?: number | null
          alert_message?: string | null
          alert_threshold_breach?: boolean | null
          business_id?: string | null
          confidence_level?: number | null
          factors_applied?: Json | null
          forecast_date: string
          forecast_horizon?: string | null
          generated_at?: string | null
          id?: string
          model_version?: string | null
          predicted_closing_balance?: number | null
          predicted_expenses?: number | null
          predicted_income?: number | null
          predicted_net_cashflow?: number | null
          prediction_method?: string | null
          variance_percentage?: number | null
        }
        Update: {
          actual_expenses?: number | null
          actual_income?: number | null
          actual_net_cashflow?: number | null
          alert_message?: string | null
          alert_threshold_breach?: boolean | null
          business_id?: string | null
          confidence_level?: number | null
          factors_applied?: Json | null
          forecast_date?: string
          forecast_horizon?: string | null
          generated_at?: string | null
          id?: string
          model_version?: string | null
          predicted_closing_balance?: number | null
          predicted_expenses?: number | null
          predicted_income?: number | null
          predicted_net_cashflow?: number | null
          prediction_method?: string | null
          variance_percentage?: number | null
        }
        Relationships: []
      }
      cashflow_statement: {
        Row: {
          business_id: string | null
          closing_balance: number | null
          created_at: string | null
          financing_cash_inflow: number | null
          financing_cash_outflow: number | null
          id: string
          investing_cash_inflow: number | null
          investing_cash_outflow: number | null
          net_change_in_cash: number | null
          net_financing_cashflow: number | null
          net_investing_cashflow: number | null
          net_operating_cashflow: number | null
          opening_balance: number | null
          operating_cash_inflow: number | null
          operating_cash_outflow: number | null
          period_end: string
          period_start: string
        }
        Insert: {
          business_id?: string | null
          closing_balance?: number | null
          created_at?: string | null
          financing_cash_inflow?: number | null
          financing_cash_outflow?: number | null
          id?: string
          investing_cash_inflow?: number | null
          investing_cash_outflow?: number | null
          net_change_in_cash?: number | null
          net_financing_cashflow?: number | null
          net_investing_cashflow?: number | null
          net_operating_cashflow?: number | null
          opening_balance?: number | null
          operating_cash_inflow?: number | null
          operating_cash_outflow?: number | null
          period_end: string
          period_start: string
        }
        Update: {
          business_id?: string | null
          closing_balance?: number | null
          created_at?: string | null
          financing_cash_inflow?: number | null
          financing_cash_outflow?: number | null
          id?: string
          investing_cash_inflow?: number | null
          investing_cash_outflow?: number | null
          net_change_in_cash?: number | null
          net_financing_cashflow?: number | null
          net_investing_cashflow?: number | null
          net_operating_cashflow?: number | null
          opening_balance?: number | null
          operating_cash_inflow?: number | null
          operating_cash_outflow?: number | null
          period_end?: string
          period_start?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          business_id: string | null
          created_at: string | null
          description: string | null
          id: number
          is_active: boolean | null
          name: string
          parent_category: string | null
          type: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          parent_category?: string | null
          type: string
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          parent_category?: string | null
          type?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address: string | null
          business_id: string | null
          created_at: string | null
          email: string | null
          id: string
          kra_pin: string | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          business_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          kra_pin?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          business_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          kra_pin?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_widgets: {
        Row: {
          business_id: string | null
          created_at: string | null
          height: number | null
          id: string
          is_visible: boolean | null
          position_x: number | null
          position_y: number | null
          refresh_interval_seconds: number | null
          updated_at: string | null
          user_id: string | null
          widget_config: Json | null
          widget_type: string
          width: number | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          height?: number | null
          id?: string
          is_visible?: boolean | null
          position_x?: number | null
          position_y?: number | null
          refresh_interval_seconds?: number | null
          updated_at?: string | null
          user_id?: string | null
          widget_config?: Json | null
          widget_type: string
          width?: number | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          height?: number | null
          id?: string
          is_visible?: boolean | null
          position_x?: number | null
          position_y?: number | null
          refresh_interval_seconds?: number | null
          updated_at?: string | null
          user_id?: string | null
          widget_config?: Json | null
          widget_type?: string
          width?: number | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          allowances: Json | null
          bank_account: string | null
          bank_name: string | null
          basic_salary: number | null
          business_id: string | null
          created_at: string | null
          deductions: Json | null
          department: string | null
          email: string | null
          full_name: string
          hire_date: string | null
          id: string
          id_number: string | null
          kra_pin: string | null
          mpesa_number: string | null
          nhif_number: string | null
          nssf_number: string | null
          payment_method: string | null
          phone: string | null
          position: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          allowances?: Json | null
          bank_account?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          business_id?: string | null
          created_at?: string | null
          deductions?: Json | null
          department?: string | null
          email?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          id_number?: string | null
          kra_pin?: string | null
          mpesa_number?: string | null
          nhif_number?: string | null
          nssf_number?: string | null
          payment_method?: string | null
          phone?: string | null
          position?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          allowances?: Json | null
          bank_account?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          business_id?: string | null
          created_at?: string | null
          deductions?: Json | null
          department?: string | null
          email?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          id_number?: string | null
          kra_pin?: string | null
          mpesa_number?: string | null
          nhif_number?: string | null
          nssf_number?: string | null
          payment_method?: string | null
          phone?: string | null
          position?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      etims_configs: {
        Row: {
          branch_id: string | null
          business_id: string | null
          client_id: string | null
          client_secret: string | null
          cmc_key: string | null
          created_at: string | null
          device_serial: string | null
          environment: string | null
          error_message: string | null
          id: string
          is_active: boolean | null
          kra_pin: string
          last_initialized_at: string | null
          mode: string
          status: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          business_id?: string | null
          client_id?: string | null
          client_secret?: string | null
          cmc_key?: string | null
          created_at?: string | null
          device_serial?: string | null
          environment?: string | null
          error_message?: string | null
          id?: string
          is_active?: boolean | null
          kra_pin: string
          last_initialized_at?: string | null
          mode?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          business_id?: string | null
          client_id?: string | null
          client_secret?: string | null
          cmc_key?: string | null
          created_at?: string | null
          device_serial?: string | null
          environment?: string | null
          error_message?: string | null
          id?: string
          is_active?: boolean | null
          kra_pin?: string
          last_initialized_at?: string | null
          mode?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      etims_invoices: {
        Row: {
          business_id: string | null
          created_at: string | null
          cuin: string | null
          customer_name: string | null
          customer_pin: string | null
          etims_receipt_no: string | null
          id: string
          invoice_id: string | null
          invoice_number: string
          qr_code: string | null
          raw_request: Json | null
          raw_response: Json | null
          status: string | null
          submitted_at: string | null
          total_amount: number | null
          vat_amount: number | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          cuin?: string | null
          customer_name?: string | null
          customer_pin?: string | null
          etims_receipt_no?: string | null
          id?: string
          invoice_id?: string | null
          invoice_number: string
          qr_code?: string | null
          raw_request?: Json | null
          raw_response?: Json | null
          status?: string | null
          submitted_at?: string | null
          total_amount?: number | null
          vat_amount?: number | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          cuin?: string | null
          customer_name?: string | null
          customer_pin?: string | null
          etims_receipt_no?: string | null
          id?: string
          invoice_id?: string | null
          invoice_number?: string
          qr_code?: string | null
          raw_request?: Json | null
          raw_response?: Json | null
          status?: string | null
          submitted_at?: string | null
          total_amount?: number | null
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "etims_invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etims_invoices_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      etims_items: {
        Row: {
          business_id: string | null
          created_at: string | null
          id: string
          item_code: string
          item_name: string
          tax_code: string | null
          unit_price: number | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          id?: string
          item_code: string
          item_name: string
          tax_code?: string | null
          unit_price?: number | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          id?: string
          item_code?: string
          item_name?: string
          tax_code?: string | null
          unit_price?: number | null
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          business_id: string | null
          created_at: string | null
          description: string
          id: string
          invoice_id: string | null
          quantity: number | null
          tax_code: string | null
          total: number | null
          unit_price: number | null
          vat_amount: number | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          invoice_id?: string | null
          quantity?: number | null
          tax_code?: string | null
          total?: number | null
          unit_price?: number | null
          vat_amount?: number | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string | null
          quantity?: number | null
          tax_code?: string | null
          total?: number | null
          unit_price?: number | null
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_queue: {
        Row: {
          action: string | null
          attempts: number | null
          business_id: string | null
          contact_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          invoice_id: string | null
          processed_at: string | null
          scheduled_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          action?: string | null
          attempts?: number | null
          business_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          processed_at?: string | null
          scheduled_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          action?: string | null
          attempts?: number | null
          business_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          processed_at?: string | null
          scheduled_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_queue_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_queue_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          business_id: string | null
          contact_id: string | null
          created_at: string | null
          cuin: string | null
          currency: string | null
          customer_email: string | null
          customer_phone: string | null
          due_date: string | null
          etims_alerted_at: string | null
          etims_receipt_no: string | null
          etims_status: string | null
          etims_submitted_at: string | null
          id: string
          invoice_number: string
          issue_date: string | null
          last_reminder_sent_at: string | null
          mpesa_reference: string | null
          notes: string | null
          paid_at: string | null
          payment_description: string | null
          payment_method: string | null
          sent_at: string | null
          status: string | null
          subtotal: number | null
          total: number | null
          updated_at: string | null
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          business_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          cuin?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_phone?: string | null
          due_date?: string | null
          etims_alerted_at?: string | null
          etims_receipt_no?: string | null
          etims_status?: string | null
          etims_submitted_at?: string | null
          id?: string
          invoice_number: string
          issue_date?: string | null
          last_reminder_sent_at?: string | null
          mpesa_reference?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_description?: string | null
          payment_method?: string | null
          sent_at?: string | null
          status?: string | null
          subtotal?: number | null
          total?: number | null
          updated_at?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          business_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          cuin?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_phone?: string | null
          due_date?: string | null
          etims_alerted_at?: string | null
          etims_receipt_no?: string | null
          etims_status?: string | null
          etims_submitted_at?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string | null
          last_reminder_sent_at?: string | null
          mpesa_reference?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_description?: string | null
          payment_method?: string | null
          sent_at?: string | null
          status?: string | null
          subtotal?: number | null
          total?: number | null
          updated_at?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      liabilities: {
        Row: {
          business_id: string | null
          category: string | null
          created_at: string | null
          due_on: string | null
          id: string
          name: string
          notes: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          business_id?: string | null
          category?: string | null
          created_at?: string | null
          due_on?: string | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          business_id?: string | null
          category?: string | null
          created_at?: string | null
          due_on?: string | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "liabilities_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      mpesa_configs: {
        Row: {
          account_name: string | null
          b2c_initiator_name: string | null
          b2c_security_credential: string | null
          b2c_shortcode: string | null
          business_id: string | null
          c2b_registered: boolean | null
          c2b_registered_at: string | null
          consumer_key: string
          consumer_secret: string
          created_at: string | null
          environment: string | null
          id: string
          is_active: boolean | null
          passkey: string
          shortcode: string
          updated_at: string | null
        }
        Insert: {
          account_name?: string | null
          b2c_initiator_name?: string | null
          b2c_security_credential?: string | null
          b2c_shortcode?: string | null
          business_id?: string | null
          c2b_registered?: boolean | null
          c2b_registered_at?: string | null
          consumer_key: string
          consumer_secret: string
          created_at?: string | null
          environment?: string | null
          id?: string
          is_active?: boolean | null
          passkey: string
          shortcode: string
          updated_at?: string | null
        }
        Update: {
          account_name?: string | null
          b2c_initiator_name?: string | null
          b2c_security_credential?: string | null
          b2c_shortcode?: string | null
          business_id?: string | null
          c2b_registered?: boolean | null
          c2b_registered_at?: string | null
          consumer_key?: string
          consumer_secret?: string
          created_at?: string | null
          environment?: string | null
          id?: string
          is_active?: boolean | null
          passkey?: string
          shortcode?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mpesa_configs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      mpesa_transactions: {
        Row: {
          account_reference: string | null
          amount: number
          business_id: string | null
          checkout_request_id: string | null
          created_at: string | null
          id: string
          invoice_id: string | null
          merchant_request_id: string | null
          mpesa_receipt_number: string | null
          phone_number: string | null
          raw_callback: Json | null
          result_code: string | null
          result_desc: string | null
          status: string | null
          transaction_desc: string | null
          transaction_type: string
          updated_at: string | null
        }
        Insert: {
          account_reference?: string | null
          amount: number
          business_id?: string | null
          checkout_request_id?: string | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          merchant_request_id?: string | null
          mpesa_receipt_number?: string | null
          phone_number?: string | null
          raw_callback?: Json | null
          result_code?: string | null
          result_desc?: string | null
          status?: string | null
          transaction_desc?: string | null
          transaction_type: string
          updated_at?: string | null
        }
        Update: {
          account_reference?: string | null
          amount?: number
          business_id?: string | null
          checkout_request_id?: string | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          merchant_request_id?: string | null
          mpesa_receipt_number?: string | null
          phone_number?: string | null
          raw_callback?: Json | null
          result_code?: string | null
          result_desc?: string | null
          status?: string | null
          transaction_desc?: string | null
          transaction_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mpesa_transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mpesa_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          b2b_initiated_at: string | null
          b2b_reference: string | null
          b2b_result: string | null
          business_id: string | null
          created_at: string | null
          created_by_email: string | null
          due_date: string | null
          id: number
          last_reminder_sent_at: string | null
          narration: string | null
          paid_date: string | null
          payment_method: string | null
          payment_type: string | null
          receipt_path: string | null
          reference_number: string | null
          status: string | null
          till_number: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          b2b_initiated_at?: string | null
          b2b_reference?: string | null
          b2b_result?: string | null
          business_id?: string | null
          created_at?: string | null
          created_by_email?: string | null
          due_date?: string | null
          id?: number
          last_reminder_sent_at?: string | null
          narration?: string | null
          paid_date?: string | null
          payment_method?: string | null
          payment_type?: string | null
          receipt_path?: string | null
          reference_number?: string | null
          status?: string | null
          till_number?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          b2b_initiated_at?: string | null
          b2b_reference?: string | null
          b2b_result?: string | null
          business_id?: string | null
          created_at?: string | null
          created_by_email?: string | null
          due_date?: string | null
          id?: number
          last_reminder_sent_at?: string | null
          narration?: string | null
          paid_date?: string | null
          payment_method?: string | null
          payment_type?: string | null
          receipt_path?: string | null
          reference_number?: string | null
          status?: string | null
          till_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll: {
        Row: {
          allowances: number | null
          basic_salary: number | null
          business_id: string | null
          created_at: string | null
          created_by_email: string | null
          employee_id: string | null
          gross_pay: number | null
          id: string
          net_pay: number | null
          nhif: number | null
          notes: string | null
          nssf: number | null
          other_deductions: number | null
          pay_date: string | null
          pay_period_end: string | null
          pay_period_start: string | null
          paye: number | null
          status: string | null
          total_deductions: number | null
          updated_at: string | null
        }
        Insert: {
          allowances?: number | null
          basic_salary?: number | null
          business_id?: string | null
          created_at?: string | null
          created_by_email?: string | null
          employee_id?: string | null
          gross_pay?: number | null
          id?: string
          net_pay?: number | null
          nhif?: number | null
          notes?: string | null
          nssf?: number | null
          other_deductions?: number | null
          pay_date?: string | null
          pay_period_end?: string | null
          pay_period_start?: string | null
          paye?: number | null
          status?: string | null
          total_deductions?: number | null
          updated_at?: string | null
        }
        Update: {
          allowances?: number | null
          basic_salary?: number | null
          business_id?: string | null
          created_at?: string | null
          created_by_email?: string | null
          employee_id?: string | null
          gross_pay?: number | null
          id?: string
          net_pay?: number | null
          nhif?: number | null
          notes?: string | null
          nssf?: number | null
          other_deductions?: number | null
          pay_date?: string | null
          pay_period_end?: string | null
          pay_period_start?: string | null
          paye?: number | null
          status?: string | null
          total_deductions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          business_id: string | null
          created_at: string | null
          etims_requested: boolean | null
          etims_synced: boolean | null
          id: string
          mpesa_requested: boolean | null
          notes: string | null
          processed_by: string | null
          processed_date: string | null
          run_period: string
          run_type: string | null
          status: string | null
          total_deductions: number | null
          total_employer_contributions: number | null
          total_gross: number | null
          total_net: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          business_id?: string | null
          created_at?: string | null
          etims_requested?: boolean | null
          etims_synced?: boolean | null
          id?: string
          mpesa_requested?: boolean | null
          notes?: string | null
          processed_by?: string | null
          processed_date?: string | null
          run_period: string
          run_type?: string | null
          status?: string | null
          total_deductions?: number | null
          total_employer_contributions?: number | null
          total_gross?: number | null
          total_net?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          business_id?: string | null
          created_at?: string | null
          etims_requested?: boolean | null
          etims_synced?: boolean | null
          id?: string
          mpesa_requested?: boolean | null
          notes?: string | null
          processed_by?: string | null
          processed_date?: string | null
          run_period?: string
          run_type?: string | null
          status?: string | null
          total_deductions?: number | null
          total_employer_contributions?: number | null
          total_gross?: number | null
          total_net?: number | null
        }
        Relationships: []
      }
      payroll_settings: {
        Row: {
          business_id: string | null
          description: string | null
          effective_date: string | null
          id: string
          is_active: boolean | null
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          business_id?: string | null
          description?: string | null
          effective_date?: string | null
          id?: string
          is_active?: boolean | null
          setting_key: string
          setting_value: Json
          updated_at?: string | null
        }
        Update: {
          business_id?: string | null
          description?: string | null
          effective_date?: string | null
          id?: string
          is_active?: boolean | null
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      payslips: {
        Row: {
          allowances: Json | null
          allowances_total: number | null
          basic_salary: number
          business_id: string | null
          cotu_fund: number | null
          created_at: string | null
          employee_id: string | null
          failure_alerted_at: string | null
          gross_pay: number
          housing_levy: number | null
          id: string
          net_pay: number
          nhif_employee: number | null
          nhif_employer: number | null
          nssf_employee: number | null
          nssf_employer: number | null
          other_deductions: Json | null
          paid_at: string | null
          paye: number | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string | null
          payroll_run_id: string | null
          payslip_pdf_url: string | null
          period_end: string
          period_start: string
          staff_welfare: number | null
          tax_relief: number | null
          taxable_income: number | null
          total_deductions: number
          updated_at: string | null
        }
        Insert: {
          allowances?: Json | null
          allowances_total?: number | null
          basic_salary: number
          business_id?: string | null
          cotu_fund?: number | null
          created_at?: string | null
          employee_id?: string | null
          failure_alerted_at?: string | null
          gross_pay: number
          housing_levy?: number | null
          id?: string
          net_pay: number
          nhif_employee?: number | null
          nhif_employer?: number | null
          nssf_employee?: number | null
          nssf_employer?: number | null
          other_deductions?: Json | null
          paid_at?: string | null
          paye?: number | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          payroll_run_id?: string | null
          payslip_pdf_url?: string | null
          period_end: string
          period_start: string
          staff_welfare?: number | null
          tax_relief?: number | null
          taxable_income?: number | null
          total_deductions: number
          updated_at?: string | null
        }
        Update: {
          allowances?: Json | null
          allowances_total?: number | null
          basic_salary?: number
          business_id?: string | null
          cotu_fund?: number | null
          created_at?: string | null
          employee_id?: string | null
          failure_alerted_at?: string | null
          gross_pay?: number
          housing_levy?: number | null
          id?: string
          net_pay?: number
          nhif_employee?: number | null
          nhif_employer?: number | null
          nssf_employee?: number | null
          nssf_employer?: number | null
          other_deductions?: Json | null
          paid_at?: string | null
          paye?: number | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          payroll_run_id?: string | null
          payslip_pdf_url?: string | null
          period_end?: string
          period_start?: string
          staff_welfare?: number | null
          tax_relief?: number | null
          taxable_income?: number | null
          total_deductions?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_matches: {
        Row: {
          bill_ref_number: string | null
          business_id: string | null
          created_at: string
          first_name: string | null
          id: string
          match_status: string
          matched_invoice_id: string | null
          msisdn: string | null
          trans_amount: number
          trans_id: string
          trans_time: string | null
          transaction_type: string | null
        }
        Insert: {
          bill_ref_number?: string | null
          business_id?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          match_status?: string
          matched_invoice_id?: string | null
          msisdn?: string | null
          trans_amount: number
          trans_id: string
          trans_time?: string | null
          transaction_type?: string | null
        }
        Update: {
          bill_ref_number?: string | null
          business_id?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          match_status?: string
          matched_invoice_id?: string | null
          msisdn?: string | null
          trans_amount?: number
          trans_id?: string
          trans_time?: string | null
          transaction_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_matches_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_matches_matched_invoice_id_fkey"
            columns: ["matched_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      pnl_snapshots: {
        Row: {
          business_id: string
          company_type: string
          generated_at: string
          gross_profit: number
          id: string
          net_profit: number
          operating_profit: number
          period: string
          profit_before_tax: number
          tax_expense: number
          total_cogs: number
          total_finance_costs: number
          total_opex: number
          total_revenue: number
        }
        Insert: {
          business_id: string
          company_type?: string
          generated_at?: string
          gross_profit?: number
          id?: string
          net_profit?: number
          operating_profit?: number
          period: string
          profit_before_tax?: number
          tax_expense?: number
          total_cogs?: number
          total_finance_costs?: number
          total_opex?: number
          total_revenue?: number
        }
        Update: {
          business_id?: string
          company_type?: string
          generated_at?: string
          gross_profit?: number
          id?: string
          net_profit?: number
          operating_profit?: number
          period?: string
          profit_before_tax?: number
          tax_expense?: number
          total_cogs?: number
          total_finance_costs?: number
          total_opex?: number
          total_revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "pnl_snapshots_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_id: string | null
          company_name: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: string | null
          terms_accepted_at: string | null
          updated_at: string | null
        }
        Insert: {
          business_id?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role?: string | null
          terms_accepted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string | null
          terms_accepted_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      scheduled_expenses: {
        Row: {
          account_ref: string | null
          amount: number
          auto_post: boolean
          business_id: string
          category: string
          created_at: string
          created_by: string | null
          created_by_email: string | null
          frequency: string
          id: string
          last_paid_on: string | null
          next_due: string
          notes: string | null
          payment_method: string | null
          status: string
          updated_at: string
          vendor: string
        }
        Insert: {
          account_ref?: string | null
          amount?: number
          auto_post?: boolean
          business_id: string
          category?: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          frequency?: string
          id?: string
          last_paid_on?: string | null
          next_due: string
          notes?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
          vendor: string
        }
        Update: {
          account_ref?: string | null
          amount?: number
          auto_post?: boolean
          business_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          frequency?: string
          id?: string
          last_paid_on?: string | null
          next_due?: string
          notes?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
          vendor?: string
        }
        Relationships: []
      }
      tax_rules: {
        Row: {
          applies_when: string | null
          category: string
          created_at: string | null
          description: string | null
          id: string
          max_turnover: number | null
          min_turnover: number | null
          tax_name: string
          tax_rate: number
        }
        Insert: {
          applies_when?: string | null
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          max_turnover?: number | null
          min_turnover?: number | null
          tax_name: string
          tax_rate: number
        }
        Update: {
          applies_when?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          max_turnover?: number | null
          min_turnover?: number | null
          tax_name?: string
          tax_rate?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          ai_reasoning: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          business_id: string | null
          business_name: string | null
          category: string | null
          confidence: number | null
          created_at: string | null
          created_by: string | null
          created_by_email: string | null
          id: number
          input_source: string | null
          narration: string | null
          notes: string | null
          processed_at: string | null
          ref_number: string | null
          source_bank: string | null
          status: string | null
          submitted_by: string | null
          txn_date: string | null
          txn_id: string | null
          txn_type: string
          updated_at: string | null
        }
        Insert: {
          ai_reasoning?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          business_id?: string | null
          business_name?: string | null
          category?: string | null
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          created_by_email?: string | null
          id?: number
          input_source?: string | null
          narration?: string | null
          notes?: string | null
          processed_at?: string | null
          ref_number?: string | null
          source_bank?: string | null
          status?: string | null
          submitted_by?: string | null
          txn_date?: string | null
          txn_id?: string | null
          txn_type: string
          updated_at?: string | null
        }
        Update: {
          ai_reasoning?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          business_id?: string | null
          business_name?: string | null
          category?: string | null
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          created_by_email?: string | null
          id?: number
          input_source?: string | null
          narration?: string | null
          notes?: string | null
          processed_at?: string | null
          ref_number?: string | null
          source_bank?: string | null
          status?: string | null
          submitted_by?: string | null
          txn_date?: string | null
          txn_id?: string | null
          txn_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_entries: {
        Row: {
          business_name: string
          created_at: string | null
          email: string
          full_name: string
          id: string
          industry: string | null
          ip_address: unknown
          message: string | null
          phone: string | null
          referral_source: string | null
          status: string | null
          team_size: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string | null
          waitlist_position: number | null
        }
        Insert: {
          business_name: string
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          industry?: string | null
          ip_address?: unknown
          message?: string | null
          phone?: string | null
          referral_source?: string | null
          status?: string | null
          team_size?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          waitlist_position?: number | null
        }
        Update: {
          business_name?: string
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          industry?: string | null
          ip_address?: unknown
          message?: string | null
          phone?: string | null
          referral_source?: string | null
          status?: string | null
          team_size?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          waitlist_position?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_business_id: { Args: never; Returns: string }
      flip_overdue_invoices: { Args: never; Returns: Json }
      generate_invoice_number: {
        Args: { p_business_id: string }
        Returns: string
      }
      get_monthly_balance_sheet: {
        Args: { target_month?: string }
        Returns: {
          grants_received: number
          loans_received: number
          loans_repaid: number
          net_profit: number
          pending_count: number
          rejected_count: number
          snapshot_date: string
          total_expenses: number
          total_income: number
          total_transactions: number
        }[]
      }
      reset_stuck_queue: { Args: never; Returns: Json }
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
