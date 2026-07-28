/**
 * Rate limiter server-only, em memória, por (bucket + IP).
 *
 * Contexto: os workers são stateless e podem escalar horizontalmente, então
 * este limitador é um freio local por instância — suficiente para inviabilizar
 * enumeração automatizada de UUID+device_id sem impactar o uso legítimo de um
 * comprador fazendo seu próprio pedido. Não é uma barreira criptográfica.
 *
 * Usa uma janela deslizante simples com Map<key, timestamps[]>. Limpa entradas
 * antigas na hora do check para não crescer indefinidamente.
 */
import { getRequestHeader } from "@tanstack/react-start/server";

type Bucket = {
  /** Máximo de tentativas dentro da janela. */
  max: number;
  /** Janela em milissegundos. */
  windowMs: number;
};

const store = new Map<string, number[]>();

function getIp(): string {
  // Cloudflare envia CF-Connecting-IP; fallback para X-Forwarded-For.
  const cf = getRequestHeader("cf-connecting-ip");
  if (cf) return cf;
  const xff = getRequestHeader("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

export function assertRateLimit(bucketName: string, bucket: Bucket): void {
  const ip = getIp();
  const key = `${bucketName}:${ip}`;
  const now = Date.now();
  const cutoff = now - bucket.windowMs;

  const hits = (store.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= bucket.max) {
    throw new Error("Muitas tentativas. Aguarde um momento e tente novamente.");
  }
  hits.push(now);
  store.set(key, hits);

  // Poda oportunista para não vazar memória em rotas mais movimentadas.
  if (store.size > 5000) {
    for (const [k, v] of store) {
      const alive = v.filter((t) => t > cutoff);
      if (alive.length === 0) store.delete(k);
      else store.set(k, alive);
    }
  }
}
