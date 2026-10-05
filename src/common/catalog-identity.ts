import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

export type CatalogIdentity = {
  nome?: string | null;
  marca?: string | null;
  modelo?: string | null;
  mpn?: string | null;
  gtin?: string | null;
};

function key(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function capacities(value?: string | null) {
  return [
    ...(value ?? '')
      .toLowerCase()
      .matchAll(/\b(\d+(?:[.,]\d+)?)\s*(gb|tb|mhz|hz|w)\b/g),
  ]
    .map((match) => `${match[1].replace(',', '.')}${match[2]}`)
    .sort()
    .join('|');
}

export function sameCatalogIdentity(a: CatalogIdentity, b: CatalogIdentity) {
  const gtinA = (a.gtin ?? '').replace(/\D/g, '');
  const gtinB = (b.gtin ?? '').replace(/\D/g, '');
  const mpnA = key(a.mpn);
  const mpnB = key(b.mpn);
  const brandA = key(a.marca);
  const brandB = key(b.marca);
  if (gtinA && gtinA === gtinB) return true;
  if (mpnA && mpnA === mpnB && brandA && brandA === brandB) return true;
  if (
    (gtinA && gtinB && gtinA !== gtinB) ||
    (mpnA && mpnB && mpnA !== mpnB) ||
    (brandA && brandB && brandA !== brandB)
  )
    return false;
  const nameA = key(a.nome);
  if (nameA && nameA === key(b.nome)) return true;
  const capacityA = capacities(a.nome);
  const capacityB = capacities(b.nome);
  if (capacityA && capacityB && capacityA !== capacityB) return false;
  const modelA = key(a.modelo);
  return Boolean(
    brandA && brandA === brandB && modelA && modelA === key(b.modelo),
  );
}

export function possibleCatalogIdentity(
  a: CatalogIdentity,
  b: CatalogIdentity,
) {
  if (sameCatalogIdentity(a, b)) return true;
  const gtinA = (a.gtin ?? '').replace(/\D/g, '');
  const gtinB = (b.gtin ?? '').replace(/\D/g, '');
  if (gtinA && gtinB && gtinA !== gtinB) return false;
  if (a.mpn && b.mpn && key(a.mpn) !== key(b.mpn)) return false;
  const brand = key(b.marca);
  const title = key(a.nome);
  if (!brand || (a.marca ? key(a.marca) !== brand : !title.includes(brand)))
    return false;
  const capacityA = capacities(a.nome);
  const capacityB = capacities(b.nome);
  if (capacityA && capacityB && capacityA !== capacityB) return false;

  const gpu = (value?: string | null) => {
    const match =
      (value ?? '')
        .toUpperCase()
        .match(/\b(RTX|GTX)\s*[-_]?\s*(\d{3,4})\s*(TI)?\s*(SUPER)?\b/) ??
      (value ?? '')
        .toUpperCase()
        .match(/\b(RX)\s*[-_]?\s*(\d{3,4})\s*(XTX|XT|GRE)?\b/);
    return match ? match.slice(1).filter(Boolean).join(' ') : '';
  };
  const gpuA = gpu(a.nome);
  const gpuB = gpu(b.nome);
  if (gpuA && gpuB) {
    const model = key(
      (a.modelo ?? '').replace(/\b(NVIDIA|GEFORCE|AMD|RADEON)\b/gi, ''),
    );
    return gpuA === gpuB && (!model || model === key(gpuA));
  }
  const model = key(b.modelo);
  return Boolean(
    !a.modelo && model.length >= 4 && /\d/.test(model) && title.includes(model),
  );
}

const selectIdentity = {
  id: true,
  nome: true,
  marca: true,
  modelo: true,
  mpn: true,
  gtin: true,
} as const;

// Toda criação passa pelo mesmo lock transacional, inclusive importações e chatbot.
// Assim duas requisições simultâneas não conseguem aprovar a mesma identidade.
export async function assertCatalogIdentityAvailable(
  tx: Prisma.TransactionClient,
  identity: CatalogIdentity,
  options: { hardwareOriginId?: number } = {},
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(734291, 1)`;
  const [products, hardwares] = await Promise.all([
    tx.produto.findMany({ select: selectIdentity }),
    tx.hardware.findMany({ select: selectIdentity }),
  ]);
  const product = products.find((item) =>
    possibleCatalogIdentity(identity, item),
  );
  if (product) {
    throw new ConflictException({
      message: `Já existe o Produto ${product.id} — ${product.nome} com identidade correspondente ou possível variante. Confirme o cadastro existente ou informe MPN/GTIN da variante antes de criar outro.`,
      produtoExistenteId: product.id,
    });
  }
  const hardware = hardwares.find(
    (item) =>
      item.id !== options.hardwareOriginId &&
      possibleCatalogIdentity(identity, item),
  );
  if (hardware) {
    throw new ConflictException({
      message: `Já existe o Hardware ${hardware.id} — ${hardware.nome} com identidade correspondente ou possível variante. Confirme a ficha existente ou informe MPN/GTIN da variante antes de criar outra.`,
      hardwareExistenteId: hardware.id,
    });
  }
}
