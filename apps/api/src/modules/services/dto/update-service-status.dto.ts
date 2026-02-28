import { IsEnum } from 'class-validator';

export enum ServiceStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED',
}

/**
 * DTO for updating service status.
 */
export class UpdateServiceStatusDto {
  @IsEnum(ServiceStatus)
  status!: ServiceStatus;
}
