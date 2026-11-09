package br.com.baazardoteemo;

import android.content.Context;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import okhttp3.mockwebserver.*;
import org.junit.*;
import org.junit.runner.RunWith;
import java.net.CookieHandler;
import java.net.CookieManager;
import org.json.JSONObject;
import org.json.JSONArray;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.Espresso.onData;
import static androidx.test.espresso.action.ViewActions.*;
import static androidx.test.espresso.assertion.ViewAssertions.*;
import static androidx.test.espresso.matcher.ViewMatchers.*;
import static androidx.test.espresso.matcher.RootMatchers.isPlatformPopup;
import static org.hamcrest.Matchers.*;

@RunWith(AndroidJUnit4.class)
public class StoreFlowTest {
    private MockWebServer server;
    private ActivityScenario<MainActivity> activity;
    private volatile boolean unavailable;
    private int orderPosts;
    private final String user = "{\"user\":{\"id\":1,\"name\":\"Explorador\",\"email\":\"teste@example.com\"}}";
    private final String catalog = "{\"items\":[{\"id\":1,\"name\":\"Pelúcia Teemo\",\"description\":\"Explorador\",\"category\":\"Pelúcias\",\"price\":159.90,\"sizes\":[],\"imageUrl\":\"\"},{\"id\":2,\"name\":\"Camiseta Jinx\",\"description\":\"Arcane\",\"category\":\"Vestuário\",\"price\":99.90,\"sizes\":[\"M\",\"G\"],\"imageUrl\":\"\"}],\"total\":2}";

