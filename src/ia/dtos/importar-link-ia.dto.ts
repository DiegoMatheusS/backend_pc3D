<<<<<<< HEAD
import { IsEnum, IsOptional, IsUrl, MaxLength } from 'class-validator';
import { CategoriaHardware } from '../../generated/prisma/enums';
=======
import { IsUrl, MaxLength } from 'class-validator';
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c

export class ImportarLinkIaDto {
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  url!: string;
<<<<<<< HEAD

  /**
   * O ADMIN pode escolher a categoria antes de importar. Isso funciona como
   * uma dica forte para a normalização, sem autorizar a IA a inventar specs.
   */
  @IsOptional()
  @IsEnum(CategoriaHardware)
  categoriaEsperada?: CategoriaHardware;
=======
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c
}
