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