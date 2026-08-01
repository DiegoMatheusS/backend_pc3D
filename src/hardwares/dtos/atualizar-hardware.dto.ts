import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CategoriaHardware } from '../../generated/prisma/enums';
import { CriarEspecificacaoArmazenamentoDto } from './especificacoes/criar-especificacao-armazenamento.dto';
import { CriarEspecificacaoCoolerDto } from './especificacoes/criar-especificacao-cooler.dto';
import { CriarEspecificacaoFonteDto } from './especificacoes/criar-especificacao-fonte.dto';
import { CriarEspecificacaoGabineteDto } from './especificacoes/criar-especificacao-gabinete.dto';
import { CriarEspecificacaoMemoriaRamDto } from './especificacoes/criar-especificacao-memoria-ram.dto';
import { CriarEspecificacaoPlacaMaeDto } from './especificacoes/criar-especificacao-placa-mae.dto';
import { CriarEspecificacaoPlacaVideoDto } from './especificacoes/criar-especificacao-placa-video.dto';
import { CriarEspecificacaoProcessadorDto } from './especificacoes/criar-especificacao-processador.dto';
import { CriarEspecificacaoVentoinhaDto } from './especificacoes/criar-especificacao-ventoinha.dto';

export class AtualizarHardwareDto {
  @IsOptional()
  @IsString({
    message: 'O nome deve ser um texto.',
  })
  @MinLength(2, {
    message: 'O nome deve ter pelo menos 2 caracteres.',
  })
  @MaxLength(200, {
    message: 'O nome deve ter no máximo 200 caracteres.',
  })
  nome?: string;

  @IsOptional()
  @IsEnum(CategoriaHardware, {
    message: 'Informe uma categoria de hardware válida.',
  })
  categoria?: CategoriaHardware;

  @IsOptional()
  @IsString({
    message: 'A marca deve ser um texto.',
  })
  @MinLength(1, {
    message: 'Informe a marca.',
  })
  @MaxLength(100, {
    message: 'A marca deve ter no máximo 100 caracteres.',
  })
  marca?: string;

  @IsOptional()
  @IsString({
    message: 'O modelo deve ser um texto.',
  })
  @MinLength(1, {
    message: 'Informe o modelo.',
  })
  @MaxLength(150, {
    message: 'O modelo deve ter no máximo 150 caracteres.',
  })
  modelo?: string;

  @IsOptional()
  @IsString({
    message: 'A descrição deve ser um texto.',
  })
  descricao?: string;

  @IsOptional()
  @IsString({
    message: 'A URL da imagem deve ser um texto.',
  })
  @MaxLength(500, {
    message: 'A URL da imagem deve ter no máximo 500 caracteres.',
  })
  imagemUrl?: string;

  @IsOptional()
  @IsObject({
    message: 'As especificações adicionais devem ser um objeto.',
  })
  especificacoes?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => CriarEspecificacaoProcessadorDto)
  especificacaoProcessador?: CriarEspecificacaoProcessadorDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CriarEspecificacaoPlacaMaeDto)
  especificacaoPlacaMae?: CriarEspecificacaoPlacaMaeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CriarEspecificacaoMemoriaRamDto)
  especificacaoMemoriaRam?: CriarEspecificacaoMemoriaRamDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CriarEspecificacaoGabineteDto)
  especificacaoGabinete?: CriarEspecificacaoGabineteDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CriarEspecificacaoFonteDto)
  especificacaoFonte?: CriarEspecificacaoFonteDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CriarEspecificacaoPlacaVideoDto)
  especificacaoPlacaVideo?: CriarEspecificacaoPlacaVideoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CriarEspecificacaoCoolerDto)
  especificacaoCooler?: CriarEspecificacaoCoolerDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CriarEspecificacaoVentoinhaDto)
  especificacaoVentoinha?: CriarEspecificacaoVentoinhaDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CriarEspecificacaoArmazenamentoDto)
  especificacaoArmazenamento?: CriarEspecificacaoArmazenamentoDto;

  @IsOptional()
  @IsBoolean({
    message: 'O campo publicado deve ser verdadeiro ou falso.',
  })
  publicado?: boolean;

  @IsOptional()
  @IsBoolean({
    message: 'O campo ativo deve ser verdadeiro ou falso.',
  })
  ativo?: boolean;
}
