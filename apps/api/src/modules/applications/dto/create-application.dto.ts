import { IsString, IsNotEmpty, MinLength, IsOptional, Matches } from 'class-validator';

export class CreateApplicationDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(50, { message: 'Cover letter must be at least 50 characters' })
  coverLetter!: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'Proposed rate must be a valid decimal number' })
  proposedRate?: string;
}
