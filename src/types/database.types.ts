// Tipos de la base de datos de CoplinTech.
// Mantener sincronizado con supabase/migrations. Para regenerar:
//   npx supabase gen types typescript --local > src/types/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Timestamps = { created_at: string; updated_at: string }

export interface Database {
  public: {
    Tables: {
      owner_profiles: {
        Row: { user_id: string; display_name: string | null; is_active: boolean } & Timestamps
        Insert: never
        Update: never
        Relationships: []
      }
      store_settings: {
        Row: {
          id: boolean
          store_name: string
          whatsapp_number: string | null
          currency_code: string
          timezone: string
          default_low_stock_threshold: number
          updated_at: string
        }
        Insert: never
        Update: { store_name?: string; whatsapp_number?: string | null; default_low_stock_threshold?: number }
        Relationships: []
      }
      categories: {
        Row: { id: string; name: string; slug: string; sort_order: number; is_active: boolean } & Timestamps
        Insert: { name: string; slug: string; sort_order?: number; is_active?: boolean }
        Update: { name?: string; slug?: string; sort_order?: number; is_active?: boolean }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          name: string
          slug: string
          sku: string | null
          barcode: string | null
          brand: string | null
          category_id: string | null
          description: string | null
          cost_price: number
          sale_price: number
          stock_quantity: number
          low_stock_threshold: number
          image_path: string | null
          is_active: boolean
          is_published: boolean
        } & Timestamps
        Insert: {
          name: string
          slug: string
          sku?: string | null
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          description?: string | null
          cost_price: number
          sale_price: number
          stock_quantity?: number
          low_stock_threshold?: number
          image_path?: string | null
          is_active?: boolean
          is_published?: boolean
        }
        Update: {
          name?: string
          slug?: string
          sku?: string | null
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          description?: string | null
          cost_price?: number
          sale_price?: number
          low_stock_threshold?: number
          image_path?: string | null
          is_active?: boolean
          is_published?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      product_images: {
        Row: { id: string; product_id: string; image_path: string; sort_order: number; created_at: string }
        Insert: never
        Update: never
        Relationships: [
          {
            foreignKeyName: 'product_images_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      sales: {
        Row: {
          id: string
          sale_number: string
          status: 'completed' | 'voided'
          payment_method: 'cash' | 'bank_transfer' | 'card'
          subtotal: number
          discount_amount: number
          total: number
          amount_received: number
          change_amount: number
          note: string | null
          client_request_id: string
          created_by: string
          created_at: string
          voided_at: string | null
          voided_by: string | null
          void_reason: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          product_id: string | null
          product_name_snapshot: string
          sku_snapshot: string | null
          quantity: number
          unit_sale_price: number
          unit_cost_price: number
          line_subtotal: number
        }
        Insert: never
        Update: never
        Relationships: [
          {
            foreignKeyName: 'sale_items_sale_id_fkey'
            columns: ['sale_id']
            isOneToOne: false
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
        ]
      }
      stock_movements: {
        Row: {
          id: string
          product_id: string
          movement_type: 'initial_stock' | 'restock' | 'adjustment' | 'sale' | 'void_sale'
          quantity_delta: number
          quantity_before: number
          quantity_after: number
          sale_id: string | null
          reason: string | null
          created_by: string
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: [
          {
            foreignKeyName: 'stock_movements_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stock_movements_sale_id_fkey'
            columns: ['sale_id']
            isOneToOne: false
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
        ]
      }
      expenses: {
        Row: {
          id: string
          expense_date: string
          category: string
          description: string
          amount: number
          payment_method: string | null
          note: string | null
          is_voided: boolean
          created_by: string
        } & Timestamps
        Insert: {
          expense_date: string
          category: string
          description: string
          amount: number
          payment_method?: string | null
          note?: string | null
        }
        Update: {
          expense_date?: string
          category?: string
          description?: string
          amount?: number
          payment_method?: string | null
          note?: string | null
          is_voided?: boolean
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      is_owner: { Args: Record<string, never>; Returns: boolean }
      record_stock_movement: {
        Args: { p_product_id: string; p_movement_type: string; p_quantity_delta: number; p_reason?: string | null }
        Returns: Database['public']['Tables']['stock_movements']['Row']
      }
      create_sale: {
        Args: {
          p_client_request_id: string
          p_items: Json
          p_payment_method: string
          p_discount_amount?: number
          p_amount_received?: number | null
          p_note?: string | null
        }
        Returns: { sale_id: string; sale_number: string; total: number; change_amount: number; already_existed: boolean }[]
      }
      void_sale: {
        Args: { p_sale_id: string; p_reason: string }
        Returns: Database['public']['Tables']['sales']['Row']
      }
      report_summary: {
        Args: { p_start: string; p_end: string }
        Returns: {
          gross_sales: number
          discount_total: number
          net_sales: number
          cost_of_goods: number
          gross_profit: number
          expenses_total: number
          operating_result: number
          sales_count: number
          average_ticket: number
        }[]
      }
      report_sales_by_day: {
        Args: { p_start: string; p_end: string }
        Returns: { day: string; net_sales: number; gross_profit: number; sales_count: number }[]
      }
      report_product_performance: {
        Args: { p_start: string; p_end: string }
        Returns: {
          product_id: string | null
          product_name: string
          sku: string | null
          units: number
          net_amount: number
          cost_amount: number
          gross_profit: number
        }[]
      }
      report_payment_methods: {
        Args: { p_start: string; p_end: string }
        Returns: { payment_method: string; sales_count: number; net_sales: number }[]
      }
      report_expenses_by_category: {
        Args: { p_start: string; p_end: string }
        Returns: { category: string; expense_count: number; total: number }[]
      }
      inventory_status_counts: {
        Args: Record<string, never>
        Returns: { available: number; low_stock: number; out_of_stock: number }[]
      }
      products_needing_restock: {
        Args: { p_limit?: number }
        Returns: {
          id: string
          name: string
          sku: string | null
          stock_quantity: number
          low_stock_threshold: number
          availability: string
        }[]
      }
      get_public_catalog_products: {
        Args: { p_search?: string | null; p_category_slug?: string | null; p_limit?: number; p_offset?: number; p_sort?: string | null }
        Returns: {
          name: string
          slug: string
          brand: string | null
          category_name: string | null
          category_slug: string | null
          description: string | null
          sale_price: number
          image_path: string | null
          availability: string
          total_count: number
        }[]
      }
      get_public_catalog_product_by_slug: {
        Args: { p_slug: string }
        Returns: {
          name: string
          slug: string
          brand: string | null
          category_name: string | null
          category_slug: string | null
          description: string | null
          sale_price: number
          image_path: string | null
          availability: string
          images: string[]
        }[]
      }
      set_product_images: {
        Args: { p_product_id: string; p_paths: string[] }
        Returns: { removed_path: string }[]
      }
      get_public_catalog_products_by_slugs: {
        Args: { p_slugs: string[] }
        Returns: {
          name: string
          slug: string
          brand: string | null
          category_name: string | null
          sale_price: number
          image_path: string | null
          availability: string
        }[]
      }
      get_public_categories: { Args: Record<string, never>; Returns: { name: string; slug: string }[] }
      get_public_store_info: {
        Args: Record<string, never>
        Returns: { store_name: string; whatsapp_number: string | null }[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database['public']
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type RpcReturn<F extends keyof PublicSchema['Functions']> = PublicSchema['Functions'][F]['Returns']
