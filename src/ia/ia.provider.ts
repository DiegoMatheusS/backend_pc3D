import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';

@Injectable()
export class IaProvider {
  private readonly logger = new Logger(IaProvider.name);
  private readonly cliente: GoogleGenerativeAI | null = null;

  constructor(private readonly configService: ConfigService) {
    const chave = this.configService.get<string>('GEMINI_API_KEY');

    if (chave) {
      this.cliente = new GoogleGenerativeAI(chave);
    } else {
      this.logger.warn(
        'GEMINI_API_KEY não configurada. Respostas da IA estarão indisponíveis.',
      );
    }
  }

  obterModelo(nomeModelo?: string): GenerativeModel {
    if (!this.cliente) {
      throw new ServiceUnavailableException(
        'O assistente de IA não está disponível no momento. Configure a chave da API.',
      );
    }

    const modeloConfigurado =
      nomeModelo ??
      this.configService.get<string>('GEMINI_MODEL')?.trim() ??
      'gemini-2.0-flash';

    return this.cliente.getGenerativeModel({
      model: modeloConfigurado,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });
  }

  estaDisponivel(): boolean {
    return this.cliente !== null;
  }
}
