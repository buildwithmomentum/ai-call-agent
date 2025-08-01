export class TextToSpeechDto {
  text: string;
  voiceId: string;
  modelId?: string = 'eleven_monolingual_v1';
  outputFormat?: string = 'mp3_44100_128';
} 