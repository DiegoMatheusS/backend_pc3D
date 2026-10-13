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

const CAMPOS_ESPECIFICACAO_TECNICA = [
  'especificacaoProcessador',
  'especificacaoPlacaMae',
  'especificacaoMemoriaRam',
  'especificacaoPlacaVideo',
  'especificacaoArmazenamento',
  'especificacaoFonte',
  'especificacaoGabinete',
  'especificacaoCooler',
  'especificacaoVentoinha',
] as const;

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

function normalizarConectorVentoinha(
  valor: unknown,
  pwm: unknown,
): unknown {
  if (typeof valor === 'string') {
    const token = valor
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');

    if (['PWM_4_PINOS', 'PWM_4_PIN', 'PWM', '4_PIN', '4_PINOS'].includes(token)) {
      return 'PWM_4_PINOS';
    }
    if (['DC_3_PINOS', 'DC_3_PIN', '3_PIN', '3_PINOS'].includes(token)) {
      return 'DC_3_PINOS';
    }
    if (token === 'MOLEX') return 'MOLEX';
    if (['PROPRIETARIO', 'PROPRIETÁRIO', 'PROPRIETARY'].includes(token)) {
      return 'PROPRIETARIO';
    }
  }

  // Ventoinha PWM padrão usa o conector de controle de 4 pinos. Algumas
  // fontes informam "PWM Connector: Yes" sem repetir "4-pin", então o agente
  // confirma PWM mas pode deixar o campo de conector nulo.
  if ((valor === null || valor === undefined || valor === '') && pwm === true) {
    return 'PWM_4_PINOS';
  }

  return valor;
}

/**
 * Respostas de IA usam null para representar "não confirmado". Em operações
 * de CREATE isso não deve ser repassado literalmente ao Prisma: campos com
 * default (booleanos, contadores e listas) e relações aninhadas não aceitam
 * null explícito, embora a ausência do campo seja válida.
 *
 * Removemos null somente das especificações técnicas estruturadas. O campo
 * livre `especificacoes` (JSON) não passa por aqui, pois null pode ser dado
 * intencional dentro desse JSON.
 */
function removerNulosTecnicos(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor
      .filter((item) => item !== null)
      .map((item) => removerNulosTecnicos(item));
  }

  if (!ehRegistro(valor)) return valor;

  for (const [chave, item] of Object.entries(valor)) {
    if (item === null) {
      delete valor[chave];
      continue;
    }

    valor[chave] = removerNulosTecnicos(item);
  }

  return valor;
}

function chaveSuporteGabinete(valor: unknown): string | null {
  if (!ehRegistro(valor)) return null;

  const posicao = typeof valor.posicao === 'string'
    ? valor.posicao.trim().toUpperCase()
    : '';
  const tamanho = Number(valor.tamanhoMm);

  if (!posicao || !Number.isFinite(tamanho) || tamanho <= 0) return null;
  return `${posicao}|${tamanho}`;
}

function normalizarSuportesGabinete(valor: unknown, limite: number): unknown {
  if (!Array.isArray(valor)) return valor;

  const resultado: unknown[] = [];
  const vistos = new Set<string>();

  for (const itemOriginal of valor) {
    if (itemOriginal === null || itemOriginal === undefined) continue;

    const item = ehRegistro(itemOriginal)
      ? removerNulosTecnicos({ ...itemOriginal })
      : itemOriginal;
    const chave = chaveSuporteGabinete(item);

    // A IA frequentemente repete o mesmo suporte para cada fonte encontrada.
    // Para Gabinete, posição+tamanho identifica o ponto físico; mantemos a
    // primeira ocorrência e descartamos repetições antes do limite do DTO.
    if (chave) {
      if (vistos.has(chave)) continue;
      vistos.add(chave);
    }

    resultado.push(item);
    if (resultado.length >= limite) break;
  }

  return resultado;
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
    const contagem =
      typeof slots === 'number'
        ? slots
        : typeof slots === 'string' && /^\s*\d{1,2}\s*$/.test(slots)
          ? Number(slots)
          : null;

    if (
      contagem !== null &&
      Number.isInteger(contagem) &&
      contagem >= 0 &&
      contagem <= 16
    ) {
      placaMae.slotsM2 = Array.from({ length: contagem }, (_, indice) =>
        plainToInstance(CriarSlotM2PlacaMaeDto, {
          codigo: `M2_${indice + 1}`,
          interfacesSuportadas: [],
          chavesSuportadas: [],
          tamanhosSuportadosMm: [],
        }),
      );
    }
  }

  const gabinete = valor.especificacaoGabinete;
  if (ehRegistro(gabinete)) {
    if (gabinete.suportesFans !== undefined) {
      gabinete.suportesFans = normalizarSuportesGabinete(
        gabinete.suportesFans,
        32,
      );
    }
    if (gabinete.suportesRadiador !== undefined) {
      gabinete.suportesRadiador = normalizarSuportesGabinete(
        gabinete.suportesRadiador,
        16,
      );
    }
  }

  // `fluxoArCfm` existe no contrato de VENTOINHA, mas não no contrato/tabela
  // estruturada de COOLER. Versões anteriores do ProjetoIA chegaram a incluí-lo
  // em `especificacaoCooler`; removemos aqui antes do whitelist do class-validator
  // para que payloads já enriquecidos possam ser cadastrados sem nova chamada de IA.
  const cooler = valor.especificacaoCooler;
  if (ehRegistro(cooler)) {
    delete cooler.fluxoArCfm;
  }

  const ventoinha = valor.especificacaoVentoinha;
  if (ehRegistro(ventoinha)) {
    ventoinha.conector = normalizarConectorVentoinha(
      ventoinha.conector,
      ventoinha.pwm,
    );
  }

  for (const chave of CAMPOS_ESPECIFICACAO_TECNICA) {
    const especificacao = valor[chave];
    if (ehRegistro(especificacao)) {
      valor[chave] = removerNulosTecnicos(especificacao);
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
