import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CategoriaHardware } from '../../generated/prisma/enums';

export class FiltrarHardwaresDto {
  @IsOptional()
  @IsEnum(CategoriaHardware)
  categoria?: CategoriaHardware;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  marca?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  busca?: string;
}
