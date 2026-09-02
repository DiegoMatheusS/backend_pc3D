import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CriarHardwareDto } from '../../hardwares/dtos/criar-hardware.dto';

export class CadastrarHardwareDescobertoDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  idTemporario?: string;

  @ValidateNested()
  @Type(() => CriarHardwareDto)
  payload!: CriarHardwareDto;
}

export class CadastrarHardwaresDescobertosLoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CadastrarHardwareDescobertoDto)
  itens!: CadastrarHardwareDescobertoDto[];
}
