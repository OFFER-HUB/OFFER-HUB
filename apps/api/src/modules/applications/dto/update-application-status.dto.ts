import { IsEnum } from 'class-validator';
import { ApplicationStatus } from '@prisma/client';

export class UpdateApplicationStatusDto {
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;
}
