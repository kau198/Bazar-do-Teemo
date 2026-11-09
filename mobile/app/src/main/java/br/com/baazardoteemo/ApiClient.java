package br.com.baazardoteemo;

import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;

public final class ApiClient {
    public interface Callback { void complete(JSONObject data, String error); }
    private final ExecutorService executor = Executors.newFixedThreadPool(2);
    private final Handler main = new Handler(Looper.getMainLooper());
    private static final CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ORIGINAL_SERVER);
    private String base;
    private int generation;
    public ApiClient(String base) { this.base = base; CookieHandler.setDefault(cookies); }
    public String base() { return base; }
    public void setBase(String value) { base = value; generation++; cookies.getCookieStore().removeAll(); }
    public void close() { generation++; executor.shutdownNow(); }
    public void request(String method, String route, JSONObject body, Callback callback) {
        request(method,route,body,null,callback);
    }
    public void request(String method, String route, JSONObject body, String requestKey, Callback callback) {
        final String origin = base;
        final int version = generation;
        executor.execute(() -> {
            JSONObject result = null;
            String error = null;
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(origin + "/api/v1" + route).openConnection();
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(15000);
                connection.setInstanceFollowRedirects(false);
                connection.setRequestMethod(method);
                connection.setRequestProperty("Accept", "application/json");
                if(requestKey!=null)connection.setRequestProperty("Idempotency-Key",requestKey);
                if (body != null) {
                    connection.setDoOutput(true);
                    connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                    try (OutputStream stream = connection.getOutputStream()) { stream.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
                }
                int status = connection.getResponseCode();
                InputStream stream = status < 400 ? connection.getInputStream() : connection.getErrorStream();
                String content = "";
                if (stream != null) {
                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                        StringBuilder builder = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) {
                            builder.append(line);
                            if (builder.length() > 4000000) throw new IOException("Resposta muito grande.");
                        }
                        content = builder.toString();
                    }
                }
                if (status >= 300 && status < 400) throw new IOException("Use o endereço final do servidor.");
                try { result = new JSONObject(content); }
                catch (Exception invalid) { throw new IOException("O endereço não retornou uma API válida."); }
                if (status < 200 || status >= 300) { error = result.optString("error", "Não foi possível concluir a operação."); result = null; }
            } catch (Exception failure) {
                error = "Não foi possível conectar. Confira sua internet e o endereço do servidor.";
            } finally { if (connection != null) connection.disconnect(); }
            final JSONObject data = result;
            final String message = error;
            main.post(() -> { if (version == generation) callback.complete(data, message); });
        });
    }
}
