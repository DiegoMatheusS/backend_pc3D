import { IsEnum, IsIn, IsOptional, IsUrl } from 'class-validator';
import { CATEGORIAS_IMPORTACAO_IA } from '../../ia/dtos/categoria-importacao-ia';

export enum AcaoChatbotCadastro {
  CADASTRAR_PRODUTO = 'CADASTRAR_PRODUTO',
  CADASTRAR_HARDWARE = 'CADASTRAR_HARDWARE',
}

export class AnalisarCadastroChatbotDto {
  @IsEnum(AcaoChatbotCadastro)
  acao!: AcaoChatbotCadastro;

  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  url!: string;

  @IsOptional()
  @IsIn([...CATEGORIAS_IMPORTACAO_IA])
  categoriaEsperada?: string;
}
