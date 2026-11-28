
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "assignments": {
                  Row: {
                    "answer_spec": (string)[],"cohort_id": string,"created_at": string,"due_at": string | null,"id": string,"instructions": string | null,"module_slug": string,"needs_review": boolean,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer_spec"?: (string)[],"cohort_id": string,"created_at"?: string,"due_at"?: string | null,"id"?: string,"instructions"?: string | null,"module_slug": string,"needs_review"?: boolean,"title": string
                  }
                  Update: {
                    "answer_spec"?: (string)[],"cohort_id"?: string,"created_at"?: string,"due_at"?: string | null,"id"?: string,"instructions"?: string | null,"module_slug"?: string,"needs_review"?: boolean,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assignments_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "cohorts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignments_module_slug_fkey"
      columns: ["module_slug"]
isOneToOne: false
      referencedRelation: "program_modules"
      referencedColumns: ["slug"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"id": number,"target": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"id"?: never,"target"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"id"?: never,"target"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"chapter_progress": {
                  Row: {
                    "chapter_slug": string,"completed_at": string,"module_slug": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chapter_slug": string,"completed_at"?: string,"module_slug": string,"student_id": string
                  }
                  Update: {
                    "chapter_slug"?: string,"completed_at"?: string,"module_slug"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chapter_progress_module_slug_fkey"
      columns: ["module_slug"]
isOneToOne: false
      referencedRelation: "program_modules"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "chapter_progress_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cohorts": {
                  Row: {
                    "capacity": number,"created_at": string,"ends_on": string | null,"id": string,"is_open": boolean,"name": string,"starts_on": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "capacity"?: number,"created_at"?: string,"ends_on"?: string | null,"id"?: string,"is_open"?: boolean,"name": string,"starts_on"?: string | null
                  }
                  Update: {
                    "capacity"?: number,"created_at"?: string,"ends_on"?: string | null,"id"?: string,"is_open"?: boolean,"name"?: string,"starts_on"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"credit_ledger": {
                  Row: {
                    "created_at": string,"delta": number,"granted_by": string | null,"id": number,"kind": string,"order_id": string | null,"reason": string,"review_id": string | null,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"delta": number,"granted_by"?: string | null,"id"?: never,"kind": string,"order_id"?: string | null,"reason": string,"review_id"?: string | null,"student_id": string
                  }
                  Update: {
                    "created_at"?: string,"delta"?: number,"granted_by"?: string | null,"id"?: never,"kind"?: string,"order_id"?: string | null,"reason"?: string,"review_id"?: string | null,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "credit_ledger_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "credit_ledger_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "credit_ledger_review_id_fkey"
      columns: ["review_id"]
isOneToOne: false
      referencedRelation: "reviews"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "credit_ledger_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"enrollments": {
                  Row: {
                    "created_at": string,"granted_by": string | null,"id": string,"module_slug": string,"order_id": string | null,"source": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"granted_by"?: string | null,"id"?: string,"module_slug": string,"order_id"?: string | null,"source": string,"student_id": string
                  }
                  Update: {
                    "created_at"?: string,"granted_by"?: string | null,"id"?: string,"module_slug"?: string,"order_id"?: string | null,"source"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "enrollments_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_module_slug_fkey"
      columns: ["module_slug"]
isOneToOne: false
      referencedRelation: "program_modules"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "enrollments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "created_at": string,"duration_min": number,"id": string,"join_url": string | null,"kind": string,"module_slug": string | null,"starts_at": string,"title": string,"track": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"duration_min": number,"id"?: string,"join_url"?: string | null,"kind": string,"module_slug"?: string | null,"starts_at": string,"title": string,"track"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"duration_min"?: number,"id"?: string,"join_url"?: string | null,"kind"?: string,"module_slug"?: string | null,"starts_at"?: string,"title"?: string,"track"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_module_slug_fkey"
      columns: ["module_slug"]
isOneToOne: false
      referencedRelation: "program_modules"
      referencedColumns: ["slug"]
    }
                  ]
                },"invites": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"email": string,"invited_by": string | null,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email": string,"invited_by"?: string | null,"role": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string,"invited_by"?: string | null,"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"mentor_profiles": {
                  Row: {
                    "confidentiality_signed_at": string | null,"created_at": string,"monthly_review_limit": number,"monthly_session_limit": number,"orientation_done_at": string | null,"scheduling_url": string | null,"status": string,"title": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "confidentiality_signed_at"?: string | null,"created_at"?: string,"monthly_review_limit"?: number,"monthly_session_limit"?: number,"orientation_done_at"?: string | null,"scheduling_url"?: string | null,"status"?: string,"title"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "confidentiality_signed_at"?: string | null,"created_at"?: string,"monthly_review_limit"?: number,"monthly_session_limit"?: number,"orientation_done_at"?: string | null,"scheduling_url"?: string | null,"status"?: string,"title"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mentor_profiles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "amount_total": number | null,"checkout_url": string | null,"cohort_id": string,"created_at": string,"currency": string | null,"expires_at": string,"id": string,"over_capacity": boolean,"paid_at": string | null,"product_id": string,"status": string,"stripe_checkout_session_id": string | null,"stripe_payment_intent_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_total"?: number | null,"checkout_url"?: string | null,"cohort_id": string,"created_at"?: string,"currency"?: string | null,"expires_at": string,"id"?: string,"over_capacity"?: boolean,"paid_at"?: string | null,"product_id": string,"status"?: string,"stripe_checkout_session_id"?: string | null,"stripe_payment_intent_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "amount_total"?: number | null,"checkout_url"?: string | null,"cohort_id"?: string,"created_at"?: string,"currency"?: string | null,"expires_at"?: string,"id"?: string,"over_capacity"?: boolean,"paid_at"?: string | null,"product_id"?: string,"status"?: string,"stripe_checkout_session_id"?: string | null,"stripe_payment_intent_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "cohorts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"product_modules": {
                  Row: {
                    "module_slug": string,"product_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "module_slug": string,"product_id": string
                  }
                  Update: {
                    "module_slug"?: string,"product_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_modules_module_slug_fkey"
      columns: ["module_slug"]
isOneToOne: false
      referencedRelation: "program_modules"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "product_modules_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"kind": string,"name": string,"one_on_one_credits": number,"review_credits": number,"slug": string,"stripe_price_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"kind": string,"name": string,"one_on_one_credits"?: number,"review_credits"?: number,"slug": string,"stripe_price_id"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"kind"?: string,"name"?: string,"one_on_one_credits"?: number,"review_credits"?: number,"slug"?: string,"stripe_price_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string | null,"id": string,"role": string,"stripe_customer_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"full_name"?: string | null,"id": string,"role"?: string,"stripe_customer_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string | null,"id"?: string,"role"?: string,"stripe_customer_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"program_modules": {
                  Row: {
                    "chapter_slugs": (string)[],"rubric_criteria": (string)[],"slug": string,"sort_order": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chapter_slugs"?: (string)[],"rubric_criteria"?: (string)[],"slug": string,"sort_order": number,"title": string
                  }
                  Update: {
                    "chapter_slugs"?: (string)[],"rubric_criteria"?: (string)[],"slug"?: string,"sort_order"?: number,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reviews": {
                  Row: {
                    "assigned_at": string,"completed_at": string | null,"due_at": string,"feedback_file_name": string | null,"feedback_file_path": string | null,"follow_up": string | null,"id": string,"mentor_id": string,"priorities": (string)[],"scores": NonNullable<Json>,"status": string,"strengths": string | null,"submission_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string,"completed_at"?: string | null,"due_at": string,"feedback_file_name"?: string | null,"feedback_file_path"?: string | null,"follow_up"?: string | null,"id"?: string,"mentor_id": string,"priorities"?: (string)[],"scores"?: NonNullable<Json>,"status"?: string,"strengths"?: string | null,"submission_id": string,"updated_at"?: string
                  }
                  Update: {
                    "assigned_at"?: string,"completed_at"?: string | null,"due_at"?: string,"feedback_file_name"?: string | null,"feedback_file_path"?: string | null,"follow_up"?: string | null,"id"?: string,"mentor_id"?: string,"priorities"?: (string)[],"scores"?: NonNullable<Json>,"status"?: string,"strengths"?: string | null,"submission_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_mentor_id_fkey"
      columns: ["mentor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"schools": {
                  Row: {
                    "casper": boolean,"country": string,"created_at": string,"degree": string,"facts": NonNullable<Json>,"id": string,"interview": string | null,"latitude": number | null,"longitude": number | null,"name": string,"place": string,"updated_at": string,"url": string | null,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "casper"?: boolean,"country": string,"created_at"?: string,"degree": string,"facts"?: NonNullable<Json>,"id"?: string,"interview"?: string | null,"latitude"?: number | null,"longitude"?: number | null,"name": string,"place": string,"updated_at"?: string,"url"?: string | null,"verified_at"?: string | null
                  }
                  Update: {
                    "casper"?: boolean,"country"?: string,"created_at"?: string,"degree"?: string,"facts"?: NonNullable<Json>,"id"?: string,"interview"?: string | null,"latitude"?: number | null,"longitude"?: number | null,"name"?: string,"place"?: string,"updated_at"?: string,"url"?: string | null,"verified_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"stripe_events": {
                  Row: {
                    "id": string,"processed_at": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"processed_at"?: string,"type": string
                  }
                  Update: {
                    "id"?: string,"processed_at"?: string,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"student_profiles": {
                  Row: {
                    "cohort_id": string | null,"created_at": string,"cycle": string | null,"primary_mentor_id": string | null,"track": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cohort_id"?: string | null,"created_at"?: string,"cycle"?: string | null,"primary_mentor_id"?: string | null,"track"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "cohort_id"?: string | null,"created_at"?: string,"cycle"?: string | null,"primary_mentor_id"?: string | null,"track"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_profiles_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "cohorts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_profiles_primary_mentor_id_fkey"
      columns: ["primary_mentor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_profiles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"submission_items": {
                  Row: {
                    "body": string | null,"file_name": string | null,"id": string,"kind": string,"label": string,"sort_order": number,"storage_path": string | null,"submission_id": string,"video_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"file_name"?: string | null,"id"?: string,"kind": string,"label": string,"sort_order": number,"storage_path"?: string | null,"submission_id": string,"video_url"?: string | null
                  }
                  Update: {
                    "body"?: string | null,"file_name"?: string | null,"id"?: string,"kind"?: string,"label"?: string,"sort_order"?: number,"storage_path"?: string | null,"submission_id"?: string,"video_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "submission_items_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"submissions": {
                  Row: {
                    "assignment_id": string,"id": string,"note": string | null,"student_id": string,"submitted_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id": string,"id"?: string,"note"?: string | null,"student_id": string,"submitted_at"?: string,"version": number
                  }
                  Update: {
                    "assignment_id"?: string,"id"?: string,"note"?: string | null,"student_id"?: string,"submitted_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "submissions_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submissions_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"volunteer_hours": {
                  Row: {
                    "activity": string,"created_at": string,"date": string,"hours": number,"id": string,"mentor_id": string,"review_id": string | null,"source": string,"student_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activity": string,"created_at"?: string,"date": string,"hours": number,"id"?: string,"mentor_id": string,"review_id"?: string | null,"source": string,"student_id"?: string | null
                  }
                  Update: {
                    "activity"?: string,"created_at"?: string,"date"?: string,"hours"?: number,"id"?: string,"mentor_id"?: string,"review_id"?: string | null,"source"?: string,"student_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "volunteer_hours_mentor_id_fkey"
      columns: ["mentor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "volunteer_hours_review_id_fkey"
      columns: ["review_id"]
isOneToOne: false
      referencedRelation: "reviews"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "volunteer_hours_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
