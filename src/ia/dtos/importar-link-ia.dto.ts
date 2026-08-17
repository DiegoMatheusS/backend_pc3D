import { IsEnum, IsOptional, IsUrl, MaxLength } from 'class-validator';
import { CategoriaHardware } from '../../generated/prisma/enums';

export class ImportarLinkIaDto {
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  url!: string;

  /**
   * O ADMIN pode escolher a categoria antes de importar. Isso funciona como
   * uma dica forte para a normalização, sem autorizar a IA a inventar specs.
   */
  @IsOptional()
  @IsEnum(CategoriaHardware)
  categoriaEsperada?: CategoriaHardware;
}
