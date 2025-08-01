import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';

dotenv.config();

export interface FunctionVariable {
  var_id: string;
  var_name: string;
  var_type: string;
  var_reason: string;
  var_default: string | boolean;
}

export interface DefaultFunction {
  id: string;
  type: 'function' | 'flows' | 'json_api' | 'form';
  data: any;
  created_by: string;
  assistant_id: string;
  is_active: boolean;
  name: string;
  purpose: string;
  trigger_reason: string;
  variables: FunctionVariable[];
  save_data: boolean;
  is_shownable: boolean | null;
}

export const createDefaultFunctions = (created_by: string, assistant_id: string): DefaultFunction[] => {
  const baseUrl = process.env.BASE_URL;
  
  const defaultFunctions: DefaultFunction[] = [
    {
      id: uuidv4(),
      type: "json_api",
      data: {
        headers: {
          "Authorization": "Bearer {{auth_token}}"
        },
        body: {
          "voiceAgentId": "{{voice_agent_id}}",
          "query": "{{query}}"
        },
        req_url: `${baseUrl}/context`,
        req_type: "POST"
      },
      created_by,
      assistant_id,
      is_active: true,
      name: 'query_company_info',
      purpose: 'Search through company knowledge base for relevant information',
      trigger_reason: 'when user asks a question related to company or business',
      variables: [
        {
          var_id: '1',
          var_name: 'query',
          var_type: 'text',
          var_reason: 'The search query about company information',
          var_default: 'true'
        },
        
      ],
      save_data: false,
      is_shownable: null
    },
    {
      id: uuidv4(),
      type: "function",
      data: null,
      created_by,
      assistant_id,
      is_active: true,
      name: 'end_call',
      purpose: 'End the current call session',
      trigger_reason: 'when the conversation needs to be terminated or the user requests to end the call',
      variables: [
        {
          var_id: '1',
          var_name: 'end_call',
          var_type: 'text',
          var_reason: 'this allows the assistant to hang up the call',
          var_default: 'true'
        }
      ],
      save_data: false,
      is_shownable: null
    },
    {
      id: uuidv4(),
      type: "json_api",
      data: {
        headers: {
          "Content-Type": "application/json"
        },
        body: {
          "name": "{{name}}",
          "phone_number": "{{phone_number}}",
          "service": "{{service}}",
          "schedule_time": "{{schedule_time}}",
          "special_notes": "{{special_notes}}",
          "voice_agent_id": "{{voice_agent_id}}"
        },
        req_url: `${baseUrl}/appointments`,
        req_type: "POST"
      },
      created_by,
      assistant_id,
      is_active: true,
      name: 'schedule_appointment',
      purpose: 'Schedule a new appointment/meeting with a patient/client',
      trigger_reason: 'when user wants to schedule or book an appointment',
      variables: [
        {
          var_id: '1',
          var_name: 'name',
          var_type: 'text',
          var_reason: 'Full name of the Patient/client/customer',
          var_default: 'true'
        },
        {
          var_id: '2',
          var_name: 'phone_number',
          var_type: 'text',
          var_reason: 'Contact phone number of the Patient/client/customer',
          var_default: 'true'
        },
        {
          var_id: '3',
          var_name: 'service',
          var_type: 'text',
          var_reason: 'Type of service required',
          var_default: 'true'
        },
        {
          var_id: '4',
          var_name: 'schedule_time',
          var_type: 'text',
          var_reason: 'The scheduled appointment date and time in ISO format',
          var_default: 'true'
        },
        {
          var_id: '5',
          var_name: 'special_notes',
          var_type: 'text',
          var_reason: 'Any additional instructions or special notes for the appointment',
          var_default: 'true'
        }
      ],
      save_data: true,
      is_shownable: null
    },
    {
      id: uuidv4(),
      type: "json_api",
      data: {
        headers: {
          "Content-Type": "application/json"
        },
        query: {
          "voice_agent_id": "{{voice_agent_id}}",
          "date": "{{date}}"
        },
        req_url: `${baseUrl}/appointments/booked-slots`,
        req_type: "GET"
      },
      created_by,
      assistant_id,
      is_active: true,
      name: 'get_booked_slots',
      purpose: 'Retrieve booked appointment slots for scheduling',
      trigger_reason: 'when checking availability for appointment scheduling or when user asks about available time slots',
      variables: [
        {
          var_id: '1',
          var_name: 'date',
          var_type: 'text',
          var_reason: 'The date to check for booked slots (YYYY-MM-DD format)',
          var_default: 'true'
        }
      ],
      save_data: false,
      is_shownable: null
    },
    {
      id: uuidv4(),
      type: "function",
      data: null,
      created_by,
      assistant_id,
      is_active: true,
      name: 'get_current_time',
      purpose: 'Get the current date, time, and day of the week',
      trigger_reason: 'when the user asks about current time, date, or day of the week',
      variables: [
        {
          var_id: '1',
          var_name: 'current_time',
          var_type: 'text',
          var_reason: 'Returns the current date and time information',
          var_default: 'true'
        }
      ],
      save_data: false,
      is_shownable: null
    },
    {
      id: uuidv4(),
      type: "json_api",
      data: {
        headers: {
          "Authorization": "Bearer {{auth_token}}"
        },
        query: {
          "phone_number": "{{phone_number}}",
          "voice_agent_id": "{{voice_agent_id}}"
        },
        req_url: `${baseUrl}/appointments/by-phone`,
        req_type: "GET"
      },
      created_by,
      assistant_id,
      is_active: true,
      name: 'get_appointments_by_phone',
      purpose: 'Retrieve appointments associated with a phone number',
      trigger_reason: 'when checking existing appointments for a caller or when user asks about their appointments',
      variables: [
        {
          var_id: '1',
          var_name: 'phone_number',
          var_type: 'text',
          var_reason: 'The phone number to search for appointments',
          var_default: 'true'
        }
      ],
      save_data: false,
      is_shownable: null
    },
    {
      id: uuidv4(),
      type: "json_api",
      data: {
        headers: {
          "Content-Type": "application/json"
        },
        body: {
          "id": "{{appointment_id}}",
          "name": "{{name}}",
          "phone_number": "{{phone_number}}",
          "schedule_time": "{{schedule_time}}",
          "status": "{{status}}",
          "service": "{{service}}",
          "special_notes": "{{special_notes}}"
        },
        req_url: `${baseUrl}/appointments`,
        req_type: "PATCH"
      },
      created_by,
      assistant_id,
      is_active: true,
      name: 'update_appointment',
      purpose: 'Update appointment details including name, phone, status, time, service, or special_notes',
      trigger_reason: 'when user wants to modify appointment details, reschedule, cancel, or complete an appointment',
      variables: [
        {
          var_id: '1',
          var_name: 'appointment_id',
          var_type: 'text',
          var_reason: 'The unique identifier of the appointment (REQUIRED - must provide to update an appointment)',
          var_default: 'true'
        },
        {
          var_id: '2',
          var_name: 'name',
          var_type: 'text',
          var_reason: 'Updated name of the Patient/client/customer (optional)',
          var_default: 'true'
        },
        {
          var_id: '3',
          var_name: 'phone_number',
          var_type: 'text',
          var_reason: 'Updated contact phone number (optional)',
          var_default: 'true'
        },
        {
          var_id: '4',
          var_name: 'schedule_time',
          var_type: 'text',
          var_reason: 'Updated appointment date and time in ISO format (optional)',
          var_default: 'true'
        },
        {
          var_id: '5',
          var_name: 'status',
          var_type: 'text',
          var_reason: 'Updated appointment status (pending, missed, completed, cancelled) (optional)',
          var_default: 'true'
        },
        {
          var_id: '6',
          var_name: 'service',
          var_type: 'text',
          var_reason: 'Updated type of service required (optional)',
          var_default: 'true'
        },
        {
          var_id: '7',
          var_name: 'special_notes',
          var_type: 'text',
          var_reason: 'Updated special instructions or notes (optional)',
          var_default: 'true'
        }
      ],
      save_data: true,
      is_shownable: null
    }
  ];

  return defaultFunctions;
};