    @Before public void start() throws Exception {
        if(CookieHandler.getDefault() instanceof CookieManager) ((CookieManager)CookieHandler.getDefault()).getCookieStore().removeAll();
        server = new MockWebServer();
        server.setDispatcher(new Dispatcher() {
            @Override public MockResponse dispatch(RecordedRequest request) {
                MockResponse response = new MockResponse().setHeader("Content-Type","application/json");
                String path=request.getPath();
                if(path.endsWith("/products")) return unavailable ? response.setResponseCode(503).setBody("{\"error\":\"Loja temporariamente indisponível\"}") : response.setBody(catalog);
                if(path.endsWith("/auth/login") || path.endsWith("/auth/register")) return response.setHeader("Set-Cookie","bazar.sid=test; Path=/; HttpOnly").setBody(user);
                if(path.endsWith("/auth/logout")) return response.setHeader("Set-Cookie","bazar.sid=; Path=/; Max-Age=0").setBody("{\"message\":\"OK\"}");
                if(path.endsWith("/orders/quote") || path.endsWith("/orders")) {
                    try {
                        JSONObject body=new JSONObject(request.getBody().readUtf8());
                        JSONObject item=new JSONObject("{\"productId\":1,\"quantity\":1,\"size\":\"\",\"name\":\"Pelúcia Teemo\",\"unitPriceCents\":15990,\"lineTotalCents\":15990}");
                        JSONObject order=new JSONObject().put("items",new JSONArray().put(item)).put("address",body.getJSONObject("address")).put("subtotalCents",15990).put("shippingCents",1990).put("totalCents",17980);
                        if(path.endsWith("/quote"))return response.setBody(order.toString());
                        if(request.getHeader("Idempotency-Key")==null)return response.setResponseCode(400).setBody("{\"error\":\"Missing key\"}");
                        orderPosts++;order.put("id","11111111-1111-4111-8111-111111111111");return response.setBody(new JSONObject().put("order",order).toString());
                    }catch(Exception error){return response.setResponseCode(400).setBody("{\"error\":\"Invalid checkout\"}");}
                }
                return response.setBody("bazar.sid=test".equals(request.getHeader("Cookie")) ? user : "{\"user\":null}");
            }
        });
        server.start();
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        context.getSharedPreferences("baazar",Context.MODE_PRIVATE).edit().clear().putString("server",server.url("/").toString().replaceAll("/+$", "")).commit();
        activity=ActivityScenario.launch(MainActivity.class);
        awaitText("2 produtos");
    }
    private void screenshot(String name) throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        java.io.File file=new java.io.File(context.getExternalFilesDir(null),name+".png");
        try(java.io.FileOutputStream output=new java.io.FileOutputStream(file)) {
            InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot().compress(android.graphics.Bitmap.CompressFormat.PNG,100,output);
        }
    }
    @After public void stop() throws Exception { if(activity!=null)activity.close(); if(server!=null)server.shutdown(); }
    private void awaitText(String text) throws Exception {
        long until=System.currentTimeMillis()+30000;
        do {
            try { onView(withText(text)).check(matches(isDisplayed())); return; }
            catch(AssertionError | androidx.test.espresso.NoMatchingViewException pending) { if(System.currentTimeMillis()>=until)throw pending; Thread.sleep(100); }
        } while(true);
    }
    @Test public void searchFavoritesCartAndPersistence() throws Exception {
        onView(withHint("Buscar campeão ou produto")).perform(replaceText("PELUCIA"),closeSoftKeyboard());
        awaitText("1 produto");
        onView(withContentDescription("Favoritar Pelúcia Teemo")).perform(scrollTo(),click());
        onView(withText("Ver")).perform(scrollTo(),click());
        onView(withHint("Quantidade")).perform(scrollTo(),replaceText("2"),closeSoftKeyboard());
        onView(withText("Adicionar à sacola")).perform(scrollTo(),click());
        onView(withText("Sacola (2)")).perform(click());
        onView(withText(startsWith("Subtotal"))).check(matches(withText(containsString("319,80"))));
        onView(withContentDescription("Aumentar quantidade")).perform(scrollTo(),click());
        onView(withText("Sacola (3)")).check(matches(isDisplayed()));
        activity.recreate();
        awaitText("2 produtos");
        onView(withText("Sacola (3)")).perform(click());
        onView(withText(startsWith("Subtotal"))).check(matches(withText(containsString("479,70"))));
        onView(withText("Remover")).perform(scrollTo(),click());
        onView(withText("Sacola (0)")).check(matches(isDisplayed()));
        onView(withText("Favoritos")).perform(click());
        awaitText("1 produto");
    }
    @Test public void loginSurvivesRecreationAndLogout() throws Exception {
        onView(withText("Conta")).perform(click());
        onView(withHint("E-mail")).perform(replaceText("teste@example.com"));
        onView(withHint("Senha")).perform(replaceText("senha-teste-123"),closeSoftKeyboard());
        onView(withText("Entrar")).perform(scrollTo(),click());
        awaitText("Olá, Explorador");
        activity.recreate();
        awaitText("2 produtos");
        onView(withText("Conta")).perform(click());
        awaitText("Olá, Explorador");
        onView(withText("Sair da conta")).perform(click());
        awaitText("Bom te ver por aqui.");
    }
    @Test public void categoriesSizesAndQuantityValidation() throws Exception {
        onView(withContentDescription("Categoria")).perform(click());
        onData(is("Vestuário")).perform(click());
        awaitText("1 produto");
        onView(withText("Ver")).perform(scrollTo(),click());
        onView(withContentDescription("Tamanho")).perform(scrollTo(),click());
        screenshot("sizes");
        onView(withText("M")).inRoot(isPlatformPopup()).perform(click());
        onView(withHint("Quantidade")).perform(scrollTo(),replaceText("100"),closeSoftKeyboard());
        onView(withText("Adicionar à sacola")).perform(scrollTo(),click());
        onView(withHint("Quantidade")).check(matches(hasErrorText("Escolha de 1 a 99 unidades.")));
        onView(withHint("Quantidade")).perform(scrollTo(),replaceText("1"),closeSoftKeyboard());
        onView(withText("Adicionar à sacola")).perform(scrollTo(),click());
        onView(withText("Sacola (1)")).perform(click());
        onView(withText("Camiseta Jinx · M")).check(matches(isDisplayed()));
    }
    @Test public void publishedCatalogLoadsOnFirstLaunch() throws Exception {
        activity.close();
        InstrumentationRegistry.getInstrumentation().getTargetContext().getSharedPreferences("baazar",Context.MODE_PRIVATE).edit().clear().commit();
        activity=ActivityScenario.launch(MainActivity.class);
        awaitText("21 produtos");
        screenshot("catalog-live");
    }
    @Test public void checkoutCollectsAddressAndConfirmsOrder() throws Exception {
        onView(withText("Conta")).perform(click());
        onView(withHint("E-mail")).perform(replaceText("teste@example.com"));
        onView(withHint("Senha")).perform(replaceText("senha-teste-123"),closeSoftKeyboard());
        onView(withText("Entrar")).perform(scrollTo(),click());awaitText("Olá, Explorador");
        onView(withText("Loja")).perform(click());
        onView(withHint("Buscar campeão ou produto")).perform(replaceText("Teemo"),closeSoftKeyboard());
        onView(withText("Ver")).perform(scrollTo(),click());
        onView(withText("Adicionar à sacola")).perform(scrollTo(),click());
        onView(withText("Sacola (1)")).perform(click());
        onView(withText("Finalizar compra")).perform(scrollTo(),click());
        String[][] fields={{"Telefone com DDD","11999999999"},{"CEP","01001000"},{"Rua ou avenida","Rua de Teste"},{"Número ou S/N","10"},{"Bairro","Centro"},{"Cidade","Sao Paulo"}};
        for(String[] field:fields)onView(withHint(field[0])).perform(scrollTo(),replaceText(field[1]),closeSoftKeyboard());
        onView(withContentDescription("Estado de entrega")).perform(scrollTo(),click());
        onData(is("SP")).inRoot(isPlatformPopup()).perform(click());
        onView(withText("Revisar pedido")).perform(scrollTo(),click());
        awaitText("Confirmar simulação");
        onView(withText("Confirmar simulação")).perform(click());
        awaitText("Pedido simulado confirmado");
        org.junit.Assert.assertEquals(1,orderPosts);
        onView(withText("Continuar explorando")).perform(click());
        onView(withText("Sacola (0)")).check(matches(isDisplayed()));
    }
    @Test public void registerAndOfflineCatalog() throws Exception {
        onView(withText("Conta")).perform(click());
        onView(withText("Ainda não tenho conta")).perform(scrollTo(),click());
        onView(withHint("Nome completo")).perform(replaceText("Explorador"));
        onView(withHint("E-mail")).perform(replaceText("teste@example.com"));
        onView(withHint("Senha (mínimo 8 caracteres)")).perform(scrollTo(),replaceText("senha-teste-123"));
        onView(withHint("Confirme sua senha")).perform(scrollTo(),replaceText("senha-teste-123"),closeSoftKeyboard());
        onView(withText("Criar minha conta")).perform(scrollTo(),click());
        awaitText("Olá, Explorador");
        unavailable=true;
        activity.recreate();
        awaitText("Loja temporariamente indisponível");
        onView(withText("2 produtos")).check(matches(isDisplayed()));
        onView(withText(startsWith("Sem conexão"))).check(matches(isDisplayed()));
        unavailable=false;
        onView(withText("Tentar novamente")).perform(click());
        awaitText("Atualizar catálogo");
    }
}
