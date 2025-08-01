import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  CreateFunctionDto,
  UpdateFunctionDto,
  FunctionType,
  flow_variables,
  function_variables,
  form_variables,
} from './dto/function.dto';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { createDefaultFunctions } from './defaultTools';  

@Injectable()
export class FunctionsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private validateFlowVariables(variables: flow_variables[]) {
    if (!Array.isArray(variables) || variables.length === 0) {
      throw new BadRequestException('Variables must be a non-empty array');
    }

    for (const variable of variables) {
      if (!variable.var_type || variable.var_data === undefined) {
        throw new BadRequestException(
          'Missing required fields in flow variables',
        );
      }

      switch (variable.var_type) {
        case 'text':
          if (typeof variable.var_data !== 'string') {
            throw new BadRequestException(
              'For text type variables, var_data must be a string',
            );
          }
          break;
        case 'image': {
          const imageData = variable.var_data as {
            url: string;
            caption: string;
          };
          if (!imageData || typeof imageData !== 'object') {
            throw new BadRequestException(
              'For image type variables, var_data must be an object',
            );
          }
          if (
            typeof imageData.url !== 'string' ||
            typeof imageData.caption !== 'string'
          ) {
            throw new BadRequestException(
              'For image type variables, var_data must contain url and caption as strings',
            );
          }
          break;
        }
        default:
          throw new BadRequestException(
            `Unsupported variable type: ${variable.var_type}`,
          );
      }
    }
  }

  private validate_JSON_API(
    json_api_data: any,
    variables: function_variables[],
  ) {
    if (!json_api_data || typeof json_api_data !== 'object') {
        throw new BadRequestException('Data must be an object');
    }

    const { headers, req_url, req_type } = json_api_data;
    
    // Initialize body as empty object if not provided
    json_api_data.body = json_api_data.body || {};
    
    // Validate headers
    if (!headers || typeof headers !== 'object') {
        throw new BadRequestException('Data.headers must be a valid object');
    }

    // Validate required URL and type
    if (!req_url || typeof req_url !== 'string') {
        throw new BadRequestException('req_url is required and must be a string');
    }

    if (!req_type || typeof req_type !== 'string') {
        throw new BadRequestException('req_type is required and must be a string');
    }

    for (const variable of variables) {
      if (
        !variable.var_id ||
        !variable.var_name ||
        !variable.var_reason ||
        !variable.var_type ||
        variable.var_default === undefined
      ) {
        throw new BadRequestException(
          'Missing required fields in function variables',
        );
      }
    }
  }

  private validateFormVariables(variables: form_variables[]) {
    for (const variable of variables) {
      if (
        !variable.var_id ||
        !variable.var_name ||
        !variable.var_reason ||
        !variable.var_type
      ) {
        throw new BadRequestException(
          'Missing required fields in form variables',
        );
      }
    }
  }

  private validateFunctionVariables(variables: function_variables[]) {
    for (const variable of variables) {
      if (
        !variable.var_id ||
        !variable.var_name ||
        !variable.var_reason ||
        !variable.var_type ||
        variable.var_default === undefined
      ) {
        throw new BadRequestException(
          'Missing required fields in function variables',
        );
      }
    }
  }

  private validateFunctionData(dto: CreateFunctionDto | UpdateFunctionDto, isUpdate: boolean = false) {
    // For create operation, validate all required fields
    if (!isUpdate) {
      if (!dto.name || !dto.purpose || !dto.trigger_reason) {
        throw new BadRequestException(
          'Missing required fields: name, purpose, or trigger_reason',
        );
      }

      if (!dto?.assistant_id) {
        throw new BadRequestException('Missing assistant_id');
      }
    }

    // For update operation, only validate provided fields
    if (dto.variables) {
      if (!Array.isArray(dto.variables)) {
        throw new BadRequestException('Variables must be a non-empty array');
      }

      switch (dto.type) {
        case FunctionType.FLOWS:
          this.validateFlowVariables(dto.variables as flow_variables[]);
          break;
        case FunctionType.JSON_API:
          if (!dto.data) {
            throw new BadRequestException('Invalid or missing data object');
          }
          this.validate_JSON_API(dto.data, dto.variables as function_variables[]);
          break;
        case FunctionType.FORM:
          this.validateFormVariables(dto.variables as form_variables[]);
          break;
        case FunctionType.FUNCTION:
          this.validateFunctionVariables(dto.variables as function_variables[]);
          break;
        default:
          if (dto.type) {  // Only throw if type is provided but invalid
            throw new BadRequestException('Invalid function type');
          }
      }
    }
  }

  async createFunction(createFunctionDto: CreateFunctionDto, user_id: string) {
    this.validateFunctionData(createFunctionDto);
    createFunctionDto.created_by = user_id;
    const { data, error } = await this.supabaseService
      .getClient()
      .from('functions')
      .insert([createFunctionDto])
      .select()
      .single();
    if (error) {
      if (error.code === '23503') {
        throw new BadRequestException('Referenced IDs do not exist');
      }
      throw new BadRequestException(error.message);
    }

    return data;
  }

  async getAllFunctions(_user: any) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('functions')
      .select('*')
      .eq('created_by', _user);

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getFunctionById(id: string, user_id: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('functions')
      .select('*')
      .or(`created_by.eq.${id},assistant_id.eq.${id},id.eq.${id}`)
      .eq('created_by', user_id);

    if (error) throw new BadRequestException(error.message);
    if (!data || data.length === 0) throw new NotFoundException(`Function with ID ${id} not found`);
    return data[0]; // Return the first matching function
  }

  async updateFunction(
    id: string,
    updateFunctionDto: UpdateFunctionDto,
    user_id: string,
  ) {
    await this.getFunctionById(id, user_id);

    this.validateFunctionData(updateFunctionDto, true);  // Pass true for update operation

    const { data, error } = await this.supabaseService
      .getClient()
      .from('functions')
      .update(updateFunctionDto)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23503') {
        throw new BadRequestException('Referenced IDs do not exist');
      }
      throw new BadRequestException(error.message);
    }

    return data;
  }

  async deleteFunction(id: string, user_id: string) {
    // First get the function to include in response
    const { data: function_to_delete } = await this.supabaseService
      .getClient()
      .from('functions')
      .select('*')
      .eq('id', id)
      .single();

    if (!function_to_delete) {
      throw new NotFoundException(`Function with ID ${id} not found`);
    }

    const { error } = await this.supabaseService
      .getClient()
      .from('functions')
      .delete()
      .eq('id', id)
      .eq('created_by', user_id);

    if (error) throw new BadRequestException(error.message);

    return {
      message: `Function "${function_to_delete.name}" deleted successfully`,
      deleted_function: function_to_delete
    };
  }

  async uploadFiles(files: Express.Multer.File, user_id: string) {
    return this.supabaseService.uploadFiles(files, user_id);
  }

  async updateFunctionStatus(id: string, status: boolean, user_id: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('functions')
      .update({ is_active: status })
      .eq('id', id)
      .eq('created_by', user_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Function with ID ${id} not found`);

    return data;
  }

  async getFunctionsByAssistantId(assistant_id: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('functions')
      .select('*')
      .eq('assistant_id', assistant_id);

    if (error) throw new BadRequestException(error.message);
    if (!data || data.length === 0) {
      throw new NotFoundException(`No functions found for assistant_id: ${assistant_id}`);
    }
    return data; // Return all matching functions
  }

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

  async updateAllDefaultFunctions(userId: string): Promise<{ updated: number, message: string }> {
    try {
      // Check if user is admin
      const isAdmin = await this.checkAdminAccess(userId);
      if (!isAdmin) {
        throw new ForbiddenException('Only administrators can update default functions');
      }

      // Get all voice agents
      const { data: voiceAgents, error: fetchError } = await this.supabaseService
        .getClient()
        .from('voice_agents')
        .select('id, created_by');

      if (fetchError) throw fetchError;

      let updatedCount = 0;
      
      for (const agent of voiceAgents) {
        // Get the default functions for this voice agent
        const defaultFunctions = createDefaultFunctions(agent.created_by, agent.id);
        const defaultFunctionNames = defaultFunctions.map(f => f.name);

        // Get existing functions for this agent that match default function names
        const { data: existingFunctions } = await this.supabaseService
          .getClient()
          .from('functions')
          .select('*')
          .eq('assistant_id', agent.id)
          .in('name', defaultFunctionNames);

        // Update each default function
        for (const defaultFunc of defaultFunctions) {
          const existingFunc = existingFunctions?.find(f => f.name === defaultFunc.name);
          
          if (existingFunc) {
            // Update everything except created_by and assistant_id
            const { error: updateError } = await this.supabaseService
              .getClient()
              .from('functions')
              .update({
                ...defaultFunc,
                type: defaultFunc.type,
                purpose: defaultFunc.purpose,
                trigger_reason: defaultFunc.trigger_reason,
                variables: defaultFunc.variables,
                data: defaultFunc.data,
                is_active: defaultFunc.is_active,
                save_data: defaultFunc.save_data,
                is_shownable: defaultFunc.is_shownable
              })
              .eq('id', existingFunc.id);

            if (!updateError) updatedCount++;
          } else {
            // Insert new function if it doesn't exist
            const { error: insertError } = await this.supabaseService
              .getClient()
              .from('functions')
              .insert([defaultFunc]);

            if (!insertError) updatedCount++;
          }
        }
      }

      return {
        updated: updatedCount,
        message: `Successfully updated ${updatedCount} default functions across all voice agents`
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new Error(`Failed to update default functions: ${error.message}`);
    }
  }
}
