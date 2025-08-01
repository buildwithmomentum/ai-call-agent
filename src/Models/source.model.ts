export interface Source {
  id: string;
  created_at: Date;
  voice_agent_id: string;
  name: string;
  source_type?: string;
  size: number;
  url?: string;
  auto: boolean;
  auto_sync_interval?: string;
  auto_sync_last_trained?: Date;
  last_modified?: Date;
  status: SourceTrainingStatus;
}

export type SourceTrainingStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface SourceCreateDTO
  extends Omit<Source, 'id' | 'created_at' | 'last_modified' | 'status'> {
  id?: string;
  status?: SourceTrainingStatus;
}

export interface SourceUpdateDTO extends Partial<SourceCreateDTO> {
  id: string;
}

export interface SourceStatusUpdateDTO {
  status: SourceTrainingStatus;
}

export const defaultSource: Partial<Source> = {
  name: 'Default Source',
  source_type: 'default',
  size: 0,
  auto: false,
  auto_sync_interval: 'none',
  status: 'pending' as SourceTrainingStatus,
};
