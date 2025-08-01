export interface FunctionDataResponse {
  name: string;
  purpose: string;
  trigger_reason: string;
  variables: {
    var_name: string;
    var_reason: string;
    var_default: string;
  }[];
  data: Record<string, any>;
}
