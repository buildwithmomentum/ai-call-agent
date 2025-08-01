import { Injectable, Logger } from '@nestjs/common';
import { FunctionsService } from '../functions/functions.service';
import { FunctionSuccessResult, FunctionResult } from './types/Functionexecution.type';
import axios from 'axios';

@Injectable()
export class FunctionExecutorService {
  private readonly logger = new Logger(FunctionExecutorService.name);
  private functionsData: any[] = [];
  private voiceAgentId: string | null = null;

  constructor(private readonly functionsService: FunctionsService) {}

  /**
   * Set the functions data used to execute function calls
   */
  setFunctionsData(functions: any[]) {
    this.logger.log('Setting functions data in FunctionExecutorService');
    this.functionsData = functions || [];
  }

  /**
   * Get the functions data
   */
  getFunctionsData(): any[] {
    return this.functionsData;
  }

  /**
   * Set the voice agent ID for the current conversation
   */
  setVoiceAgentId(id: string) {
    this.logger.log(`Setting voiceAgentId: ${id}`);
    this.voiceAgentId = id;
  }

  /**
   * Get the current voice agent ID
   */
  getVoiceAgentId(): string | null {
    return this.voiceAgentId;
  }

  /**
   * Execute a function call based on the tool call from LLM
   */
  async executeFunction(toolCall: any): Promise<any> {
    try {
      if (!toolCall || !toolCall.function || !toolCall.function.name) {
        this.logger.error('Invalid tool call format');
        return { error: 'Invalid tool call format' };
      }

      const functionName = toolCall.function.name;
      let args: any = {};
      
      try {
        args = JSON.parse(toolCall.function.arguments || '{}');
      } catch (error) {
        this.logger.error(`Error parsing arguments: ${error.message}`);
        return { error: `Invalid function arguments: ${error.message}` };
      }

      console.log('\n===== TOOL CALL RECEIVED =====');
      console.log(`Function: ${functionName}`);
      console.log(`Arguments: ${JSON.stringify(args, null, 2)}`);
      console.log('===============================');
      
      this.logger.log(`Executing function: ${functionName} with args: ${JSON.stringify(args)}`);

      // Find the function metadata from the stored functions data
      const functionData = this.functionsData.find(func => func.name === functionName);
      
      if (!functionData) {
        this.logger.warn(`Function not found: ${functionName}`);
        console.log('\n===== FUNCTION NOT FOUND =====');
        console.log(`No function metadata found for: ${functionName}`);
        console.log('Available functions:');
        console.log(this.functionsData.map(f => f.name).join(', '));
        console.log('===============================\n');
        return { error: `Function '${functionName}' not found` };
      }

      console.log('\n===== FUNCTION METADATA =====');
      console.log(JSON.stringify({
        name: functionData.name,
        purpose: functionData.purpose,
        data: functionData.data
      }, null, 2));
      console.log('=============================\n');

      return await this.executeHttpRequest(functionData, args);
    } catch (error) {
      this.logger.error(`Error executing function: ${error.message}`);
      return { error: error.message };
    }
  }

  /**
   * Execute internal functions or delegate to external function execution
   */
  async executeInternalFunction(functionCall: any, agentId: string, functionData: any[], streamSid?: string): Promise<FunctionResult> {
    try {
      // Set the voice agent ID for the current execution
      if (agentId) {
        this.setVoiceAgentId(agentId);
      }
      
      // Set the functions data for this execution if provided
      if (functionData && functionData.length > 0) {
        this.setFunctionsData(functionData);
      }
      
      // Check for internal functions
      if (functionCall.name === "get_current_time") {
        return this.handleGetCurrentTime();
      }
      
      // Default to external function execution
      const toolCall = {
        function: {
          name: functionCall.name,
          arguments: JSON.stringify(functionCall.arguments || {})
        }
      };
      
      const result = await this.executeFunction(toolCall);
      
      if (result.error) {
        return {
          status: "error",
          error: result.error
        };
      }
      
      return {
        status: "success",
        data: [
          {
            context: JSON.stringify(result),
            metadata: {
              timestamp: new Date().toISOString(),
              action: functionCall.name,
              result: result
            }
          }
        ]
      };
    } catch (error) {
      this.logger.error(`Function execution error: ${error.message}`);
      return { 
        status: "error", 
        error: error.message 
      };
    }
  }

