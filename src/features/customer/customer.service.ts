import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Customer, CustomerUpdateDTO, UpdateCustomerDetailsDTO } from '../../Models/user.model';
import { SupabaseService } from '../../utils/supabase/supabaseClient';

@Injectable()
export class CustomerService {
  private readonly supabase;

  constructor(private readonly supabaseService: SupabaseService) {
    this.supabase = supabaseService.getClient();
  }

  async findOne(uuid: string): Promise<Customer | null> {
    const { data: customer, error } = await this.supabase
      .from('customer')
      .select('*')
      .eq('uuid', uuid)
      .single();

    if (error) throw error;
    return customer;
  }

  async findByEmail(email: string): Promise<Customer | null> {
    const { data: customer, error } = await this.supabase
      .from('customer')
      .select('*')
      .eq('email', email)
      .single();

    if (error) throw error;
    return customer;
  }

  async update(uuid: string, data: CustomerUpdateDTO): Promise<Customer> {
    const { data: customer, error } = await this.supabase
      .from('customer')
      .update({ ...data })
      .eq('uuid', uuid)
      .select()
      .single();

    if (error) throw error;
    return customer;
  }

  async remove(uuid: string): Promise<any> {
    // First get customer details for the response
    const { data: customer } = await this.supabase
      .from('customer')
      .select('*')
      .eq('uuid', uuid)
      .single();

    // Get voice agents owned by user
    const { data: ownedAgents } = await this.supabase
      .from('voice_agents')
      .select('id, name')
      .eq('created_by', uuid);

    // Get voice agent access entries where user is owner
    const { data: accessEntries } = await this.supabase
      .from('voice_agents_access')
      .select('voice_agent_id')
      .eq('user_id', uuid)
      .eq('access', 'owner');

    // Delete voice agent access entries where user is owner
    const { error: accessError } = await this.supabase
      .from('voice_agents_access')
      .delete()
      .eq('user_id', uuid)
      .eq('access', 'owner');

    if (accessError) throw accessError;

    // Delete voice agents created by the user
    const { error: agentsError } = await this.supabase
      .from('voice_agents')
      .delete()
      .eq('created_by', uuid);

    if (agentsError) throw agentsError;

    // Delete customer record
    const { error: customerError } = await this.supabase
      .from('customer')
      .delete()
      .eq('uuid', uuid);

    if (customerError) throw customerError;

    // Delete auth user
    const { error: authError } = await this.supabase.auth.admin.deleteUser(uuid);
    if (authError) throw authError;

    return {
      message: 'User and related data deleted successfully',
      deletedCustomer: {
        uuid: customer.uuid,
        email: customer.email,
        plan: customer.plan_mode
      },
      deletedVoiceAgents: ownedAgents || [],
      deletedAccessEntries: accessEntries?.length || 0
    };
  }

  async incrementVoiceagentCount(uuid: string): Promise<Customer> {
    const { data: currentCustomer, error: fetchError } = await this.supabase
      .from('customer')
      .select('total_voiceagents')
      .eq('uuid', uuid)
      .single();

    if (fetchError) throw fetchError;

    const { data: customer, error: updateError } = await this.supabase
      .from('customer')
      .update({
        total_voiceagents: (currentCustomer.total_voiceagents || 0) + 1,
      })
      .eq('uuid', uuid)
      .select()
      .single();

    if (updateError) throw updateError;
    return customer;
  }

  async decrementVoiceagentCount(userId: string): Promise<void> {
    const { data: customer, error: fetchError } = await this.supabase
      .from('customer')
      .select('total_voiceagents')
      .eq('uuid', userId)
      .single();

    if (fetchError) throw fetchError;

    const newCount = Math.max((customer?.total_voiceagents || 0) - 1, 0);

    const { error: updateError } = await this.supabase
      .from('customer')
      .update({ total_voiceagents: newCount })
      .eq('uuid', userId);

    if (updateError) throw updateError;
  }

  async updateCredits(uuid: string, credits: number): Promise<Customer> {
    const { data: customer, error } = await this.supabase
      .from('customer')
      .update({ total_credits: credits })
      .eq('uuid', uuid)
      .select()
      .single();

    if (error) throw error;
    return customer;
  }

  async createCustomer(
    userId: string,
    email: string,
    username: string,
    phone?: string | null,    // made optional
    company?: string | null,  // made optional
    title?: string | null     // made optional
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('customer')
      .insert({
        uuid: userId,
        email,
        username,  
        phone: phone ?? null,      
        company: company ?? null,   
        title: title ?? null,      
        plan_id: 1,
        plan_mode: 'free',
        trial: true,
      })
      .single();
    if (error) throw error;
    return data;
  }

  async updateCustomerDetails(uuid: string, details: UpdateCustomerDetailsDTO): Promise<Customer> {
    if ('email' in details) {
      throw new HttpException("Email cannot be updated", HttpStatus.BAD_REQUEST);
    }
    const { data: customer, error } = await this.supabase
      .from('customer')
      .update({ ...details })
      .eq('uuid', uuid)
      .select()
      .single();
    if (error) throw error;
    return customer;
  }
}
