import { CategoriaHardware } from '../generated/prisma/enums';

type Registro = Record<string, unknown>;

function registro(valor: unknown): Registro | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Registro)
    : null;
}

function numero(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

function numeros(valor: unknown): number[] {
  return Array.isArray(valor)
    ? valor.filter(
        (item): item is number =>
          typeof item === 'number' && Number.isFinite(item),
      )
    : [];
}

function objetos(valor: unknown): Registro[] {
  return Array.isArray(valor)
    ? valor.map(registro).filter((item): item is Registro => item !== null)
    : [];
}

/**
 * Mantém os nomes técnicos históricos do backend e acrescenta aliases usados
 * pelas fichas/comparadores do frontend. Assim a evolução da Loja não quebra
 * contratos antigos enquanto o frontend migra dos JSONs locais para a API.
 */
export function normalizarEspecificacoesHardwarePublicas(
  categoria: CategoriaHardware,
  especificacoes: unknown,
): unknown {
  const base = registro(especificacoes);
  if (!base) return especificacoes;

  switch (categoria) {
    case CategoriaHardware.PROCESSADOR:
      return {
        ...base,
        clockBaseMhz: base.frequenciaBaseMhz ?? null,
        clockTurboMhz: base.frequenciaTurboMhz ?? null,
        videoIntegrado: base.possuiVideoIntegrado ?? false,
        gpuIntegrada: base.modeloVideoIntegrado ?? null,
        memoriaMaximaGb: base.capacidadeMemoriaMaximaGb ?? null,
      };

    case CategoriaHardware.PLACA_VIDEO:
      return {
        ...base,
        vramGb: base.memoriaVideoGb ?? null,
        tipoMemoria: base.tipoMemoriaVideo ?? null,
        tgpWatts: base.consumoWatts ?? null,
        slots: base.slotsOcupados ?? null,
        fonteRecomendadaWatts: base.potenciaFonteRecomendadaWatts ?? null,
        versaoPcie: (() => {
          const geracao = numero(base.geracaoPcie);
          return geracao === null ? null : String(geracao);
        })(),
      };

    case CategoriaHardware.PLACA_MAE: {
      const jedec = numeros(base.frequenciasMemoriaJedecMhz);
      const overclock = numeros(base.frequenciasMemoriaOverclockMhz);
      const frequencias = [...jedec, ...overclock];
      return {
        ...base,
        tipoMemoria: base.tiposMemoriaSuportados ?? [],
        formatosMemoria: base.formatosMemoriaSuportados ?? ['DIMM'],
        suportaMemoriaRegistrada: base.suportaMemoriaRegistrada ?? false,
        memoriaMaximaGb: base.capacidadeMaximaMemoriaGb ?? null,
        frequenciaMemoriaMaxMhz:
          frequencias.length > 0 ? Math.max(...frequencias) : null,
      };
    }

    case CategoriaHardware.MEMORIA_RAM: {
      const capacidadeModulo = numero(base.capacidadePorModuloGb);
      const quantidade = numero(base.quantidadeModulos) ?? 1;
      return {
        ...base,
        tipoMemoria: base.tipo ?? null,
        capacidadeModuloGb: capacidadeModulo,
        capacidadeTotalGb:
          capacidadeModulo === null ? null : capacidadeModulo * quantidade,
        tensao: base.tensaoVolts ?? null,
      };
    }

    case CategoriaHardware.ARMAZENAMENTO:
      return {
        ...base,
        leituraMbS: base.leituraSequencialMbps ?? null,
        gravacaoMbS: base.escritaSequencialMbps ?? null,
        versaoPcie: (() => {
          const geracao = numero(base.geracaoPcie);
          return geracao === null ? null : String(geracao);
        })(),
      };

    case CategoriaHardware.FONTE:
      return {
        ...base,
        conectoresCpu: base.conectoresEpsCpu ?? 0,
        conectoresPcie:
          (numero(base.conectoresPcie6Pinos) ?? 0) +
          (numero(base.conectoresPcie8Pinos) ?? 0),
        conector12vhpwr: (numero(base.conectores12vhpwr) ?? 0) > 0,
      };

    case CategoriaHardware.GABINETE: {
      const fans = objetos(base.suportesFans);
      const radiadores = objetos(base.suportesRadiador);
      const quantidadeFans = (posicao: string): number =>
        fans
          .filter((item) => item.posicao === posicao)
          .reduce(
            (total, item) => total + (numero(item.quantidadeMaxima) ?? 0),
            0,
          );
      const tamanhosFans = [
        ...new Set(
          fans
            .map((item) => numero(item.tamanhoMm))
            .filter((item): item is number => item !== null),
        ),
      ];
      return {
        ...base,
        formatosPlacaMae: base.formatosPlacaMaeSuportados ?? [],
        comprimentoMaxGpuMm: base.comprimentoMaximoGpuMm ?? null,
        alturaMaxCoolerMm: base.alturaMaximaCoolerCpuMm ?? null,
        radiadoresSuportados: radiadores,
        fansFrontais: quantidadeFans('FRENTE'),
        fansTopo: quantidadeFans('TOPO'),
        fansTraseiros: quantidadeFans('TRASEIRA'),
        tamanhosFans,
        formatoFonte: base.formatosFonteSuportados ?? [],
      };
    }

    case CategoriaHardware.COOLER:
      return {
        ...base,
        radiadorMm: base.tamanhoRadiadorMm ?? null,
        fans: base.quantidadeVentoinhas ?? null,
        tdpSuportadoWatts: base.capacidadeTermicaWatts ?? null,
      };

    case CategoriaHardware.VENTOINHA: {
      const tensao = numero(base.tensaoVolts);
      const corrente = numero(base.correnteAmperes);
      return {
        ...base,
        rpm: base.rpmMaxima ?? null,
        pressaoEstatica: base.pressaoEstaticaMmH2o ?? null,
        consumoWatts:
          tensao !== null && corrente !== null
            ? Number((tensao * corrente).toFixed(2))
            : null,
      };
    }

    default:
      return base;
  }
}