  /**
   * Handle get_current_time internal function
   */
  private handleGetCurrentTime(): FunctionSuccessResult {
    this.logger.log('Executing built-in get_current_time function');
    const now = new Date();
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const day = daysOfWeek[now.getDay()];
    const offset = -now.getTimezoneOffset() / 60;
    const offsetStr = offset >= 0 ? `+${offset}` : `${offset}`;
    const formattedDateTime = now.toLocaleString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
    
    const result: FunctionSuccessResult = {
      status: "success",
      data: [{
        context: `The current time is ${formattedDateTime} GMT${offsetStr}. Today is ${day}.`,
        metadata: {
          timestamp: new Date().toISOString(),
          action: "get_current_time",
          timeData: {
            dayOfWeek: day,
            formattedDateTime: formattedDateTime,
            timeZone: `GMT${offsetStr}`,
            iso8601: now.toISOString(),
          },
        },
      }],
    };
    
    this.logger.log(`get_current_time result: ${JSON.stringify(result.data[0].context)}`);
    return result;
  }

  /**
   * Execute an HTTP request based on function metadata
   */
  private async executeHttpRequest(functionData: any, args: any): Promise<any> {
    try {
      if (!functionData.data) {
        this.logger.error('Function data is missing data property');
        return { error: 'Invalid function configuration: missing data property' };
      }

      const { req_url, req_type, headers: rawHeaders, body: rawBody, query: rawQuery } = functionData.data;
      
      if (!req_url || !req_type) {
        this.logger.error('Function data is missing required properties (req_url or req_type)');
        return { error: 'Invalid function configuration: missing required properties' };
      }

      // Prepare headers with variable substitution
      const headers = this.prepareRequestData(rawHeaders || {}, args);
      
      // Prepare body/params with variable substitution
      const requestData = this.prepareRequestData(rawBody || {}, args);

      // Start with base URL and replace any placeholders
      let finalUrl = this.replaceVariables(req_url, args);
      
      // Handle GET requests with query parameters
      if (req_type.toUpperCase() === "GET") {
        const queryParams = new URLSearchParams();
        
        // First add any query parameters from the function configuration
        if (rawQuery) {
          const processedQuery = this.prepareRequestData(rawQuery, args);
          Object.entries(processedQuery).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              // Ensure voice_agent_id gets replaced
              let stringValue = String(value);
              if (stringValue.includes('{{voice_agent_id}}')) {
                stringValue = stringValue.replace(/{{voice_agent_id}}/g, this.voiceAgentId || '');
              }
              queryParams.append(key, stringValue);
            }
          });
        }
        
        // For GET requests, also add args that weren't used in the URL or explicit query config
        // This allows passing arguments directly as query parameters
        Object.entries(args).forEach(([key, value]) => {
          // Only add if not already in the query params
          if (!queryParams.has(key) && value !== undefined && value !== null) {
            // Check if the value contains voice_agent_id and replace if needed
            let stringValue = String(value);
            if (stringValue.includes('{{voice_agent_id}}')) {
              stringValue = stringValue.replace(/{{voice_agent_id}}/g, this.voiceAgentId || '');
            }
            queryParams.append(key, stringValue);
          }
        });
        
        // Special case: if voice_agent_id is specifically requested but not provided
        if (rawQuery && rawQuery.voice_agent_id === '{{voice_agent_id}}' && !queryParams.has('voice_agent_id') && this.voiceAgentId) {
          queryParams.append('voice_agent_id', this.voiceAgentId);
        }
        
