import { randomUUID, createHash } from "node:crypto";
import {
  ValidationError,
  ConflictError,
  NotFoundError,
} from "../utils/errors.js";

const states = new Set(
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(
    " ",
  ),
);
function field(value, label, min, max) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    throw new ValidationError(`Confira ${label}.`);
  return value.trim();
}
export function validateCheckout(body) {
  if (
    !Array.isArray(body?.items) ||
    !body.items.length ||
    body.items.length > 100
  )
    throw new ValidationError("Escolha de 1 a 100 itens para o pedido.");
  const seen = new Set();
  const items = body.items
    .map((item) => {
      if (
        !item ||
        !Number.isSafeInteger(item.productId) ||
        item.productId < 1 ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99
      )
        throw new ValidationError("Produto ou quantidade inválida.");
      const size =
        item.size == null ? "" : field(item.size, "o tamanho", 0, 40);
      const key = `${item.productId}:${size}`;
      if (seen.has(key))
        throw new ValidationError("Há itens repetidos na sacola.");
      seen.add(key);
      return { productId: item.productId, quantity: item.quantity, size };
    })
    .sort((a, b) => a.productId - b.productId || a.size.localeCompare(b.size));
  const input = body.address || {};
  const address = {
    recipient: field(input.recipient, "o nome do destinatário", 2, 150),
    phone: field(input.phone, "o telefone com DDD", 10, 20).replace(/\D/g, ""),
    postalCode: field(input.postalCode, "o CEP", 8, 9).replace(/\D/g, ""),
    street: field(input.street, "a rua", 2, 150),
    number: field(input.number, "o número ou S/N", 1, 20),
    complement: field(input.complement ?? "", "o complemento", 0, 100),
    district: field(input.district, "o bairro", 2, 100),
    city: field(input.city, "a cidade", 2, 100),
    state: field(input.state, "o estado", 2, 2).toUpperCase(),
  };
  if (!/^\d{10,11}$/.test(address.phone))
    throw new ValidationError("Informe telefone com DDD.");
  if (!/^\d{8}$/.test(address.postalCode) || /^0{8}$/.test(address.postalCode))
    throw new ValidationError("Informe um CEP válido.");
  if (!states.has(address.state))
    throw new ValidationError("Selecione um estado brasileiro.");
  return { items, address };
}
export function priceOrder(input, products) {
  const items = input.items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product)
      throw new ValidationError(
        "Um produto não está mais disponível. Revise sua sacola.",
      );
    const sizes = product.sizes || [];
    if (
      (sizes.length && !sizes.includes(item.size)) ||
      (!sizes.length && item.size)
    )
      throw new ValidationError(`Confira o tamanho de ${product.name}.`);
    const unitPriceCents = Math.round(Number(product.price) * 100);
    if (
      !Number.isSafeInteger(unitPriceCents) ||
      unitPriceCents < 0 ||
      product.currency !== "BRL"
    )
      throw new ValidationError(
        "Não foi possível calcular o valor deste produto.",
      );
    return {
      ...item,
      name: product.name,
      unitPriceCents,
      lineTotalCents: unitPriceCents * item.quantity,
    };
  });
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.lineTotalCents,
    0,
  );
  const shippingCents = subtotalCents >= 29900 ? 0 : 1990;
  const totalCents = subtotalCents + shippingCents;
  if (!Number.isSafeInteger(totalCents) || totalCents > 100000000)
    throw new ValidationError("O pedido excede o limite permitido.");
  return {
    items,
    address: input.address,
    subtotalCents,
    shippingCents,
    totalCents,
    currency: "BRL",
    delivery: "Entrega demonstrativa · 5 a 10 dias úteis",
    payment: "Demonstração — nenhuma cobrança será realizada",
  };
}
function receipt(row) {
  return {
    id: row.id,
    status: row.status,
    items: row.items,
    address: row.address,
    subtotalCents: row.subtotal_cents,
    shippingCents: row.shipping_cents,
    totalCents: row.total_cents,
    createdAt: row.created_at,
    currency: "BRL",
  };
}
export function createOrderService(pool) {
  async function quote(body, db = pool) {
    const input = validateCheckout(body);
    const ids = [...new Set(input.items.map((i) => i.productId))];
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const { rows } = await db.query(
      `SELECT id, name, price, currency, sizes FROM products WHERE id IN (${placeholders})`,
      ids,
    );
    return priceOrder(input, rows);
  }
  return {
    quote,
    async create(userId, body, key) {
      if (typeof key !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(key))
        throw new ValidationError(
          "Identificador de pedido inválido. Recarregue a página.",
        );
      const input = validateCheckout(body);
      if (!Number.isSafeInteger(body.expectedTotalCents))
        throw new ValidationError("Revise o total antes de confirmar.");
      const hash = createHash("sha256")
        .update(
          JSON.stringify({
            ...input,
            expectedTotalCents: body.expectedTotalCents,
          }),
        )
        .digest("hex");
      const db = await pool.connect();
      try {
        await db.query("BEGIN");
        const previous = await db.query(
          "SELECT * FROM orders WHERE user_id=$1 AND request_key=$2",
          [userId, key],
        );
        if (previous.rows.length) {
          if (previous.rows[0].request_hash !== hash)
            throw new ConflictError(
              "Este identificador já pertence a outro pedido.",
            );
          await db.query("COMMIT");
          return receipt(previous.rows[0]);
        }
        const priced = await quote(body, db);
        if (priced.totalCents !== body.expectedTotalCents)
          throw new ConflictError(
            "O preço mudou. Revise o resumo antes de confirmar novamente.",
          );
        const result = await db.query(
          `INSERT INTO orders (id,user_id,request_key,request_hash,items,address,subtotal_cents,shipping_cents,total_cents)
          VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9) ON CONFLICT (user_id,request_key) DO NOTHING RETURNING *`,
          [
            randomUUID(),
            userId,
            key,
            hash,
            JSON.stringify(priced.items),
            JSON.stringify(priced.address),
            priced.subtotalCents,
            priced.shippingCents,
            priced.totalCents,
          ],
        );
        const row =
          result.rows[0] ||
          (
            await db.query(
              "SELECT * FROM orders WHERE user_id=$1 AND request_key=$2",
              [userId, key],
            )
          ).rows[0];
        if (row.request_hash !== hash)
          throw new ConflictError(
            "Este identificador já pertence a outro pedido.",
          );
        await db.query("COMMIT");
        return receipt(row);
      } catch (error) {
        await db.query("ROLLBACK");
        throw error;
      } finally {
        db.release();
      }
    },
    async get(userId, id) {
      if (!/^[0-9a-f-]{36}$/i.test(id))
        throw new NotFoundError("Pedido não encontrado.");
      const { rows } = await pool.query(
        "SELECT * FROM orders WHERE id=$1 AND user_id=$2",
        [id, userId],
      );
      if (!rows.length) throw new NotFoundError("Pedido não encontrado.");
      return receipt(rows[0]);
    },
  };
}
