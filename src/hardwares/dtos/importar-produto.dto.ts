import { IsUrl } from 'class-validator';

export class ImportarProdutoDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  urlOriginal: string;
}
