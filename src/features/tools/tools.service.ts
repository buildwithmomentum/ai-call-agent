import { Injectable } from '@nestjs/common';
import { FunctionsService } from '../functions/functions.service';
import { OpenAPIFunction } from './dto/openapi-function.dto';
import { FunctionDataResponse } from './dto/function-data.dto';

@Injectable()
export class ToolsService {
  constructor(private readonly functionsService: FunctionsService) {}

  async getTools(assistantId: string): Promise<OpenAPIFunction[]> {
    // Retrieve all functions using the assistant_id
    const functions = await this.functionsService.getFunctionsByAssistantId(assistantId);
    return functions.map(fn => {
      const properties: Record<string, { type: string; description: string }> = {};
      const required: string[] = [];
      // Build properties and required arrays from function variables
      if (fn.variables && Array.isArray(fn.variables)) {
        fn.variables.forEach(variable => {
          properties[variable.var_name] = {
            type: 'string',
            description: variable.var_reason || 'No description provided'
          };
          // Add variable name to "required" if var_default is "true"
          if (variable.var_default === "true") {
            required.push(variable.var_name);
          }
        });
      }
      return {
        type: 'function',
        name: fn.name,
        description: `Purpose: ${fn.purpose}, Triggering reason: ${fn.trigger_reason}`,
        parameters: {
          type: 'object',
          properties,
          required
        }
      };
    });
  }

  async getFunctionData(assistantId: string): Promise<FunctionDataResponse[]> {
    const functions = await this.functionsService.getFunctionsByAssistantId(assistantId);
    return functions.map(fn => ({
      name: fn.name,
      purpose: fn.purpose,
      trigger_reason: fn.trigger_reason,
      variables: fn.variables || [],
      data: fn.data || {}
    }));
  }
}
