export interface Business {
  id: string;
  voice_agent_id?: string;
  business_name: string;
  business_phone: string;
  type_of_business: string;
  additional_context?: string;
  business_summary?: string; // optional business summary field
  default_appointment_length?: number;
  operating_schedule?: any; // JSON object representing schedule (days & hours)
  created_at?: string;
  updated_at?: string;
  business_timezone?: string;
}
