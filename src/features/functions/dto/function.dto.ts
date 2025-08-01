import {
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
  IsObject,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum FunctionType {
  FLOWS = 'flows',
  FUNCTION = 'function',
  FORM = 'form',
  JSON_API = 'json_api',
}

export class json_api {
  @IsObject()
  body: Record<string, any> = {}; // Making it clearer that an empty object is valid

  @IsString()
  type: string;

  @IsObject()
  headers: Record<string, string>;

  @IsString()
  req_url: string; 

  @IsString()
  req_type: string;  

  @IsOptional()
  @IsObject()
  query?: Record<string, any>;  

  @IsOptional()
  @IsObject()
  path_params?: Record<string, string>;  // Added path_params field
}

export interface flow_variables {
  var_type: string;
  var_data: string | { url: string; caption: string };
}

export interface form_variables {
  var_id: string;
  var_name: string;
  var_reason: string;
  var_type: string;
}

export interface function_variables {
  var_id: string;
  var_name: string;
  var_reason: string;
  var_default: string;
  var_type: string;
}

export class CreateFunctionDto {
  @IsEnum(FunctionType)
  type: FunctionType;

  name: string;
  purpose: string;
  trigger_reason: string;

  @IsUUID()
  @IsOptional()
  created_by?: string;

  @IsUUID()
  @IsOptional()
  assistant_id?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  data: json_api | [flow_variables];

  variables: [flow_variables] | [function_variables] | [form_variables];
}

export class UpdateFunctionDto extends CreateFunctionDto {}
