import { IsString, IsOptional, MinLength, IsEnum, Matches, IsDateString } from 'class-validator';
import { ServiceCategory, OfferStatus } from '@prisma/client';

export class UpdateOfferDto {
  @IsString()
  @IsOptional()
  @MinLength(10, { message: 'Title must be at least 10 characters' })
  title?: string;

  @IsString()
  @IsOptional()
  @MinLength(50, { message: 'Description must be at least 50 characters' })
  description?: string;

  @IsEnum(ServiceCategory)
  @IsOptional()
  category?: ServiceCategory;

  @IsString()
  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'Budget must be a valid decimal number' })
  budget?: string;

  @IsDateString()
  @IsOptional()
  deadline?: string;
}

export class UpdateOfferStatusDto {
  @IsEnum(OfferStatus)
  status!: OfferStatus;
}
