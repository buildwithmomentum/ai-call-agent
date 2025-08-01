import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Voiceagent } from '../../Models/voiceagent.model';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { createDefaultVoiceagent } from './defaultVoiceagent';
import { CustomerService } from '../customer/customer.service';
import { createDefaultFunctions } from '../functions/defaultTools'; // updated import path

@Injectable()
export class VoiceagentService {
  private readonly supabase;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly customerService: CustomerService, // injected CustomerService
  ) {
    this.supabase = supabaseService.getClient();
  }

  // Helper method for deep merging objects
  private deepMerge(target: any, source: any): any {
    if (!source) return target;
    const output = { ...target };
    
    Object.keys(source).forEach(key => {
      if (source[key] === undefined) return;
      
      if (
        typeof source[key] === 'object' && 
        source[key] !== null && 
        !Array.isArray(source[key]) &&
        typeof output[key] === 'object' && 
        output[key] !== null && 
        !Array.isArray(output[key])
      ) {
        // If both values are objects, recursively merge them
        output[key] = this.deepMerge(output[key], source[key]);
      } else {
        // Otherwise just replace the value
        output[key] = source[key];
      }
    });
    
    return output;
  }

  // Service: Creates a new voiceagent entry.
  async create(data: Partial<Voiceagent>, user_id: string): Promise<Voiceagent> {
    const defaultVoiceagent = createDefaultVoiceagent();
    
    // Use deep merge instead of shallow spread to preserve nested default settings
    const mergedData = this.deepMerge(defaultVoiceagent, data);
    
    const { data: voiceagent, error } = await this.supabase
      .from('voice_agents')
      .insert({
        ...mergedData,
        last_trained_at: new Date().toISOString(),
        created_by: user_id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    // Insert default functions
    const defaultFunctions = createDefaultFunctions(user_id, voiceagent.id);
    const { error: functionsError } = await this.supabase
      .from('functions')
      .insert(defaultFunctions);
    if (functionsError) throw functionsError;

    // Insert an entry into voice_agents_access with default access 'owner'
    const { error: accessError } = await this.supabase
      .from('voice_agents_access')
      .insert({
        voice_agent_id: voiceagent.id,
        user_id,
        access: 'owner',
        status: true,
        created_at: new Date().toISOString() // optionally record creation timestamp
      });
    if (accessError) throw accessError;

    // Call CustomerService to increment the voice agent count for the customer
    await this.customerService.incrementVoiceagentCount(user_id);

    return voiceagent;
  }

  // Service: Retrieves all voiceagents for the specified user.
  async findAll(userId: string): Promise<any> {
    const { data: voiceAgents, error } = await this.supabase
      .from('voice_agents_access')
      .select(`
        voice_agent_id,
        access,
        voice_agents (
          id,
          name,
          created_by,
          
          last_trained_at,
          summary,
          takeOverTimeout,
          created_at
        )
      `)
      .eq('user_id', userId)
      .eq('status', true);

    if (error) throw error;

    if (!voiceAgents || voiceAgents.length === 0) {
      return {
        message: 'No voice agents found for this user',
        voiceAgents: []
      };
    }

    return voiceAgents.map((access) => ({
      ...access.voice_agents,
      access: access.access,
    }));
  }

  // Service: Retrieves a voiceagents by its id and user id.
  async findOne(id: string, user_id: string): Promise<Voiceagent> {
    const { data: voiceagent, error } = await this.supabase
      .from('voice_agents_access')
      .select('*, voice_agent:voice_agent_id(*)')
      .eq('voice_agent_id', id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (error) throw error;
    if (!voiceagent) {
      throw new NotFoundException(`Voice agent with ID ${id} not found`);
    }
    return voiceagent;
  }

  // Service: Retrieves voiceagents created by a specific user.
  async findByCreator(created_by: string): Promise<Voiceagent[]> {
    const { data: voiceagents, error } = await this.supabase
      .from('voice_agents')
      .select('*')
      .eq('created_by', created_by);

    if (error) throw error;
    return voiceagents;
  }

  // Service: Updates an existing voiceagents.
  async update(id: string, data: Partial<Voiceagent>): Promise<Voiceagent> {
    const { data: voiceagent, error } = await this.supabase
      .from('voice_agents')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!voiceagent) {
      throw new NotFoundException(`Voice agent with ID ${id} not found`);
    }
    return voiceagent;
  }

  // New private method to drop embeddings table
  private async dropEmbeddingsTable(voiceAgentId: string): Promise<void> {
    try {
      const tableId = `zz_${voiceAgentId}`;
      // Drop the table and its associated search function
      await this.supabase.rpc('drop_embeddings_table', { table_id: tableId });
    } catch (error) {
      throw new Error(`Error dropping embeddings table: ${error.message}`);
    }
  }

  // Service: Deletes a voiceagents.
  async delete(id: string): Promise<{
    message: string,
    name?: string,
    id?: string,
    deletedAccessEntries?: number,
    deletedBusinessDetails?: number,
    deletedFunctions?: number,
    deletedEmbeddingsTable?: boolean // added this field
  }> {
    // Validate the ID is provided
    if (!id) {
      throw new NotFoundException('Voice agent ID is required');
    }

    // First check if the voice agent exists
    const { data: existingVoiceagent, error: fetchError } = await this.supabase
      .from('voice_agents')
      .select('*')
      .eq('id', id)
      .maybeSingle(); // Use maybeSingle instead of single to handle non-existent records

    // Handle case where voice agent doesn't exist
    if (!existingVoiceagent) {
      return {
        message: `Voice agent with ID ${id} not found or already deleted`
      };
    }

    if (fetchError) {
      throw new Error(`Error fetching voice agent: ${fetchError.message}`);
    }
    
    const user_id = existingVoiceagent.created_by;
    
    try {
      // Delete functions associated with this voice agent
      const { data: deletedFunctions, error: functionsError } = await this.supabase
        .from('functions')
        .delete()
        .eq('assistant_id', id)
        .select();
      
      if (functionsError) {
        throw new Error(`Error deleting functions: ${functionsError.message}`);
      }

      // Delete the embeddings table
      await this.dropEmbeddingsTable(id);
      const embeddingsTableDeleted = true; // Flag to indicate table deletion

      // Delete voice_agents_access entries and count them
      const { data: deletedAccess, error: accessError } = await this.supabase
        .from('voice_agents_access')
        .delete()
        .eq('voice_agent_id', id)
        .select();
      
      if (accessError) {
        throw new Error(`Error deleting access entries: ${accessError.message}`);
      }

      // Delete business_details entries and count them
      const { data: deletedBusiness, error: businessError } = await this.supabase
        .from('business_details')
        .delete()
        .eq('voice_agent_id', id)
        .select();
      
      if (businessError) {
        throw new Error(`Error deleting business details: ${businessError.message}`);
      }
      
      // Delete the voice agent entry
      const { error: deleteError } = await this.supabase
        .from('voice_agents')
        .delete()
        .eq('id', id);
      
      if (deleteError) {
        throw new Error(`Error deleting voice agent: ${deleteError.message}`);
      }
      
      // Decrement the customer's voice agent count
      await this.customerService.decrementVoiceagentCount(user_id);
      
      return {
        message: `Voice agent "${existingVoiceagent.name}" deleted successfully. Removed ${deletedAccess?.length || 0} access entries, ${deletedBusiness?.length || 0} business details, ${deletedFunctions?.length || 0} functions, and embeddings table.`,
        id: existingVoiceagent.id,
        name: existingVoiceagent.name,
        deletedAccessEntries: deletedAccess?.length || 0,
        deletedBusinessDetails: deletedBusiness?.length || 0,
        deletedFunctions: deletedFunctions?.length || 0,
        deletedEmbeddingsTable: embeddingsTableDeleted
      };
    } catch (error) {
      throw new Error(`Failed to delete voice agent: ${error.message}`);
    }
  }

  // Service: Updates the last trained timestamp of a voiceagents.
  async updateLastTrainedAt(id: string): Promise<Voiceagent> {
    const { data: voiceagent, error } = await this.supabase
      .from('voice_agents')
      .update({
        last_trained_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!voiceagent) {
      throw new NotFoundException(`Voice agent with ID ${id} not found`);
    }
    return voiceagent;
  }

  // Service: Updates takeover settings for a voiceagents.
  async updateTakeOverSettings(
    id: string,
    takeOverTimeout?: string,
  ): Promise<Voiceagent> {
    const updateData: Partial<Voiceagent> = {
      ...(takeOverTimeout && { takeOverTimeout }),
    };

    const { data: voiceagent, error } = await this.supabase
      .from('voice_agents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!voiceagent) {
      throw new NotFoundException(`Voice agent with ID ${id} not found`);
    }
    return voiceagent;
  }

  // Service: Updates private settings for a voiceagents.
  async updateSettings(
    id: string,
    privateSettings?: Partial<Voiceagent['private_settings']>,
  ): Promise<Voiceagent> {
    const { data: existingVoiceagent } = await this.supabase
      .from('voice_agents')
      .select('private_settings')
      .eq('id', id)
      .single();

    if (!existingVoiceagent) {
      throw new NotFoundException(`Voice agent with ID ${id} not found`);
    }

    const updateData: Partial<Voiceagent> = {};

    if (privateSettings) {
      // Use deep merge instead of shallow merge to properly handle nested settings
      updateData.private_settings = this.deepMerge(
        existingVoiceagent.private_settings,
        privateSettings
      );
    }

    const { data: voiceagent, error } = await this.supabase
      .from('voice_agents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return voiceagent;
  }

  // Service: Retrieves a user's permissions for a specific voiceagents.
  async getVoiceagentPermissions(
    voiceagent_id: string,
    user_id: string,
  ): Promise<JSON> {
    const { data, error } = await this.supabase
      .from('voice_agents_access')
      .select('access,voice_agent_id,user_id,status')
      .eq('user_id', user_id)
      .eq('voice_agent_id', voiceagent_id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new NotFoundException('Voice agent not found');
    }
    return data;
  }

 
  // Service: Fetches detailed voiceagents data.
  async getVoiceagentData(voiceagentId: string) {
    const { data: voiceagentData, error: voiceagentError } = await this.supabase
      .from('voice_agents')
      .select('*') // changed to select all columns
      .eq('id', voiceagentId)
      .single();

    if (voiceagentError || !voiceagentData) {
      console.error('Error fetching voice agent data:', voiceagentError);
      throw new Error('Voice agent not found or error fetching data');
    }

    return voiceagentData;
  }

  // Service: Updates SYSTEM_MESSAGE for all voice agents
  private async checkAdminAccess(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('customer')
        .select('isadmin')
        .eq('uuid', userId)
        .single();

      if (error) throw new Error('Failed to check admin status');
      return data?.isadmin || false;
    } catch (error) {
      throw new Error(`Failed to verify admin access: ${error.message}`);
    }
  }

  async updateAllSystemMessages(userId: string): Promise<{ updated: number, message: string }> {
    try {
      // Check if user is admin
      const isAdmin = await this.checkAdminAccess(userId);
      if (!isAdmin) {
        throw new ForbiddenException('Only administrators can update system messages');
      }

      const defaultAgent = createDefaultVoiceagent();
      const defaultSystemMessage = defaultAgent.private_settings.model.SYSTEM_MESSAGE;

      const { data: voiceAgents, error: fetchError } = await this.supabase
        .from('voice_agents')
        .select('id, private_settings');

      if (fetchError) throw fetchError;

      let updatedCount = 0;
      for (const agent of voiceAgents) {
        const updatedSettings = {
          ...agent.private_settings,
          model: {
            ...agent.private_settings.model,
            SYSTEM_MESSAGE: defaultSystemMessage
          }
        };

        const { error: updateError } = await this.supabase
          .from('voice_agents')
          .update({ private_settings: updatedSettings })
          .eq('id', agent.id);

        if (!updateError) updatedCount++;
      }

      return {
        updated: updatedCount,
        message: `Successfully updated SYSTEM_MESSAGE for ${updatedCount} voice agents`
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new Error(`Failed to update system messages: ${error.message}`);
    }
  }

  // Service: Updates the Twilio phone number for a voice agent
  async updateTwilioPhoneNumber(id: string, phoneNumber: string): Promise<Voiceagent> {
    try {
      // Validate the voice agent exists
      const { data: existingVoiceagent, error: fetchError } = await this.supabase
        .from('voice_agents')
        .select('id')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!existingVoiceagent) {
        throw new NotFoundException(`Voice agent with ID ${id} not found`);
      }

      // Validate and format the phone number
      if (!phoneNumber) {
        throw new Error('Phone number is required');
      }

      // Remove any spaces from the phone number
      const formattedPhoneNumber = phoneNumber.replace(/\s+/g, '');

      // Validate the phone number format (must start with + and contain only digits after that)
      if (!formattedPhoneNumber.match(/^\+\d+$/)) {
        throw new Error('Phone number must be in E.164 format (e.g., +19895644594)');
      }

      // Update the voice agent with the formatted phone number
      const { data: updatedVoiceagent, error: updateError } = await this.supabase
        .from('voice_agents')
        .update({ twilio_phone_number: formattedPhoneNumber })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;
      
      return updatedVoiceagent;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Failed to update Twilio phone number: ${error.message}`);
    }
  }
}
