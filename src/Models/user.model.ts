import { ApiProperty } from "@nestjs/swagger";

export interface Customer {
  created_at: Date;
  uuid: string;
  email: string;
  username: string;          // required field
  phone?: string;            // now optional (default null/empty)
  company?: string;          // now optional (default null/empty)
  title?: string;            // now optional (default null/empty)
  plan_id: number;
  stripe_id?: string;
  trial: number;
  source_links_allowed: number;
  voiceagents_allowed: number | null;
  total_voiceagents: number | null;
  allowed_msg_credits: number | null;
  total_credits: number | null;
  plan_mode?: string;
  subscription_id?: string;
  isAdmin: boolean;
}

export interface CustomerCreateDTO extends Omit<Customer, 'created_at' | 'uuid'> {}

export interface CustomerUpdateDTO extends Partial<CustomerCreateDTO> {
  uuid: string;
}

export interface UpdateCustomerDetailsDTO {
  username?: string;
  phone?: string;
  company?: string;
  title?: string;
}

export class UpdateCreditsDTO {
  @ApiProperty({
    description: 'Number of credits to set for the customer',
    example: 100,
    required: true,
  })
  credits: number;
}
