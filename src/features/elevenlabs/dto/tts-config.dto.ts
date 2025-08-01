/**
 * Data Transfer Object for Text-to-Speech configuration
 * Used for configuring ElevenLabs TTS requests
 */
export interface TTSConfigDto {
  /**
   * ID of the voice to use
   */
  voiceId: string;
  
  /**
   * TTS model to use (e.g., eleven_turbo_v2)
   */
  modelId: string;
  
  /**
   * Latency optimization level (0-4)
   * Higher values reduce latency at the cost of quality
   */
  optimizeLatency: number;
  
  /**
   * Audio output format (e.g., mp3_44100_128, ulaw_8000)
   */
  outputFormat: string;
  
  /**
   * How to handle text normalization
   */
  textNormalization: 'auto' | 'on' | 'off';
  
  /**
   * How stable/consistent the voice should be (0-1)
   */
  stability: number;
  
  /**
   * Style factor for more expressive speech (0-1)
   */
  style: number;
} 