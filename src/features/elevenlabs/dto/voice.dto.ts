/**
 * Voice DTO for ElevenLabs API
 */
export interface VoiceDto {
  voice_id: string;
  name: string;
  samples?: {
    sample_id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    hash: string;
  }[];
  category?: string;
  description?: string;
  labels?: Record<string, string>;
  preview_url?: string;
} 