export const CATEGORIAS_SUGESTAO_OFERTA = [
  'PROCESSADOR',
  'COOLER',
  'PLACA_MAE',
  'MEMORIA_RAM',
  'PLACA_VIDEO',
  'ARMAZENAMENTO',
  'FONTE',
  'GABINETE',
  'VENTOINHA',
  'MONITOR',
  'MOUSE',
  'TECLADO',
  'FONE',
  'MICROFONE',
  'NOTEBOOK',
  'CELULAR',
  'OUTRO',
] as const;

export type CategoriaSugestaoOferta =
  (typeof CATEGORIAS_SUGESTAO_OFERTA)[number];

export type TipoCampoSugestao = 'texto' | 'numero' | 'booleano' | 'selecao';

export type CampoSugestaoOferta = {
  chave: string;
  rotulo: string;
  tipo: TipoCampoSugestao;
  unidade?: string;
  opcoes?: string[];
  minimo?: number;
  maximo?: number;
  recomendado?: boolean;
  placeholder?: string;
};

export type FormularioCategoriaSugestao = {
  categoria: CategoriaSugestaoOferta;
  rotulo: string;
  campos: CampoSugestaoOferta[];
};

const campo = (
  chave: string,
  rotulo: string,
  tipo: TipoCampoSugestao,
  extras: Omit<CampoSugestaoOferta, 'chave' | 'rotulo' | 'tipo'> = {},
): CampoSugestaoOferta => ({ chave, rotulo, tipo, ...extras });

export const FORMULARIOS_SUGESTAO_OFERTA: Record<
  CategoriaSugestaoOferta,
  FormularioCategoriaSugestao
