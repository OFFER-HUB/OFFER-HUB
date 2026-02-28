import { IsString, IsOptional, MaxLength } from 'class-validator';

export class HireServiceDto {
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  requirements?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
