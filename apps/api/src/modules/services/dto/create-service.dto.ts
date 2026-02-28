import { IsString, IsNotEmpty, IsEnum, IsInt, Min, Max, Matches } from 'class-validator';

export enum ServiceCategory {
  WEB_DEVELOPMENT = 'WEB_DEVELOPMENT',
  MOBILE_DEVELOPMENT = 'MOBILE_DEVELOPMENT',
  DESIGN = 'DESIGN',
  WRITING = 'WRITING',
  MARKETING = 'MARKETING',
  VIDEO = 'VIDEO',
  MUSIC = 'MUSIC',
  DATA = 'DATA',
  OTHER = 'OTHER',
}

/**
 * DTO for creating a new service.
 */
export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(ServiceCategory)
  category!: ServiceCategory;

  @IsString()
  @Matches(/^\d+\.\d{2}$/, {
    message: 'Price must be a decimal string with exactly 2 decimal places (e.g., "100.50")',
  })
  price!: string;

  @IsInt()
  @Min(1)
  @Max(365)
  deliveryDays!: number;
}