> = {
  PROCESSADOR: {
    categoria: 'PROCESSADOR',
    rotulo: 'Processador',
    campos: [
      campo('socket', 'Socket', 'texto', {
        recomendado: true,
        placeholder: 'AM5',
      }),
      campo('nucleos', 'Núcleos', 'numero', { minimo: 1, maximo: 256 }),
      campo('threads', 'Threads', 'numero', { minimo: 1, maximo: 512 }),
      campo('frequenciaBaseGhz', 'Frequência base', 'numero', {
        unidade: 'GHz',
        minimo: 0.1,
        maximo: 10,
      }),
      campo('frequenciaBoostGhz', 'Frequência boost', 'numero', {
        unidade: 'GHz',
        minimo: 0.1,
        maximo: 10,
      }),
      campo('tdpW', 'TDP', 'numero', { unidade: 'W', minimo: 1, maximo: 1000 }),
    ],
  },
  COOLER: {
    categoria: 'COOLER',
    rotulo: 'Cooler',
    campos: [
      campo('tipo', 'Tipo', 'selecao', {
        opcoes: ['AIR_COOLER', 'WATER_COOLER'],
        recomendado: true,
      }),
      campo('socket', 'Socket/compatibilidade', 'texto', {
        placeholder: 'AM5, LGA1700',
      }),
      campo('alturaMm', 'Altura', 'numero', {
        unidade: 'mm',
        minimo: 1,
        maximo: 500,
      }),
      campo('radiadorMm', 'Tamanho do radiador', 'numero', {
        unidade: 'mm',
        minimo: 80,
        maximo: 600,
      }),
    ],
  },
  PLACA_MAE: {
    categoria: 'PLACA_MAE',
    rotulo: 'Placa-mãe',
    campos: [
      campo('socket', 'Socket', 'texto', {
        recomendado: true,
        placeholder: 'AM5',
      }),
      campo('chipset', 'Chipset', 'texto', { placeholder: 'B650' }),
      campo('formato', 'Formato', 'selecao', {
        opcoes: ['E_ATX', 'ATX', 'MICRO_ATX', 'MINI_ITX'],
      }),
      campo('tipoMemoria', 'Tipo de memória', 'selecao', {
        opcoes: ['DDR3', 'DDR4', 'DDR5'],
      }),
      campo('slotsMemoria', 'Slots de memória', 'numero', {
        minimo: 1,
        maximo: 16,
      }),
      campo('wifi', 'Wi‑Fi integrado', 'booleano'),
    ],
  },
  MEMORIA_RAM: {
    categoria: 'MEMORIA_RAM',
    rotulo: 'Memória RAM',
    campos: [
      campo('capacidadeGb', 'Capacidade', 'numero', {
        unidade: 'GB',
        minimo: 1,
        maximo: 2048,
        recomendado: true,
      }),
      campo('tipoMemoria', 'Tipo', 'selecao', {
        opcoes: ['DDR3', 'DDR4', 'DDR5'],
        recomendado: true,
      }),
      campo('frequenciaMtS', 'Frequência', 'numero', {
        unidade: 'MHz/MT/s',
        minimo: 400,
        maximo: 20000,
        recomendado: true,
      }),
      campo('modulos', 'Quantidade de módulos', 'numero', {
        minimo: 1,
        maximo: 16,
      }),
      campo('latenciaCl', 'Latência CL', 'numero', { minimo: 1, maximo: 200 }),
    ],
  },
  PLACA_VIDEO: {
    categoria: 'PLACA_VIDEO',
    rotulo: 'Placa de vídeo',
    campos: [
      campo('vramGb', 'VRAM', 'numero', {
        unidade: 'GB',
        minimo: 1,
        maximo: 128,
        recomendado: true,
      }),
      campo('tipoMemoria', 'Tipo da memória', 'texto', {
        placeholder: 'GDDR7',
      }),
      campo('tgpW', 'TGP', 'numero', { unidade: 'W', minimo: 1, maximo: 1500 }),
      campo('comprimentoMm', 'Comprimento', 'numero', {
        unidade: 'mm',
        minimo: 20,
        maximo: 1000,
      }),
    ],
  },
  ARMAZENAMENTO: {
    categoria: 'ARMAZENAMENTO',
    rotulo: 'Armazenamento',
    campos: [
      campo('capacidadeGb', 'Capacidade', 'numero', {
        unidade: 'GB',
        minimo: 1,
        maximo: 200000,
        recomendado: true,
      }),
      campo('tipo', 'Tipo', 'selecao', {
        opcoes: ['SSD', 'HDD'],
        recomendado: true,
      }),
      campo('interface', 'Interface', 'selecao', {
        opcoes: ['NVME_PCIE', 'SATA', 'SAS'],
        recomendado: true,
      }),
      campo('formato', 'Formato', 'selecao', {
        opcoes: ['M2', 'POLEGADAS_2_5', 'POLEGADAS_3_5', 'PLACA_PCIE'],
      }),
      campo('leituraMbS', 'Leitura sequencial', 'numero', {
        unidade: 'MB/s',
        minimo: 1,
        maximo: 100000,
      }),
      campo('escritaMbS', 'Escrita sequencial', 'numero', {
        unidade: 'MB/s',
        minimo: 1,
        maximo: 100000,
      }),
    ],
  },
  FONTE: {
    categoria: 'FONTE',
    rotulo: 'Fonte',
    campos: [
      campo('potenciaW', 'Potência', 'numero', {
        unidade: 'W',
        minimo: 50,
        maximo: 5000,
        recomendado: true,
      }),
      campo('certificacao', 'Certificação', 'texto', {
        placeholder: '80 Plus Gold',
      }),
      campo('modularidade', 'Modularidade', 'selecao', {
        opcoes: ['NAO_MODULAR', 'SEMI_MODULAR', 'MODULAR'],
      }),
      campo('formato', 'Formato', 'selecao', {
        opcoes: ['ATX', 'SFX', 'SFX_L', 'TFX', 'FLEX_ATX'],
      }),
    ],
  },
  GABINETE: {
    categoria: 'GABINETE',
    rotulo: 'Gabinete',
    campos: [
      campo('formato', 'Tamanho', 'selecao', {
        opcoes: ['FULL_TOWER', 'MID_TOWER', 'MINI_TOWER', 'SFF', 'OPEN_FRAME'],
        recomendado: true,
      }),
      campo('gpuMaxMm', 'GPU máxima', 'numero', {
        unidade: 'mm',
        minimo: 50,
        maximo: 1000,
      }),
      campo('coolerMaxMm', 'Cooler máximo', 'numero', {
        unidade: 'mm',
        minimo: 20,
        maximo: 500,
      }),
      campo('radiadorMaxMm', 'Radiador máximo', 'numero', {
        unidade: 'mm',
        minimo: 80,
        maximo: 600,
      }),
    ],
  },
  VENTOINHA: {
    categoria: 'VENTOINHA',
    rotulo: 'Ventoinha',
    campos: [
      campo('tamanhoMm', 'Tamanho', 'numero', {
        unidade: 'mm',
        minimo: 20,
        maximo: 300,
        recomendado: true,
      }),
      campo('rpmMax', 'RPM máximo', 'numero', {
        unidade: 'RPM',
        minimo: 100,
        maximo: 20000,
      }),
      campo('conector', 'Conector', 'selecao', {
        opcoes: ['DC_3_PINOS', 'PWM_4_PINOS', 'MOLEX', 'PROPRIETARIO'],
      }),
      campo('pwm', 'PWM', 'booleano'),
    ],
  },
  MONITOR: {
    categoria: 'MONITOR',
    rotulo: 'Monitor',
    campos: [
      campo('tamanhoPolegadas', 'Tamanho', 'numero', {
        unidade: 'pol',
        minimo: 5,
        maximo: 100,
        recomendado: true,
      }),
      campo('resolucao', 'Resolução', 'texto', { placeholder: '2560x1440' }),
      campo('taxaAtualizacaoHz', 'Taxa de atualização', 'numero', {
        unidade: 'Hz',
        minimo: 24,
        maximo: 1000,
        recomendado: true,
      }),
      campo('painel', 'Painel', 'texto', { placeholder: 'IPS' }),
    ],
  },
  MOUSE: {
    categoria: 'MOUSE',
    rotulo: 'Mouse',
    campos: [
      campo('dpiMaximo', 'DPI máximo', 'numero', {
        minimo: 100,
        maximo: 200000,
      }),
      campo('pollingRateHz', 'Polling rate', 'numero', {
        unidade: 'Hz',
        minimo: 125,
        maximo: 16000,
      }),
      campo('conexao', 'Conexão', 'texto', {
        placeholder: 'USB / 2.4 GHz / Bluetooth',
      }),
      campo('pesoGramas', 'Peso', 'numero', {
        unidade: 'g',
        minimo: 10,
        maximo: 1000,
      }),
    ],
  },
  TECLADO: {
    categoria: 'TECLADO',
    rotulo: 'Teclado',
    campos: [
      campo('tamanho', 'Tamanho', 'texto', {
        placeholder: '60%, TKL, Full Size',
      }),
      campo('switch', 'Switch', 'texto'),
      campo('conexao', 'Conexão', 'texto', {
        placeholder: 'USB / 2.4 GHz / Bluetooth',
      }),
      campo('layout', 'Layout', 'texto', { placeholder: 'ABNT2' }),
    ],
  },
  FONE: {
    categoria: 'FONE',
    rotulo: 'Fone/Headset',
    campos: [
      campo('conexao', 'Conexão', 'texto', {
        placeholder: 'P2 / USB / Bluetooth',
      }),
      campo('tipo', 'Tipo', 'texto', { placeholder: 'Over-ear' }),
      campo('microfone', 'Possui microfone', 'booleano'),
    ],
  },
  MICROFONE: {
    categoria: 'MICROFONE',
    rotulo: 'Microfone',
    campos: [
      campo('conexao', 'Conexão', 'texto', { placeholder: 'USB / XLR' }),
      campo('padraoPolar', 'Padrão polar', 'texto', {
        placeholder: 'Cardioide',
      }),
      campo('taxaAmostragemKhz', 'Taxa de amostragem', 'numero', {
        unidade: 'kHz',
        minimo: 8,
        maximo: 384,
      }),
    ],
  },
  NOTEBOOK: {
    categoria: 'NOTEBOOK',
    rotulo: 'Notebook',
    campos: [
      campo('processador', 'Processador', 'texto', { recomendado: true }),
      campo('memoriaRamGb', 'Memória RAM', 'numero', {
        unidade: 'GB',
        minimo: 1,
        maximo: 512,
      }),
      campo('armazenamentoGb', 'Armazenamento', 'numero', {
        unidade: 'GB',
        minimo: 1,
        maximo: 20000,
      }),
      campo('gpu', 'Placa de vídeo', 'texto'),
      campo('telaPolegadas', 'Tela', 'numero', {
        unidade: 'pol',
        minimo: 5,
        maximo: 30,
      }),
      campo('taxaAtualizacaoHz', 'Taxa de atualização', 'numero', {
        unidade: 'Hz',
        minimo: 24,
        maximo: 1000,
      }),
    ],
  },
  CELULAR: {
    categoria: 'CELULAR',
    rotulo: 'Celular',
    campos: [
      campo('sistemaOperacional', 'Sistema operacional', 'texto', {
        placeholder: 'Android 16 / iOS 20',
      }),
      campo('processador', 'Processador', 'texto', { recomendado: true }),
      campo('memoriaRamGb', 'Memória RAM', 'numero', {
        unidade: 'GB',
        minimo: 1,
        maximo: 64,
      }),
      campo('armazenamentoGb', 'Armazenamento', 'numero', {
        unidade: 'GB',
        minimo: 8,
        maximo: 4096,
        recomendado: true,
      }),
      campo('telaPolegadas', 'Tela', 'numero', {
        unidade: 'pol',
        minimo: 3,
        maximo: 10,
      }),
      campo('resolucao', 'Resolução da tela', 'texto', {
        placeholder: '2778x1284',
      }),
      campo('taxaAtualizacaoHz', 'Taxa de atualização', 'numero', {
        unidade: 'Hz',
        minimo: 30,
        maximo: 240,
      }),
      campo('cameraPrincipalMp', 'Câmera principal', 'numero', {
        unidade: 'MP',
        minimo: 1,
        maximo: 500,
      }),
      campo('bateriaMah', 'Bateria', 'numero', {
        unidade: 'mAh',
        minimo: 500,
        maximo: 20000,
      }),
      campo('rede5g', '5G', 'booleano'),
      campo('nfc', 'NFC', 'booleano'),
    ],
  },
  OUTRO: {
    categoria: 'OUTRO',
    rotulo: 'Outro',
    campos: [
      campo('detalhes', 'Detalhes técnicos', 'texto', {
        recomendado: true,
        placeholder: 'Informe as principais especificações',
      }),
    ],
  },
};

export function ehCategoriaSugestaoOferta(
  valor: string,
): valor is CategoriaSugestaoOferta {
  return (CATEGORIAS_SUGESTAO_OFERTA as readonly string[]).includes(valor);
}
