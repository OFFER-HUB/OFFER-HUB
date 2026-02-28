import { IsString, IsNotEmpty, IsEnum, IsInt, Min, Max, Matches, IsOptional } from 'class-validator';
import { ServiceCategory } from './create-service.dto';

/**
 * DTO for updating an existing service.
 */
export class UpdateServiceDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  title?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  description?: string;

  @IsEnum(ServiceCategory)
  @IsOptional()
  category?: ServiceCategory;

  @IsString()
  @Matches(/^\d+\.\d{2}$/, {
    message: 'Price must be a decimal string with exactly 2 decimal places (e.g., "100.50")',
  })
  @IsOptional()
  price?: string;

  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  deliveryDays?: number;
}
