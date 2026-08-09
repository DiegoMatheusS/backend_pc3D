import { IsUrl, MaxLength } from 'class-validator';

export class ImportarProdutoDto {
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  urlOriginal: string;
}
