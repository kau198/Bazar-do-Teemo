import { ValidationError, NotFoundError, ConflictError } from "../utils/errors.js";

function text(value, name, max, required = false) {
  if (typeof value !== "string" || value.trim().length > max || (required && !value.trim()))
    throw new ValidationError(`Confira ${name}.`);
  return value.trim();
}
export function validateProduct(body) {
  if (!body || typeof body !== "object") throw new ValidationError();
  const name = text(body.name, "o nome", 200, true);
  const category = text(body.category, "a categoria", 100, true);
  const description = text(body.description ?? "", "a descrição", 4000);
  if (typeof body.price !== "number" || !Number.isFinite(body.price) || body.price < 0 || body.price > 999999.99 || Math.abs(body.price * 100 - Math.round(body.price * 100)) > 0.00001)
    throw new ValidationError("Informe um preço válido com até duas casas decimais.");
  if (body.stock !== null && (!Number.isInteger(body.stock) || body.stock < 0 || body.stock > 1000000))
    throw new ValidationError("Estoque deve ser um inteiro entre 0 e 1.000.000, ou ilimitado.");
  if (typeof body.active !== "boolean") throw new ValidationError("Confira a visibilidade do produto.");
  const imageUrl = text(body.imageUrl ?? "", "a imagem", 500);
  // Same-origin assets only, consistent with the site's Content Security Policy.
  if (imageUrl && !/^\/assets\/images\/[a-zA-Z0-9_./-]+$/.test(imageUrl))
    throw new ValidationError("Use uma imagem da pasta /assets/images/.");
  const sizes = body.sizes ?? [];
  if (!Array.isArray(sizes) || sizes.length > 20 || sizes.some(s => typeof s !== "string" || !s.trim() || s.length > 40))
    throw new ValidationError("Confira os tamanhos (até 20 opções).");
  return { name, category, description, price: body.price, stock: body.stock, active: body.active, imageUrl,
    sizes: [...new Set(sizes.map(s => s.trim()))], tag: text(body.tag ?? "", "a etiqueta", 100), art: text(body.art ?? "", "a arte", 200) };
}
const transitions = {
  demo_confirmed: ["preparing", "cancelled"],
  preparing: ["shipped", "cancelled"],
  shipped: ["completed"], completed: [], cancelled: [],
};
export function createAdminService(pool) {
  return {
    async products() {
      const { rows } = await pool.query("SELECT * FROM products ORDER BY id DESC");
      return rows.map(p => ({ ...p, price: Number(p.price), imageUrl: (p.image_url || "").replace("/public/products/", "/assets/images/products/") }));
    },
    async save(id, input) {
      const p = validateProduct(input);
      const values = [p.name,p.category,p.description,p.price,p.stock,p.active,p.imageUrl,p.sizes,p.tag,p.art];
      const result = id == null
        ? await pool.query(`INSERT INTO products (id,name,category,description,price,stock,active,image_url,sizes,tag,art)
            VALUES (nextval('admin_product_ids'),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, values)
        : await pool.query(`UPDATE products SET name=$1,category=$2,description=$3,price=$4,stock=$5,active=$6,image_url=$7,sizes=$8,tag=$9,art=$10,updated_at=NOW() WHERE id=$11 RETURNING *`, [...values,id]);
      if (!result.rows.length) throw new NotFoundError("Produto não encontrado.");
      return result.rows[0];
    },
    async orders() {
      const { rows } = await pool.query(`SELECT o.*,u.name AS customer_name,u.email AS customer_email
        FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC LIMIT 500`);
      return rows;
    },
    async status(id, status) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NotFoundError("Pedido não encontrado.");
      if (!Object.hasOwn(transitions, status)) throw new ValidationError("Status inválido.");
      const db = await pool.connect();
      try {
        await db.query("BEGIN");
        const { rows } = await db.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [id]);
        const order = rows[0];
        if (!order) throw new NotFoundError("Pedido não encontrado.");
        if (order.status !== status) {
          if (!transitions[order.status]?.includes(status)) throw new ConflictError("Esta alteração de status não é permitida. Atualize a lista.");
          if (status === "cancelled") {
            // Only items that consumed managed stock are restored, once.
            for (const item of order.items.filter(i => i.stockManaged).sort((a,b) => a.productId-b.productId))
              await db.query("UPDATE products SET stock=stock+$1::integer WHERE id=$2 AND stock IS NOT NULL", [item.quantity,item.productId]);
          }
          await db.query("UPDATE orders SET status=$1 WHERE id=$2", [status,id]);
        }
        await db.query("COMMIT");
        return { ...order, status };
      } catch (error) { await db.query("ROLLBACK"); throw error; }
      finally { db.release(); }
    },
    async summary() {
      const products = (await pool.query("SELECT id,active,stock FROM products")).rows;
      const orders = (await pool.query("SELECT status,total_cents FROM orders")).rows;
      return { products: products.length, active: products.filter(p=>p.active).length,
        lowStock: products.filter(p=>p.active && p.stock !== null && p.stock <= 5).length,
        orders: orders.length, pending: orders.filter(o=>["demo_confirmed","preparing"].includes(o.status)).length,
        revenueCents: orders.filter(o=>o.status !== "cancelled").reduce((sum,o)=>sum+o.total_cents,0) };
    },
  };
}