        // Append query parameters to URL if there are any
        const queryString = queryParams.toString();
        if (queryString) {
          finalUrl = `${finalUrl}${finalUrl.includes("?") ? "&" : "?"}${queryString}`;
        }
      }
      
      // Log the request details
      console.log('\n===== FUNCTION EXECUTION =====');
      console.log(`Request: ${req_type.toUpperCase()} ${finalUrl}`);
      console.log(`Headers: ${JSON.stringify(headers, null, 2)}`);
      if (req_type.toUpperCase() !== "GET") {
        console.log(`Payload: ${JSON.stringify(requestData, null, 2)}`);
      }
      console.log('=============================');
      
      let response;
      
      // Make the HTTP request based on the request type
      switch (req_type.toUpperCase()) {
        case 'GET':
          response = await this.makeGetRequest(finalUrl, {}, headers); // Empty params as they're already in URL
          break;
        case 'POST':
          response = await this.makePostRequest(finalUrl, requestData, headers);
          break;
        case 'PUT':
          response = await this.makePutRequest(finalUrl, requestData, headers);
          break;
        case 'DELETE':
          response = await this.makeDeleteRequest(finalUrl, {}, headers); // Use URL for DELETE params
          break;
        default:
          this.logger.error(`Unsupported request type: ${req_type}`);
          return { error: `Unsupported request type: ${req_type}` };
      }
      
      // Log the response
      console.log('\n===== FUNCTION RESPONSE =====');
      console.log(JSON.stringify(response, null, 2));
      console.log('=============================\n');
      
      return response;
    } catch (error) {
      this.logger.error(`Error executing HTTP request: ${error.message}`);
      
      // Log the error
      console.log('\n===== FUNCTION ERROR =====');
      console.log(`Error: ${error.message}`);
      console.log('===========================\n');
      
      return { error: error.message };
    }
  }

  /**
   * Replace variables in request data with their values
   */
  private prepareRequestData(data: any, args: any): any {
    if (typeof data === 'string') {
      return this.replaceVariables(data, args);
    } else if (Array.isArray(data)) {
      return data.map(item => this.prepareRequestData(item, args));
    } else if (data && typeof data === 'object') {
      const result = {};
      for (const key in data) {
        result[key] = this.prepareRequestData(data[key], args);
      }
      return result;
    }
    return data;
  }

  /**
   * Replace variable placeholders in a string with their values
   */
  private replaceVariables(text: string, args: any): string {
    if (typeof text !== 'string') return text;

    // Replace args variables
    let result = text;
    for (const key in args) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), args[key]);
    }

    // Replace voice_agent_id with stored voiceAgentId
    result = result.replace(/{{voice_agent_id}}/g, this.voiceAgentId || '');

    return result;
  }

  /**
   * Make a GET request
   */
  private async makeGetRequest(url: string, params: any, headers: any): Promise<any> {
    try {
      const response = await axios.get(url, { params, headers });
      return response.data;
    } catch (error) {
      this.logger.error(`GET request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Make a POST request
   */
  private async makePostRequest(url: string, data: any, headers: any): Promise<any> {
    try {
      const response = await axios.post(url, data, { headers });
      return response.data;
    } catch (error) {
      this.logger.error(`POST request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Make a PUT request
   */
  private async makePutRequest(url: string, data: any, headers: any): Promise<any> {
    try {
      const response = await axios.put(url, data, { headers });
      return response.data;
    } catch (error) {
      this.logger.error(`PUT request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Make a DELETE request
   */
  private async makeDeleteRequest(url: string, params: any, headers: any): Promise<any> {
    try {
      const response = await axios.delete(url, { params, headers });
      return response.data;
    } catch (error) {
      this.logger.error(`DELETE request failed: ${error.message}`);
      throw error;
    }
  }
} 


