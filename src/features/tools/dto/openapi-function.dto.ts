export interface OpenAPIFunction {
  type: 'function' | 'json_api';  // Updated to allow 'json_api'
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}
