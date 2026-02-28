import { IsString, IsNotEmpty, MinLength, IsEnum, Matches, IsDateString } from 'class-validator';
import { ServiceCategory } from '@prisma/client';

export class CreateOfferDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Title must be at least 10 characters' })
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(50, { message: 'Description must be at least 50 characters' })
  description!: string;

  @IsEnum(ServiceCategory)
  category!: ServiceCategory;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'Budget must be a valid decimal number' })
  budget!: string;

  @IsDateString()
  deadline!: string;
}
