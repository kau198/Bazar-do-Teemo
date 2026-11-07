// Fonte local nesta etapa. Na integração, trocar por /api/v1/products.
// A interface recebe o mesmo formato independentemente da origem.
const PRODUCTS_URL = new URL("../data/products.json", import.meta.url);
export async function listProducts() {
  const response = await fetch(PRODUCTS_URL);
  if (!response.ok) throw new Error("Não foi possível carregar o catálogo.");
  const data = await response.json();
  if (
    !Array.isArray(data.items) ||
    data.items.some(
      (p) =>
        !Number.isInteger(p.id) ||
        typeof p.name !== "string" ||
        !Number.isFinite(p.price),
    )
  ) {
    throw new Error("O catálogo retornou dados inválidos.");
  }
  return data.items.map((product) => ({
    ...product,
    imageUrl: new URL(
      "../" + product.imageUrl.replace(/^\//, ""),
      import.meta.url,
    ).href,
  }));
}
