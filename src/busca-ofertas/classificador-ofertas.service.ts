import { Injectable } from '@nestjs/common';
import { TagBuscaOferta } from './dtos/filtrar-busca-ofertas.dto';

@Injectable()
export class ClassificadorOfertasService {
  classificar(
    titulo: string,
    categoriaExterna?: string | null,
  ): TagBuscaOferta {
    const texto = `${titulo} ${categoriaExterna ?? ''}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (/\b(rtx|gtx|geforce|radeon|rx\s*\d{4}|arc\s+[ab]\d+)/.test(texto)) {
      return TagBuscaOferta.PLACA_VIDEO;
    }
    if (/\b(ryzen|core\s+(i[3579]|ultra)|threadripper|xeon)\b/.test(texto)) {
      return TagBuscaOferta.PROCESSADOR;
    }
    if (
      /\b(b\d{3}|x\d{3}|z\d{3}|h\d{3}|a\d{3}).*(placa|motherboard)|placa[- ]?mae|motherboard/.test(
        texto,
      )
    ) {
      return TagBuscaOferta.PLACA_MAE;
    }
    if (/\b(ddr[345]|memoria\s+ram|ram\s+\d+\s*gb)\b/.test(texto)) {
      return TagBuscaOferta.MEMORIA_RAM;
    }
    if (/\b(ssd|nvme|m\.2|sata\s+ssd)\b/.test(texto)) {
      return TagBuscaOferta.SSD;
    }
    if (/\b(fonte|power\s+supply|psu|\d{3,4}\s*w(?:atts?)?)\b/.test(texto)) {
      return TagBuscaOferta.FONTE;
    }
    if (/\b(gabinete|case\s+(?:atx|pc)|computer\s+case)\b/.test(texto)) {
      return TagBuscaOferta.GABINETE;
    }
    if (/\b(monitor|display\s+\d+|\d{2,3}\s*hz)\b/.test(texto)) {
      return TagBuscaOferta.MONITOR;
    }
    if (/\b(notebook|laptop|macbook|ideapad|vivobook|aspire)\b/.test(texto)) {
      return TagBuscaOferta.NOTEBOOK;
    }
    if (
      /\b(celular|smartphone|iphone|galaxy\s+[asz]|redmi|poco\s+[xmf]|moto\s+g|pixel\s+\d)\b/.test(
        texto,
      )
    ) {
      return TagBuscaOferta.CELULAR;
    }
    if (
      /\b(mouse|teclado|keyboard|headset|fone|microfone|webcam)\b/.test(texto)
    ) {
      return TagBuscaOferta.PERIFERICOS;
    }

    return TagBuscaOferta.OUTROS;
  }
}
