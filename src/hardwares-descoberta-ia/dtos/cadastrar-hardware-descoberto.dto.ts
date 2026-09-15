import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CriarSlotM2PlacaMaeDto } from '../../hardwares/dtos/especificacoes/criar-slot-m2-placa-mae.dto';
import { CriarHardwareDto } from '../../hardwares/dtos/criar-hardware.dto';

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);
}

function normalizarTextoTipoMemoria(valor: string): string[] {
  const texto = valor
    .trim()
    .toUpperCase()
    .replace(/DDR\s*[-_]?\s*([345])/g, 'DDR$1');

  if (!texto) return [];

  const encontrados = texto.match(/\bDDR[345]\b/g) ?? [];
  return [...new Set(encontrados)];
}

function normalizarTiposMemoriaSuportados(valor: unknown): unknown {
  if (valor === undefined || valor === null) return valor;

  const entradas = Array.isArray(valor) ? valor : [valor];
  const resultado: string[] = [];

  for (const entrada of entradas) {
    // A IA pode misturar frequências (3200, 3600...) no campo de tipo de
    // memória. O Prisma aceita aqui somente os enums DDR3/DDR4/DDR5.
    if (typeof entrada !== 'string') continue;
    resultado.push(...normalizarTextoTipoMemoria(entrada));
  }

  return [...new Set(resultado)];
}

function normalizarPayloadDescoberto(valor: unknown): unknown {
  if (!ehRegistro(valor)) return valor;

  for (const chave of [
    'especificacaoProcessador',
    'especificacaoPlacaMae',
  ] as const) {
    const especificacao = valor[chave];

    if (!ehRegistro(especificacao)) continue;
    if (!('tiposMemoriaSuportados' in especificacao)) continue;

    especificacao.tiposMemoriaSuportados = normalizarTiposMemoriaSuportados(
      especificacao.tiposMemoriaSuportados,
    );
  }

  const placaMae = valor.especificacaoPlacaMae;
  if (ehRegistro(placaMae)) {
    const slots = placaMae.slotsM2;
    const contagem = typeof slots === 'number' ? slots
      : typeof slots === 'string' && /^\s*\d{1,2}\s*$/.test(slots)
        ? Number(slots) : null;
    if (contagem !== null && Number.isInteger(contagem) && contagem >= 0 && contagem <= 16) {
      placaMae.slotsM2 = Array.from({ length: contagem }, (_, indice) => plainToInstance(CriarSlotM2PlacaMaeDto, {
        codigo: `M2_${indice + 1}`,
        interfacesSuportadas: [],
        chavesSuportadas: [],
        tamanhosSuportadosMm: [],
      }));
    }
  }

  return valor;
}

export class CadastrarHardwareDescobertoDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  idTemporario?: string;

  @Transform(({ value }) => normalizarPayloadDescoberto(value), {
    toClassOnly: true,
  })
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
