package br.com.baazardoteemo;

import java.net.URI;
import java.text.Normalizer;
import java.util.Locale;

public final class ShopRules {
    private ShopRules() {}
    public static String serverUrl(String value) {
        String text = value.trim().replaceAll("/+$", "");
        URI uri;
        try { uri = URI.create(text); } catch (Exception e) { throw new IllegalArgumentException("Informe um endereço válido."); }
        if (!("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) ||
            uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null ||
            !(uri.getPath().isEmpty() || "/".equals(uri.getPath()))) {
            throw new IllegalArgumentException("Use a origem do site, como https://minha-loja.com, sem /api e sem senha no endereço.");
        }
        return text;
    }
    public static String searchKey(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
    }
    public static int quantity(String value) {
        int amount;
        try { amount = Integer.parseInt(value.trim()); } catch (Exception e) { throw new IllegalArgumentException("Informe uma quantidade inteira."); }
        if (amount < 1 || amount > 99) throw new IllegalArgumentException("Escolha de 1 a 99 unidades.");
        return amount;
    }
    public static long lineTotal(double price, int amount) {
        if (!Double.isFinite(price) || price < 0 || amount < 1 || amount > 99) throw new IllegalArgumentException("Item inválido.");
        return Math.round(price * 100) * amount;
    }
}
