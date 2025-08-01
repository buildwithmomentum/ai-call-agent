/**
 * Request DTO for ElevenLabs API
 */
export interface TTSRequestDto {
  text: string;
  model_id: string;
  apply_text_normalization: 'auto' | 'on' | 'off';
  voice_settings?: {
    stability: number;
    style: number;
  };
} 