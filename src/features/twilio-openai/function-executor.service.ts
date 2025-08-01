import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CallSessionService } from './call-session.service';
import * as dotenv from 'dotenv';
import { TwilioPhoneService } from './twilio-phone.service';
import { SupabaseService } from '../../utils/supabase/supabaseClient';

// Load environment variables from .env file
dotenv.config();

// Define types for function execution results
export interface FunctionSuccessResult {
  status: 'success';
  data: Array<{
    context: string;
    metadata: {
      timestamp: string;
      action: string;
      [key: string]: any;
    };
  }>;
}

export interface FunctionErrorResult {
  status: 'error';
  error: string;
}

export type FunctionResult = FunctionSuccessResult | FunctionErrorResult;

@Injectable()
export class FunctionExecutorService {
  private readonly logger = new Logger(FunctionExecutorService.name);
  private readonly supabase;

  constructor(
    private configService: ConfigService,
    private callSessionService: CallSessionService,
    private twilioPhoneService: TwilioPhoneService,
    private supabaseService: SupabaseService,
  ) {
    this.supabase = this.supabaseService.getClient();
    this.logger.log('FunctionExecutorService initialized with database access');
  }

 // Execute function similar to script.js implementation
 async executeFunction(functionCall: any, agentId: string, functionData: any[], streamSid?: string): Promise<FunctionResult> {
  try {
    this.logger.log(`========== EXECUTING FUNCTION: ${functionCall.name} ==========`);
    this.logger.log(`Function arguments: ${functionCall.arguments}`);
    
    // Handle built-in functions
    if (functionCall.name === "end_call") {
      // Return response immediately
      const response: FunctionSuccessResult = {
        status: "success",
        data: [{
          context: "Call ending initiated. Quickly say goodbye before it ends in 5 seconds.",
          metadata: {
            timestamp: new Date().toISOString(),
            action: "end_call",
          },
        }],
      };
      
      // Set a timeout to end the call after 5 seconds
      if (streamSid) {
        this.logger.log(`Will terminate call with streamSid: ${streamSid} in 5 seconds`);
        setTimeout(() => {
          this.end_call(streamSid);
        }, 5000);
      } else {
        this.logger.warn('No streamSid provided for end_call function. Cannot terminate the actual call.');
      }
      
      return response;
    }
    
    if (functionCall.name === "get_current_time") {
      return this.handleGetCurrentTime();
    }

    return await this.handleCustomFunction(functionCall, agentId, functionData);
  } catch (error) {
    this.logger.error(`Function execution error: ${error.message}`);
    return { 
      status: "error", 
      error: error.message 
    };
  }
}

private end_call(streamSid?: string): FunctionSuccessResult {
  // Log that we're executing the function
  this.logger.log('Executing built-in end_call function');
  
  // Execute the call termination immediately since delay is handled in the caller
  if (streamSid) {
    this.logger.log(`Terminating call with streamSid: ${streamSid}`);
    this.terminateCall(streamSid);
  } else {
    this.logger.warn('No streamSid provided for end_call function. Cannot terminate the actual call.');
  }
  
  // Return a synchronous result
  return {
    status: "success",
    data: [{
      context: "Call ending initiated. Quickly say goodbye before it ends.",
      metadata: {
        timestamp: new Date().toISOString(),
        action: "end_call",
      },
    }],
  };
}

// This method now only handles the Twilio API call to terminate the call
private async terminateCall(streamSid?: string): Promise<void> {
  // If we have a streamSid passed directly, use it, otherwise we'd need
  // to get it from the current context (not implemented here)
  if (!streamSid) {
    // For now, let's log that we're missing the streamSid
    this.logger.warn('No streamSid provided for call termination. Need to implement call context tracking.');
    return;
  }
  
  const session = this.callSessionService.getSessionByStreamSid(streamSid);
  if (!session || !session.callSid) {
    this.logger.error('Cannot terminate call: no active session found or call SID missing');
    return;
  }
  
  try {
    // Get the Twilio credentials from the database using the agent ID
    const { data: voiceAgent, error } = await this.supabase
      .from('voice_agents')
      .select('twilio_credentials')
      .eq('id', session.agentId)
      .single();
    
    if (error || !voiceAgent) {
      this.logger.error(`Error fetching Twilio credentials: ${error?.message || 'No voice agent found'}`);
      return;
    }
    
    // Extract the credentials from the voice agent record
    const twilioCredentials = voiceAgent.twilio_credentials;
    
    if (!twilioCredentials || !twilioCredentials.account_sid || !twilioCredentials.auth_token) {
      this.logger.error(`Voice agent ${session.agentId} has missing or invalid Twilio credentials`);
      return;
    }
    
    const twilioAccountSid = twilioCredentials.account_sid;
    const twilioAuthToken = twilioCredentials.auth_token;
    
    // Log the credentials being used (mask the auth token for security)
    const maskedAuthToken = twilioAuthToken ? 
      `${twilioAuthToken.substring(0, 4)}...${twilioAuthToken.substring(twilioAuthToken.length - 4)}` : 
      'undefined';
    this.logger.log(`Using Twilio credentials from database - Account SID: ${twilioAccountSid}, Auth Token: ${maskedAuthToken}`);
    
    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls/${session.callSid}.json`;
    this.logger.log(`Making request to Twilio API: ${url}`);
    
    // Create Basic Auth header
    const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`
      },
      body: 'Status=completed'
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Failed to terminate call: ${response.status} ${response.statusText} - ${errorText}`);
      
      // Give more specific guidance for common error codes
      if (response.status === 401) {
        this.logger.error(`Authentication error: Please check that the Twilio credentials for agent ${session.agentId} are correct in the database.`);
      } else if (response.status === 404) {
        this.logger.error(`Call not found: The call with SID ${session.callSid} was not found. It may have already ended.`);
      }
      return;
    }
    
    const responseData = await response.json();
    this.logger.log(`Successfully terminated call with SID: ${session.callSid}`);
    this.logger.log(`Call status is now: ${responseData.status}`);
  } catch (error) {
    this.logger.error(`Error when terminating call: ${error.message}`);
    this.logger.error(`Stack trace: ${error.stack}`);
  }
}

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

  private async handleCustomFunction(functionCall: any, agentId: string, functionData: any[]): Promise<FunctionResult> {
    // Find the matching function configuration
    const funcData = functionData.find((f) => f.name === functionCall.name);
    if (!funcData) {
      this.logger.error(`No configuration found for function: ${functionCall.name}`);
      return { 
        status: "error", 
        error: `No configuration found for function: ${functionCall.name}` 
      };
    }

    this.logger.log(`Found function configuration for ${functionCall.name}`);
    this.logger.log(`Function description: ${funcData.description || 'No description'}`);
    
    return await this.executeHttpRequest(functionCall, agentId, funcData);
  }

  private async executeHttpRequest(functionCall: any, agentId: string, funcData: any): Promise<FunctionResult> {
    const {
      data: { req_url, req_type, body, headers, query },
    } = funcData;
    
    // Parse arguments with proper typing
    let args: Record<string, string> = {};
    try {
      const parsedArgs = JSON.parse(functionCall.arguments);
      if (parsedArgs && typeof parsedArgs === 'object') {
        Object.entries(parsedArgs).forEach(([key, value]) => {
          args[key] = String(value);
        });
      }
      this.logger.log(`Parsed arguments: ${JSON.stringify(args)}`);
    } catch (error) {
      this.logger.error(`Error parsing function arguments: ${error.message}`);
      args = {};
    }

    // Handle request based on method type and body requirements
    const requestOptions: RequestInit = {
      method: req_type,
      headers: { ...headers, "Content-Type": "application/json" },
    };

    // Handle POST, PATCH, PUT requests with body
    if (["POST", "PATCH", "PUT"].includes(req_type.toUpperCase()) && body) {
      let processedBody = { ...body };  // Clone the body object

      // Process each field in the body recursively
      const processBodyField = (obj: Record<string, any>) => {
        Object.keys(obj).forEach(key => {
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            processBodyField(obj[key]); // Recursively process nested objects
          } else if (typeof obj[key] === 'string') {
            // Replace placeholders in string values
            obj[key] = obj[key].replace(/{{voice_agent_id}}/g, agentId);
            
            // Replace other argument placeholders
            Object.entries(args).forEach(([argKey, argValue]) => {
              obj[key] = obj[key].replace(`{{${argKey}}}`, argValue);
            });
          }
        });
      };

      processBodyField(processedBody);
      requestOptions.body = JSON.stringify(processedBody);
      this.logger.log(`Request body: ${requestOptions.body}`);
    }

    // Replace voice_agent_id in the base URL first
    let finalUrl = req_url.replace(/{{voice_agent_id}}/g, agentId);

    // Handle GET requests with query parameters
    if (req_type.toUpperCase() === "GET" && (query || Object.keys(args).length > 0)) {
      let queryParams = new URLSearchParams();

      if (query) {
        let queryConfig = { ...query };
        Object.entries(queryConfig).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            let processedValue = String(value).replace(/{{voice_agent_id}}/g, agentId);
            
            // Replace other argument placeholders
            Object.entries(args).forEach(([argKey, argValue]) => {
              processedValue = processedValue.replace(`{{${argKey}}}`, argValue);
            });
            
            queryParams.append(key, processedValue);
          }
        });
      }

      // Add remaining args to query params
      Object.entries(args).forEach(([key, value]) => {
        if (!queryParams.has(key)) {
          queryParams.append(key, value);
        }
      });

      finalUrl = `${finalUrl}${finalUrl.includes("?") ? "&" : "?"}${queryParams.toString()}`;
    }

    this.logger.log(`Executing ${functionCall.name} with URL: ${finalUrl}`);
    this.logger.log(`Request method: ${req_type}`);
    this.logger.log(`Request headers: ${JSON.stringify(requestOptions.headers)}`);

    try {
      const response = await fetch(finalUrl, requestOptions);
      this.logger.log(`${functionCall.name} Response Status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`API call failed with status: ${response.status}, message: ${errorText}`);
        return { 
          status: "error", 
          error: `API call failed with status: ${response.status}` 
        };
      }

      const result = await response.json();
      this.logger.log(`${functionCall.name} Response Data: ${JSON.stringify(result)}`);

      // Format the response in a consistent way for the AI
      return {
        status: "success",
        data: [
          {
            context:
              typeof result === "string"
                ? result
                : result.bookedSlots
                ? JSON.stringify(result.bookedSlots)
                : Array.isArray(result)
                ? result.map((item) => item.context || item).join("\n")
                : JSON.stringify(result),
            metadata: {
              timestamp: new Date().toISOString(),
              action: functionCall.name,
            },
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Network or parsing error: ${error.message}`);
      return { 
        status: "error", 
        error: `Network or parsing error: ${error.message}` 
      };
    }
  }
}
