import { listProducts, searchProducts } from "/js/services/catalog.js";

/** Debounce helper */
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

async function initializeShop() {
  let products = await listProducts();
  const money = (n) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }
  let cart = read("baazar-cart-v2", {}),
    favorites = read("bazar-favorites", []);
  if (!cart || typeof cart !== "object" || Array.isArray(cart)) cart = {};
  for (const id of Object.keys(cart))
    if (
      !/^\d+(?::(?:P|M|G|GG))?$/.test(id) ||
      !products.some((p) => p.id == String(id).split(":")[0]) ||
      !Number.isInteger(cart[id]) ||
      cart[id] < 1 ||
      cart[id] > 99
    )
      delete cart[id];
  if (!Array.isArray(favorites)) favorites = [];
  // API-backed search state
  let searchLoading = false;
  let apiSearchActive = false; // true while showing API search results

  let category = "Todos",
    onlyFavorites = false,
    deferredInstall,
    toastTimer,
    visibleLimit = 12;
  let recent = read("baazar-recent", []);
  if (!Array.isArray(recent)) recent = [];
  recent = [...new Set(recent)]
    .filter((id) => products.some((p) => p.id === id))
    .slice(0, 4);
  const categories = ["Todos", ...new Set(products.map((p) => p.category))];
  const normalize = (value) =>
    value
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const $ = (s) => document.querySelector(s);
  function save() {
    try {
      localStorage.setItem("baazar-cart-v2", JSON.stringify(cart));
      localStorage.setItem("bazar-favorites", JSON.stringify(favorites));
    } catch {}
    $("#count").textContent = Object.values(cart).reduce((a, b) => a + b, 0);
  }
  function illustration(type) {
    const p = products.find((p) => p.art === type);
    return (
      '<img src="' +
      p.imageUrl +
      '" alt="' +
      p.name +
      '" loading="lazy" width="900" height="900">'
    );
  }

  function productCard(p) {
    return (
      '<article class="product"><div class="product-art"><button class="product-open" data-detail="' +
      p.id +
      '" aria-label="Ver ' +
      escape(p.name) +
      '">' +
      illustration(p.art) +
      "</button>" +
      (p.tag ? '<span class="tag">' + escape(p.tag) + "</span>" : "") +
      '<button class="heart ' +
      (favorites.includes(p.id) ? "saved" : "") +
      '" data-favorite="' +
      p.id +
      '" aria-label="Favoritar ' +
      escape(p.name) +
      '" aria-pressed="' +
      favorites.includes(p.id) +
      '">' +
      (favorites.includes(p.id) ? "♥" : "♡") +
      '</button></div><p class="product-category">' +
      escape(p.category) +
      '</p><h3><button data-detail="' +
      p.id +
      '">' +
      escape(p.name) +
      '</button></h3><div class="price-row"><span>' +
      money(p.price) +
      '</span><button class="add" data-add="' +
      p.id +
      '" aria-label="Adicionar ' +
      escape(p.name) +
      ' à sacola">+</button></div></article>'
    );
  }
  function renderFromList(list) {
    if (!$("#products")) return;
    const term = normalize($("#search")?.value.trim() || "");
    const price = $("#price-filter")?.value || "all";
    const sort = $("#sort")?.value || "featured";

    // Apply client-side filters (price, favorites) on top of the server result
    const filtered = list.filter(
      (p) =>
        (category === "Todos" || p.category === category) &&
        (!onlyFavorites || favorites.includes(p.id)) &&
        (price === "all" ||
          (price === "under100"
            ? p.price <= 100
            : price === "100to200"
              ? p.price > 100 && p.price <= 200
              : p.price > 200)),
    );
    if (sort === "low") filtered.sort((a, b) => a.price - b.price);
    if (sort === "high") filtered.sort((a, b) => b.price - a.price);
    if (sort === "new") filtered.sort((a, b) => b.id - a.id);

    $("#result-count").textContent =
      filtered.length +
      " " +
      (filtered.length === 1 ? "produto" : "produtos") +
      (onlyFavorites ? " · seus favoritos" : "");
    $("#products").innerHTML =
      filtered.slice(0, visibleLimit).map(productCard).join("") ||
      '<div class="empty"><h3>Nenhum item por aqui.</h3><p>Tente outra busca ou remova os filtros para explorar o bazar.</p><button class="primary" data-reset>Limpar filtros</button></div>';
    const more = $("#load-more");
    if (more) {
      more.hidden = filtered.length <= visibleLimit;
      more.textContent =
        "Mostrar mais " +
        Math.min(12, filtered.length - visibleLimit) +
        " produtos";
    }
    $("#favorites").setAttribute("aria-pressed", onlyFavorites);
    $("#mobile-favorites").setAttribute("aria-pressed", onlyFavorites);
    $("#filter-favorites")?.setAttribute("aria-pressed", onlyFavorites);
    document
      .querySelectorAll("[data-category]")
      .forEach((b) =>
        b.classList.toggle("selected", b.dataset.category === category),
      );
    if ($("#clear-filters"))
      $("#clear-filters").hidden =
        category === "Todos" &&
        !term &&
        price === "all" &&
        !onlyFavorites &&
        sort === "featured";
    renderRecent();
  }

  function render() {
    if (!apiSearchActive) {
      renderFromList(products);
    }
    // When apiSearchActive, renderFromList is called by the search handler
  }

  /** Performs API search, updates products list and re-renders. */
  async function doApiSearch(term) {
    const sort = $("#sort")?.value || "featured";
    if (!$("#products")) return;
    if (!term.trim()) {
      // Empty search → restore full list
      apiSearchActive = false;
      products = await listProducts().catch(() => products);
      renderFromList(products);
      return;
    }
    searchLoading = true;
    apiSearchActive = true;
    $("#products").innerHTML = '<p class="empty" role="status">Buscando…</p>';
    try {
      const results = await searchProducts(term.trim(), { category, sort });
      renderFromList(results);
    } catch {
      $("#products").innerHTML =
        '<p class="empty" role="alert">Erro ao buscar. Verifique sua conexão.</p>';
    } finally {
      searchLoading = false;
    }
  }

  const debouncedSearch = debounce((term) => doApiSearch(term), 350);
  function renderRecent() {
    const section = $("#recent-section");
    if (!section) return;
    section.hidden = !recent.length;
    $("#recent-products").innerHTML = recent
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean)
      .map(productCard)
      .join("");
  }
  function resetFilters() {
    category = "Todos";
    onlyFavorites = false;
    visibleLimit = 12;
    apiSearchActive = false;
    if ($("#search")) $("#search").value = "";
    if ($("#price-filter")) $("#price-filter").value = "all";
    if ($("#sort")) $("#sort").value = "featured";
    listProducts()
      .then((fresh) => { products = fresh; render(); })
      .catch(() => render());
  }
  function openDetail(id) {
    const p = products.find((p) => p.id === id);
    if (!p) return;
    recent = [id, ...recent.filter((x) => x !== id)].slice(0, 4);
    try {
      localStorage.setItem("baazar-recent", JSON.stringify(recent));
    } catch {}
    $("#detail-content").innerHTML =
      '<div class="detail-illustration">' +
      illustration(p.art) +
      '</div><p class="eyebrow">' +
      escape(p.category) +
      "</p><h2>" +
      escape(p.name) +
      "</h2><p>" +
      escape(p.description) +
      "</p><strong>" +
      money(p.price) +
      '</strong><p class="detail-info">Produto real de referência · preço demonstrativo</p><div class="purchase-options">' +
      (p.sizes.length
        ? '<label>Tamanho<select id="product-size" data-product="' +
          p.id +
          '" required><option value="">Selecione</option>' +
          p.sizes
            .map((size) => "<option>" + escape(size) + "</option>")
            .join("") +
          "</select></label>"
        : "") +
      '<label>Quantidade<input id="product-quantity" data-product="' +
      p.id +
      '" type="number" min="1" max="99" step="1" value="1" required></label></div><p><a class="source-link" href="' +
      p.sourceUrl +
      '" target="_blank" rel="noopener">Ver produto de referência ↗</a></p><div class="detail-actions"><button class="primary" data-add="' +
      p.id +
      '">Adicionar à sacola +</button><button class="secondary" data-copy="' +
      p.id +
      '">Copiar link</button></div><p id="share-status" role="status"></p>';
    renderRecent();
    if (!$("#detail").open) $("#detail").showModal();
  }

  function toast(message) {
    $("#toast").textContent = message;
    $("#toast").classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => $("#toast").classList.remove("visible"),
      3500,
    );
  }
  function add(id) {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    const quantityInput = $("#product-quantity");
    const fromDetail =
      $("#detail").open && quantityInput?.dataset.product === String(id);
    if (product.sizes.length && !fromDetail) {
      openDetail(id);
      return;
    }
    let key = String(id);
    if (product.sizes.length) {
      const selector = $("#product-size");
      if (!selector.reportValidity()) return;
      key += ":" + selector.value;
    }
    if (fromDetail && !quantityInput.reportValidity()) return;
    const amount = fromDetail ? Number(quantityInput.value) : 1;
    if ((cart[key] || 0) + amount > 99) {
      toast("O limite é de 99 unidades por item e tamanho.");
      return;
    }
    cart[key] = (cart[key] || 0) + amount;
    save();
    toast(
      amount === 1
        ? "Produto adicionado à sacola"
        : amount + " produtos adicionados à sacola",
    );
    renderCart();
  }
  function renderCart() {
    const entries = Object.entries(cart).map(([key, qty]) => ({
      key,
      qty,
      product: products.find((p) => p.id === Number(key.split(":")[0])),
      size: key.split(":")[1],
    }));
    $("#cart-items").innerHTML =
      entries
        .map(
          ({ key, qty, product: p, size }) =>
            `<div class="cart-item"><strong>${p.name}${size ? " · " + size : ""}</strong><span>${money(p.price)}</span><div class="cart-controls"><button data-minus="${key}" aria-label="Diminuir quantidade de ${p.name}">−</button><span>${qty}</span><button data-plus="${key}" aria-label="Aumentar quantidade de ${p.name}">+</button><button data-remove="${key}">Remover</button></div></div>`,
        )
        .join("") ||
      '<p class="empty">Sua sacola está vazia. Encontre algo com a sua cara na loja.</p>';
    $("#cart-footer").innerHTML = entries.length
      ? `<div class="total"><span>Subtotal</span><strong>${money(entries.reduce((t, e) => t + e.product.price * e.qty, 0))}</strong></div><p class="cart-warning">Finalize uma compra simulada com endereço e frete demonstrativo. Nenhuma cobrança ou entrega real.</p><a class="primary" href="/checkout">Finalizar compra →</a><button class="text-button" data-close>Continuar comprando</button>`
      : "";
  }
  function openCart() {
    renderCart();
    $("#drawer").showModal();
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const d = b.dataset;
    if (d.category) {
      visibleLimit = 12;
      category = d.category;
      document
        .querySelectorAll("[data-category]")
        .forEach((x) => x.classList.toggle("selected", x === b));
      render();
    }
    if (d.add) add(+d.add);
    if (d.favorite) {
      const id = +d.favorite;
      favorites = favorites.includes(id)
        ? favorites.filter((v) => v !== id)
        : [...favorites, id];
      save();
      render();
    }
    if (d.detail) openDetail(+d.detail);
    if ("reset" in d) resetFilters();
    if (d.copy) {
      const url = new URL("/catalogo", location.origin);
      url.searchParams.set("produto", d.copy);
      navigator.clipboard
        ?.writeText(url.href)
        .then(() => {
          $("#share-status").textContent = "Link copiado!";
        })
        .catch(() => {
          $("#share-status").textContent = url.href;
        });
      if (!navigator.clipboard) $("#share-status").textContent = url.href;
    }
    if ("close" in d) b.closest("dialog").close();
    if (d.minus || d.plus || d.remove) {
      const id = d.minus || d.plus || d.remove;
      if (d.remove) delete cart[id];
      else {
        cart[id] = Math.min(99, cart[id] + (d.plus ? 1 : -1));
        if (!cart[id]) delete cart[id];
      }
      save();
      renderCart();
    }
  });
  $("#search")?.addEventListener("input", (e) => {
    visibleLimit = 12;
    debouncedSearch(e.target.value);
  });
  $("#sort")?.addEventListener("change", () => {
    visibleLimit = 12;
    render();
  });
  $("#cart").onclick = $("#mobile-cart").onclick = openCart;
  $("#favorites").onclick = $("#mobile-favorites").onclick = () => {
    if (!$("#catalogo")) {
      location.href = "/catalogo?favoritos=1";
      return;
    }
    onlyFavorites = !onlyFavorites;
    visibleLimit = 12;
    render();
    $("#catalogo").scrollIntoView({ behavior: "smooth" });
  };
  let theme = read("bazar-theme", null) || "light";
  function applyTheme() {
    document.body.classList.toggle("dark", theme === "dark");
    $("#theme").textContent = theme === "dark" ? "☼" : "☾";
    $("#theme").setAttribute(
      "aria-label",
      theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro",
    );
  }
  applyTheme();
  $("#theme").onclick = () => {
    theme = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("bazar-theme", JSON.stringify(theme));
    } catch {}
    applyTheme();
  };
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e;
  });
  const installButton = $("#install");
  if (installButton)
    installButton.onclick = async () => {
      if (deferredInstall) {
        await deferredInstall.prompt();
        deferredInstall = null;
      } else
        toast(
          "No menu do navegador, escolha “Instalar aplicativo” ou “Adicionar à Tela de Início”. A instalação requer HTTPS.",
        );
    };
  if ($(".filters"))
    $(".filters").innerHTML = categories
      .map(
        (c) =>
          '<button data-category="' +
          escape(c) +
          '">' +
          (c === "Todos" ? "Todos os itens" : escape(c)) +
          "</button>",
      )
      .join("");
  $("#price-filter")?.addEventListener("change", () => {
    visibleLimit = 12;
    render();
  });
  $("#load-more")?.addEventListener("click", () => {
    visibleLimit += 12;
    render();
  });
  $("#filter-favorites")?.addEventListener("click", () => {
    onlyFavorites = !onlyFavorites;
    visibleLimit = 12;
    render();
  });
  $("#clear-recent")?.addEventListener("click", () => {
    recent = [];
    try {
      localStorage.removeItem("baazar-recent");
    } catch {}
    renderRecent();
  });
  if ("serviceWorker" in navigator)
    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => {});
  save();
  render();

  if (new URLSearchParams(location.search).get("favoritos") === "1") {
    onlyFavorites = true;
    render();
  }
  const menuButton = $("#menu-toggle");
  function closeMenu() {
    menuButton?.setAttribute("aria-expanded", "false");
    $("#main-nav")?.classList.remove("open");
  }
  menuButton?.addEventListener("click", () => {
    const open = menuButton.getAttribute("aria-expanded") !== "true";
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    $("#main-nav").classList.toggle("open", open);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("header")) closeMenu();
  });
  $("#contact-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    $("#contact-status").textContent =
      "Campos validados. Esta demonstração não envia nem armazena sua mensagem.";
  });

  const query = new URLSearchParams(location.search);
  const requestedCategory = query.get("categoria");
  if (categories.includes(requestedCategory)) {
    category = requestedCategory;
    document
      .querySelectorAll("[data-category]")
      .forEach((b) =>
        b.classList.toggle("selected", b.dataset.category === category),
      );
    render();
  }
  if (products.some((p) => p.id === Number(query.get("produto"))))
    openDetail(Number(query.get("produto")));

  document.querySelectorAll("[data-search-form]").forEach((form) =>
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const value = form.querySelector("input").value;
      if ($("#search")) {
        $("#search").value = value;
        visibleLimit = 12;
        debouncedSearch(value);
        $("#catalogo").scrollIntoView({ behavior: "smooth" });
      } else
        location.href = "/catalogo?busca=" + encodeURIComponent(value);
    }),
  );
  if (query.get("busca") && $("#search")) {
    const busca = query.get("busca");
    $("#search").value = busca;
    debouncedSearch(busca);
  }
  document.querySelectorAll("dialog").forEach((d) =>
    d.addEventListener("click", (e) => {
      if (e.target === d) {
        const r = d.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          d.close();
      }
    }),
  );
}
initializeShop().catch(() => {
  const target =
    document.querySelector("#products") || document.querySelector("#main");
  const error = document.createElement("div");
  error.className = "empty";
  error.setAttribute("role", "alert");
  const message = document.createElement("p");
  message.textContent =
    "Não foi possível carregar os produtos. Verifique sua conexão e tente novamente.";
  const retry = document.createElement("button");
  retry.className = "primary";
  retry.textContent = "Tentar novamente";
  retry.addEventListener("click", () => location.reload());
  error.append(message, retry);
  target.replaceChildren(error);
});
