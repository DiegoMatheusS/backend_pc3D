import { IsUrl, MaxLength } from 'class-validator';

export class ImportarProdutoLojaDto {
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  urlOriginal!: string;
}
