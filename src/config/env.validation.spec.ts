import { validarVariaveisAmbiente } from './env.validation';

describe('validarVariaveisAmbiente', () => {
  const base = {
    DATABASE_URL: 'postgresql://usuario:senha@localhost:5432/teste',
  };

  it('aplica limites seguros de sessão em desenvolvimento', () => {
    const config = validarVariaveisAmbiente({
      ...base,
      NODE_ENV: 'development',
      SESSION_DURATION_HOURS: '8',
    });

    expect(config.SESSION_COOKIE_NAME).toBe('pcbuilder_session');
    expect(config.SESSION_DURATION_HOURS).toBe('8');
  });

  it('rejeita duração de sessão exagerada', () => {
    expect(() =>
      validarVariaveisAmbiente({
        ...base,
        SESSION_DURATION_HOURS: '1000',
      }),
    ).toThrow('SESSION_DURATION_HOURS');
  });

  it('exige CORS e Google Client ID em produção', () => {
    expect(() =>
      validarVariaveisAmbiente({
        ...base,
        NODE_ENV: 'production',
      }),
    ).toThrow('CORS_ORIGINS');
  });

  it('usa cookie __Host- em produção quando o nome não é informado', () => {
    const config = validarVariaveisAmbiente({
      ...base,
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://criabyte.com.br',
      GOOGLE_CLIENT_ID: '123456789012-exemplo.apps.googleusercontent.com',
    });

    expect(config.SESSION_COOKIE_NAME).toBe('__Host-criabyte_session');
  });
});
