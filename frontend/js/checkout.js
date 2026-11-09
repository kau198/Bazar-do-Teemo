import { getSession, login, register } from "./auth/auth.js";
const $ = (s) => document.querySelector(s);
const money = (n) =>
  (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const status = (message, error = false) => {
  $("#checkout-status").textContent = message;
  $("#checkout-status").classList.toggle("error", error);
};
const cartKey = "baazar-cart-v2";
function readCart() {
  try {
    return JSON.parse(localStorage.getItem(cartKey) || "{}");
  } catch {
    return {};
  }
}
const cart = readCart();
const items = Object.entries(cart).map(([key, quantity]) => ({
  productId: Number(key.split(":")[0]),
  size: key.split(":").slice(1).join(":"),
  quantity,
}));
let quote = null,
  registration = false,
  pending = null,
  busy = false;
const form = $("#checkout-form");
for (const state of "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(
  " ",
))
  form.elements.state.add(new Option(state, state));
async function api(path, body, key) {
  const response = await fetch("/api/v1/orders" + path, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("O servidor não respondeu como esperado. Tente novamente.");
  }
  if (!response.ok) {
    const error = new Error(data.error || "Não foi possível concluir.");
    error.status = response.status;
    throw error;
  }
  return data;
}
function line(parent, left, right, className = "checkout-amount") {
  const row = document.createElement("div");
  row.className = className;
  const label = document.createElement("div");
  label.textContent = left;
  const value = document.createElement("strong");
  value.textContent = right;
  row.append(label, value);
  parent.append(row);
}
function summary(order, parent) {
  parent.replaceChildren();
  for (const item of order.items)
    line(
      parent,
      `${item.quantity} × ${item.name}${item.size ? " · " + item.size : ""}`,
      money(item.lineTotalCents),
      "checkout-item",
    );
}
function totals(order, parent) {
  parent.replaceChildren();
  line(parent, "Produtos", money(order.subtotalCents));
  line(
    parent,
    "Frete simulado",
    order.shippingCents ? money(order.shippingCents) : "Grátis",
  );
  line(parent, "Total", money(order.totalCents), "checkout-amount total");
}
function addressText(a) {
  return `${a.recipient}\n${a.street}, ${a.number}${a.complement ? " · " + a.complement : ""}\n${a.district} · ${a.city}/${a.state}\nCEP ${a.postalCode} · ${a.phone}`;
}
function success(order, clearCart = false) {
  if (clearCart) {
    const current = readCart();
    for (const item of order.items) {
      const key = item.productId + (item.size ? ":" + item.size : "");
      if (Number.isInteger(current[key])) {
        current[key] -= item.quantity;
        if (current[key] <= 0) delete current[key];
      }
    }
    try {
      localStorage.setItem(cartKey, JSON.stringify(current));
    } catch {}
  }
  $("#checkout-layout").hidden = true;
  $("#checkout-auth").hidden = true;
  $("#checkout-success").hidden = false;
  $("#order-number").textContent = "Pedido " + order.id;
  const receipt = $("#order-receipt");
  summary(order, receipt);
  const totalBox = document.createElement("div");
  totals(order, totalBox);
  receipt.append(totalBox);
  const delivery = document.createElement("p");
  delivery.style.whiteSpace = "pre-line";
  delivery.textContent = addressText(order.address);
  receipt.append(delivery);
  history.replaceState(
    null,
    "",
    "/checkout?pedido=" + encodeURIComponent(order.id),
  );
  status("Pedido simulado registrado.");
  $("#checkout-success").focus();
}
async function enter(user) {
  if (!user) {
    $("#checkout-auth").hidden = false;
    status("Entre para continuar.");
    return;
  }
  $("#checkout-auth").hidden = true;
  const orderId = new URLSearchParams(location.search).get("pedido");
  if (orderId) {
    try {
      success((await api("/" + encodeURIComponent(orderId))).order);
    } catch (error) {
      status(error.message, true);
    }
    return;
  }
  if (!items.length) {
    status(
      "Sua sacola está vazia. Volte ao catálogo para escolher seus produtos.",
    );
    return;
  }
  $("#checkout-layout").hidden = false;
  $("#checkout-user").textContent = "Comprando como " + user.name;
  form.elements.recipient.value = user.name;
  status("Preencha o endereço de entrega.");
  try {
    const response = await fetch("/api/v1/products");
    if (!response.ok) throw new Error();
    const { items: products } = await response.json();
    const preview = items.map((item) => {
      const p = products.find((p) => p.id === item.productId);
      if (!p) throw new Error();
      return {
        ...item,
        name: p.name,
        lineTotalCents: Math.round(p.price * 100) * item.quantity,
      };
    });
    summary({ items: preview }, $("#checkout-items"));
  } catch {
    status(
      "Não foi possível carregar todos os produtos. Revise sua sacola ou tente novamente.",
      true,
    );
  }
}
$("#checkout-register-toggle").onclick = () => {
  registration = !registration;
  $("#checkout-name-label").hidden = !registration;
  $("#checkout-confirm-label").hidden = !registration;
  const auth = $("#checkout-auth-form");
  auth.elements.name.required = registration;
  auth.elements.confirmPassword.required = registration;
  auth.elements.password.minLength = registration ? 8 : 1;
  $("#checkout-login").textContent = registration
    ? "Criar conta e continuar"
    : "Entrar e continuar";
  $("#checkout-register-toggle").textContent = registration
    ? "Já tenho uma conta"
    : "Criar uma conta";
};
$("#checkout-auth-form").onsubmit = async (event) => {
  event.preventDefault();
  const button = $("#checkout-login");
  button.disabled = true;
  try {
    const data = Object.fromEntries(new FormData(event.target));
    const user = await (registration ? register(data) : login(data));
    event.target.reset();
    await enter(user);
  } catch (error) {
    status(error.message, true);
  } finally {
    button.disabled = false;
  }
};
form.addEventListener("input", () => {
  if (pending) return;
  quote = null;
  $("#place-order").disabled = true;
  $("#address-review").hidden = true;
  $("#checkout-totals").textContent =
    "Endereço alterado. Revise o pedido novamente.";
});
form.onsubmit = async (event) => {
  event.preventDefault();
  if (busy || pending) return;
  busy = true;
  $("#review-order").disabled = true;
  $("#place-order").disabled = true;
  status("Calculando o resumo…");
  const body = { items, address: Object.fromEntries(new FormData(form)) };
  $("#address-fields").disabled = true;
  try {
    quote = await api("/quote", body);
    summary(quote, $("#checkout-items"));
    totals(quote, $("#checkout-totals"));
    $("#address-review").textContent = "ENTREGA\n" + addressText(quote.address);
    $("#address-review").hidden = false;
    $("#place-order").disabled = false;
    status("Confira o endereço e o total. Nenhuma cobrança será realizada.");
    $("#place-order").focus();
  } catch (error) {
    quote = null;
    status(error.message, true);
  } finally {
    busy = false;
    $("#review-order").disabled = false;
    $("#address-fields").disabled = false;
  }
};
$("#place-order").onclick = async () => {
  if (busy || (!quote && !pending)) return;
  if (!pending)
    pending = {
      body: {
        items,
        address: quote.address,
        expectedTotalCents: quote.totalCents,
      },
      key: crypto.randomUUID(),
    };
  busy = true;
  $("#place-order").disabled = true;
  $("#review-order").disabled = true;
  $("#address-fields").disabled = true;
  status("Registrando seu pedido…");
  try {
    const { order } = await api("", pending.body, pending.key);
    success(order, true);
    pending = null;
  } catch (error) {
    if (error.status && error.status < 500) {
      pending = null;
      quote = null;
      $("#address-fields").disabled = false;
      $("#review-order").disabled = false;
      status(error.message + " Revise o pedido para tentar novamente.", true);
    } else {
      status(
        "Não foi possível confirmar a resposta. Toque novamente para consultar ou concluir o mesmo pedido, sem duplicá-lo.",
        true,
      );
      $("#place-order").disabled = false;
    }
  } finally {
    busy = false;
  }
};
enter(await getSession());
