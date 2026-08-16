import {
<<<<<<< HEAD
  IsEnum,
=======
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
} from 'class-validator';
<<<<<<< HEAD
import { CategoriaHardware } from '../../generated/prisma/enums';
=======
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c

export class AnalisarProdutoIaDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(2_147_483_647)
  hardwareId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(2_147_483_647)
  produtoId?: number;
}

export class NormalizarProdutoIaDto {
  @IsString()
  @MaxLength(50000)
  conteudoBruto!: string;

  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  urlOrigem?: string;
<<<<<<< HEAD

  @IsOptional()
  @IsEnum(CategoriaHardware)
  categoriaEsperada?: CategoriaHardware;
=======
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c
}

export class GerarDescricaoIaDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(2_147_483_647)
  hardwareId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(2_147_483_647)
  produtoId?: number;
}
