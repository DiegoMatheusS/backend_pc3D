import { IsUrl, MaxLength } from 'class-validator';

export class ImportarLinkIaDto {
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  url!: string;
}
