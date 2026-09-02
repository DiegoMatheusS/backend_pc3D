import { CategoriaHardware } from '../../generated/prisma/enums';

export const CATEGORIAS_PRODUTO_IMPORTACAO_IA = [
  'MONITOR',
  'MOUSE',
  'TECLADO',
  'HEADSET',
  'FONE',
  'MICROFONE',
  'CONTROLE',
  'CADEIRA',
  'MESA',
  'SUPORTE_MONITOR',
  'ILUMINACAO',
  'ORGANIZADOR_CABOS',
  'ACESSORIO',
  'NOTEBOOK',
  'PC_MONTADO',
  'CELULAR',
  'PROJETOR',
  'CALCULADORA',
  'TELEFONE',
  'IMPRESSORA',
  'SCANNER',
  'CAIXA_DE_SOM',
  'ROTEADOR',
  'REPETIDOR_WIFI',
  'SWITCH_REDE',
  'ADAPTADOR_WIFI_BLUETOOTH',
  'NOBREAK',
  'ESTABILIZADOR',
  'FILTRO_DE_LINHA',
  'WEBCAM',
  'TABLET',
  'MICROCONTROLADOR',
  'KIT_ARDUINO_ROBOTICA',
  'MINI_COMPUTADOR',
  'RELOGIO_INTELIGENTE',
  'JOYSTICK',
  'CONTROLE_VIDEO_GAME',
  'VOLANTE',
  'VIDEOGAME',
  'JOGO',
  'SMART_TV',
  'CAMERA',
  'MOUSEPAD',
  'CARREGADOR',
  'POWER_BANK',
  'CABO_ADAPTADOR',
  'HUB_USB',
  'DOCK_STATION',
  'PEN_DRIVE',
  'CARTAO_MEMORIA',
  'LEITOR_CARTAO',
  'ARMAZENAMENTO_EXTERNO',
  'IMPRESSORA_3D',
  'ACESSORIO_IMPRESSAO_3D',
] as const;

export const CATEGORIAS_IMPORTACAO_IA = [
  ...Object.values(CategoriaHardware),
  ...CATEGORIAS_PRODUTO_IMPORTACAO_IA,
] as const;

export type CategoriaImportacaoIa = (typeof CATEGORIAS_IMPORTACAO_IA)[number];

export function ehCategoriaHardwareImportacao(
  valor: string | null | undefined,
): valor is CategoriaHardware {
  return (
    typeof valor === 'string' &&
    Object.values(CategoriaHardware).includes(valor)
  );
}

export function ehCategoriaImportacaoIa(
  valor: string | null | undefined,
): valor is CategoriaImportacaoIa {
  return (
    typeof valor === 'string' &&
    (CATEGORIAS_IMPORTACAO_IA as readonly string[]).includes(valor)
  );
}
