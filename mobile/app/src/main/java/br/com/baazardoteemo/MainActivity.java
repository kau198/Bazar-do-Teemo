package br.com.baazardoteemo;

import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.text.*;
import android.text.InputType;
import android.view.*;
import android.view.inputmethod.InputMethodManager;
import android.widget.*;
import android.util.LruCache;
import org.json.*;
import java.net.*;
import java.io.*;
import java.text.NumberFormat;
import java.util.*;
import java.util.concurrent.*;

public final class MainActivity extends Activity {
    private final int green = Color.rgb(32,77,60), ink = Color.rgb(34,60,51), muted = Color.rgb(111,122,112);
    private final int paper = Color.rgb(245,246,240), line = Color.rgb(224,229,219);
    private LinearLayout root, content, tabs, grid;
    private TextView resultCount;
    private SharedPreferences prefs;
    private ApiClient api;
    private JSONArray products = new JSONArray();
    private JSONObject cart = new JSONObject();
    private final Set<Integer> favorites = new HashSet<>();
    private JSONObject user;
    private String screen = "Loja", query = "", category = "Todos", sort = "Destaques";
    private String loadError = "";
    private boolean loading, offline, destroyed;
    private int screenGeneration;
    private final ExecutorService images = Executors.newFixedThreadPool(4);
    private final LruCache<String,Bitmap> imageCache = new LruCache<>(24 * 1024) {
        protected int sizeOf(String key, Bitmap image) { return image.getByteCount() / 1024; }
    };
    private final NumberFormat money = NumberFormat.getCurrencyInstance(new Locale("pt","BR"));

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences("baazar", MODE_PRIVATE);
        String server = prefs.getString("server", "");
        if (server.isEmpty()) server = "https://bazar-do-teemo.onrender.com";
        api = new ApiClient(server);
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(Color.WHITE);
        root.setOnApplyWindowInsetsListener((view,insets) -> {
            root.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        setContentView(root);
        restoreStore();
        render();
        if (!api.base().isEmpty()) { refresh(); restoreSession(); }
    }
    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }
    private LinearLayout column() { LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);return v; }
    private LinearLayout row() { LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.HORIZONTAL);v.setGravity(Gravity.CENTER_VERTICAL);return v; }
    private GradientDrawable background(int color,int radius) { GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));return d; }
    private TextView text(String value,int size,int color) {
        TextView v=new TextView(this);v.setText(value);v.setTextSize(size);v.setTextColor(color);v.setPadding(0,dp(4),0,dp(4));return v;
    }
    private TextView heading(String value,int size) { TextView v=text(value,size,ink);v.setTypeface(null,Typeface.BOLD);return v; }
    private Button button(String label,Runnable action) {
        Button b=new Button(this);b.setText(label);b.setAllCaps(false);b.setTextSize(13);b.setTextColor(green);b.setMinHeight(dp(48));
        b.setOnClickListener(v->action.run());return b;
    }
    private Button primary(String label,Runnable action) {
        Button b=button(label,action);b.setTextColor(Color.WHITE);b.setBackground(background(green,8));b.setPadding(dp(18),dp(10),dp(18),dp(10));return b;
    }
    private EditText field(String hint,int type) {
        EditText e=new EditText(this);e.setHint(hint);e.setContentDescription(hint);e.setTextSize(15);e.setTextColor(ink);e.setHintTextColor(muted);
        e.setSingleLine(true);e.setInputType(type);e.setPadding(dp(12),dp(12),dp(12),dp(12));e.setBackground(background(paper,8));
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(52));p.setMargins(0,dp(6),0,dp(10));e.setLayoutParams(p);return e;
    }
    private void gap(LinearLayout target,int amount) { View v=new View(this);target.addView(v,new LinearLayout.LayoutParams(1,dp(amount))); }
    private void notice(String message) { if(!destroyed)Toast.makeText(this,message,Toast.LENGTH_LONG).show(); }
    private String storeKey(String key) { return api.base()+":"+key; }
    private void restoreStore() {
        favorites.clear();cart=new JSONObject();products=new JSONArray();offline=false;
        try {cart=new JSONObject(prefs.getString(storeKey("cart"),"{}"));}catch(Exception ignored){}
        try {JSONArray saved=new JSONArray(prefs.getString(storeKey("favorites"),"[]"));for(int i=0;i<saved.length();i++)favorites.add(saved.optInt(i));}catch(Exception ignored){}
        try {products=new JSONArray(prefs.getString(storeKey("catalog"),"[]"));offline=products.length()>0;}catch(Exception ignored){}
    }
    private void persist() {
        JSONArray ids=new JSONArray();for(int id:favorites)ids.put(id);
        prefs.edit().putString(storeKey("cart"),cart.toString()).putString(storeKey("favorites"),ids.toString()).apply();
    }
    private void restoreSession() {
        api.request("GET","/auth/me",null,(data,error)->{if(destroyed)return;user=data==null?null:data.optJSONObject("user");if(screen.equals("Conta"))render();});
    }
    private void refresh() {
        if(api.base().isEmpty()||loading)return;
        loading=true;loadError="";render();
        api.request("GET","/products",null,(data,error)->{
            if(destroyed)return;loading=false;
            JSONArray list=data==null?null:data.optJSONArray("items");
            if(error!=null||list==null){offline=products.length()>0;loadError=error!=null?error:"O servidor retornou um catálogo inválido.";}
            else {
                boolean valid=true;
                for(int i=0;i<list.length();i++){JSONObject p=list.optJSONObject(i);if(p==null||p.optInt("id",-1)<1||p.optString("name").isEmpty()||p.optDouble("price",-1)<0){valid=false;break;}}
                if(valid){products=list;offline=false;prefs.edit().putString(storeKey("catalog"),products.toString()).apply();}
                else loadError="O servidor retornou um produto inválido.";
            }
            render();
        });
    }
    private void render() {
        if(destroyed)return;screenGeneration++;root.removeAllViews();
        LinearLayout header=row();header.setPadding(dp(18),dp(10),dp(12),dp(10));
        ImageView logo=new ImageView(this);logo.setImageResource(R.drawable.logo);logo.setContentDescription("Logo Baazar do Teemo");
        header.addView(logo,new LinearLayout.LayoutParams(dp(49),dp(49)));
        TextView brand=heading("baazar",25);brand.setPadding(dp(9),0,0,0);header.addView(brand,new LinearLayout.LayoutParams(0,-2,1));
        header.addView(button("Servidor",this::serverDialog));root.addView(header);
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);content=column();content.setPadding(dp(18),dp(10),dp(18),dp(24));
        scroll.addView(content);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        if(api.base().isEmpty())onboarding();
        else if(screen.equals("Sacola"))showCart();
        else if(screen.equals("Conta"))showAccount();
        else showCatalog();
        tabs=row();tabs.setPadding(dp(4),dp(5),dp(4),dp(5));tabs.setBackground(background(paper,0));
        for(String label:new String[]{"Loja","Favoritos","Sacola","Conta"}) {
            String title=label.equals("Sacola")?label+" ("+cartCount()+")":label;
            Button b=button(title,()->{screen=label;render();});b.setTextSize(11);
            if(label.equals(screen)){b.setTextColor(Color.WHITE);b.setBackground(background(green,8));}
            tabs.addView(b,new LinearLayout.LayoutParams(0,dp(52),1));
        }
        root.addView(tabs);
    }
    private void onboarding() {
        gap(content,20);content.addView(text("SEU UNIVERSO. FORA DA TELA.",11,green));
        content.addView(heading("O bazar agora\nvai com você.",34));
        content.addView(text("Colecionáveis, pelúcias e peças do seu universo, em um aplicativo Android.",16,muted));
        gap(content,20);content.addView(primary("Conectar à loja",this::serverDialog));
        gap(content,12);content.addView(text("Informe o endereço do site publicado. Para testar na rede local, use o IP do computador com a API em execução.",13,muted));
    }
    private void serverDialog() {
        LinearLayout form=column();form.setPadding(dp(22),dp(10),dp(22),dp(4));
        form.addView(text("Endereço da loja, sem /api. Exemplo: https://minha-loja.com",14,muted));
        EditText address=field("https://sua-loja.com",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI);
        address.setText(api.base());form.addView(address);
        form.addView(text("Em rede local: http://IP-DO-COMPUTADOR:3000. No celular, localhost aponta para o próprio aparelho. Ao trocar de servidor, a sessão atual será encerrada neste app.",12,muted));
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Conectar à loja").setView(form).setNegativeButton("Cancelar",null).setPositiveButton("Conectar",null).create();
        dialog.setOnShowListener(v->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(w->{
            try {
                String next=ShopRules.serverUrl(address.getText().toString());
                if(!next.equals(api.base())){api.setBase(next);prefs.edit().putString("server",next).apply();user=null;loading=false;restoreStore();}
                screen="Loja";query="";category="Todos";dialog.dismiss();refresh();restoreSession();
            }catch(IllegalArgumentException e){address.setError(e.getMessage());}
        }));dialog.show();
    }
    private void showCatalog() {
        boolean saved=screen.equals("Favoritos");
        content.addView(text(saved?"SUA SELEÇÃO":"CURADORIA DO EXPLORADOR",10,green));
        content.addView(heading(saved?"Meus favoritos":"Encontre seu próximo loot.",27));
        if(offline)content.addView(text("Sem conexão · exibindo o último catálogo salvo. Preços podem ter mudado.",12,muted));
        if(!loadError.isEmpty()){content.addView(text(loadError,13,Color.rgb(158,64,47)));content.addView(button("Tentar novamente",this::refresh));}
        else content.addView(button(loading?"Atualizando…":"Atualizar catálogo",this::refresh));
        EditText search=field("Buscar campeão ou produto",InputType.TYPE_CLASS_TEXT);search.setText(query);content.addView(search);
        LinearLayout controls=row();
        Spinner categories=new Spinner(this);ArrayList<String> names=new ArrayList<>();names.add("Todos");
        for(int i=0;i<products.length();i++){String c=products.optJSONObject(i).optString("category");if(!names.contains(c))names.add(c);}
        if(!names.contains(category))category="Todos";
        categories.setContentDescription("Categoria");categories.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,names));
        categories.setSelection(names.indexOf(category));controls.addView(categories,new LinearLayout.LayoutParams(0,dp(48),1));
        String[] sorts={"Destaques","Menor preço","Maior preço","Novidades"};
        Spinner order=new Spinner(this);order.setContentDescription("Ordenar");order.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,sorts));order.setSelection(Arrays.asList(sorts).indexOf(sort));controls.addView(order,new LinearLayout.LayoutParams(0,dp(48),1));content.addView(controls);
        resultCount=text("",12,muted);content.addView(resultCount);grid=column();content.addView(grid);
        search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int a,int c,int f){}public void onTextChanged(CharSequence s,int start,int before,int count){query=s.toString();renderGrid();}public void afterTextChanged(Editable e){}});
        categories.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){public void onNothingSelected(AdapterView<?> p){}public void onItemSelected(AdapterView<?> p,View v,int i,long id){category=names.get(i);renderGrid();}});
        order.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){public void onNothingSelected(AdapterView<?> p){}public void onItemSelected(AdapterView<?> p,View v,int i,long id){sort=sorts[i];renderGrid();}});
        renderGrid();
        gap(content,16);content.addView(text("Projeto acadêmico · preços de demonstração. Não há pagamento ou envio de pedidos.",11,muted));
    }
    private void renderGrid() {
        if(grid==null||(!screen.equals("Loja")&&!screen.equals("Favoritos")))return;grid.removeAllViews();
        ArrayList<JSONObject> list=new ArrayList<>();String term=ShopRules.searchKey(query.trim());
        for(int i=0;i<products.length();i++){
            JSONObject p=products.optJSONObject(i);if(p==null)continue;
            if(!category.equals("Todos")&&!category.equals(p.optString("category")))continue;
            if(screen.equals("Favoritos")&&!favorites.contains(p.optInt("id")))continue;
            if(!ShopRules.searchKey(p.optString("name")+" "+p.optString("description")+" "+p.optString("category")).contains(term))continue;list.add(p);
        }
        if(sort.equals("Menor preço"))list.sort(Comparator.comparingDouble(p->p.optDouble("price")));
        if(sort.equals("Maior preço"))list.sort((a,b)->Double.compare(b.optDouble("price"),a.optDouble("price")));
        if(sort.equals("Novidades"))list.sort((a,b)->Integer.compare(b.optInt("id"),a.optInt("id")));
        resultCount.setText(list.size()+" "+(list.size()==1?"produto":"produtos"));
        if(list.isEmpty())grid.addView(text(loading?"Carregando catálogo…":"Nenhum produto encontrado. Experimente outra busca ou categoria.",15,muted));
        LinearLayout current=null;
        for(int i=0;i<list.size();i++){
            if(i%2==0){current=row();current.setGravity(Gravity.TOP);grid.addView(current);gap(grid,14);}
            JSONObject p=list.get(i);LinearLayout card=column();card.setPadding(dp(6),0,dp(6),dp(8));
            ImageView photo=new ImageView(this);photo.setScaleType(ImageView.ScaleType.FIT_CENTER);photo.setPadding(dp(8),dp(8),dp(8),dp(8));photo.setBackground(background(paper,10));photo.setContentDescription(p.optString("name"));image(photo,p.optString("imageUrl"));
            card.addView(photo,new LinearLayout.LayoutParams(-1,dp(162)));photo.setOnClickListener(v->detail(p));
            card.addView(text(p.optString("category").toUpperCase(new Locale("pt","BR")),9,muted));
            TextView name=heading(p.optString("name"),14);name.setMinHeight(dp(48));card.addView(name);name.setOnClickListener(v->detail(p));
            card.addView(heading(money.format(p.optDouble("price")),16));
            LinearLayout buttons=row();int id=p.optInt("id");
            Button heart=button(favorites.contains(id)?"♥":"♡",()->{if(!favorites.remove(id))favorites.add(id);persist();renderGrid();});
            heart.setContentDescription("Favoritar "+p.optString("name"));buttons.addView(heart,new LinearLayout.LayoutParams(0,dp(48),1));
            buttons.addView(button("Ver",()->detail(p)),new LinearLayout.LayoutParams(0,dp(48),1));card.addView(buttons);
            current.addView(card,new LinearLayout.LayoutParams(0,-2,1));
        }
        if(list.size()%2==1)current.addView(new View(this),new LinearLayout.LayoutParams(0,1,1));
    }
    private void detail(JSONObject p) {
        LinearLayout box=column();box.setPadding(dp(20),dp(12),dp(20),dp(16));
        ImageView photo=new ImageView(this);photo.setScaleType(ImageView.ScaleType.FIT_CENTER);photo.setContentDescription(p.optString("name"));photo.setBackground(background(paper,12));image(photo,p.optString("imageUrl"));box.addView(photo,new LinearLayout.LayoutParams(-1,dp(220)));
        box.addView(text(p.optString("category"),11,muted));box.addView(heading(p.optString("name"),24));box.addView(text(p.optString("description"),14,muted));box.addView(heading(money.format(p.optDouble("price")),23));
        JSONArray sizes=p.optJSONArray("sizes");boolean hasSizes=sizes!=null&&sizes.length()>0;
        Spinner size=new Spinner(this);ArrayList<String> options=new ArrayList<>();options.add("Selecione o tamanho");
        if(hasSizes){for(int i=0;i<sizes.length();i++)options.add(sizes.optString(i));size.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,options));size.setContentDescription("Tamanho");box.addView(size);}
        EditText quantity=field("Quantidade",InputType.TYPE_CLASS_NUMBER);quantity.setText("1");box.addView(text("Quantidade",12,muted));box.addView(quantity);
        ScrollView scroll=new ScrollView(this);scroll.addView(box);
        AlertDialog dialog=new AlertDialog.Builder(this).setView(scroll).setNegativeButton("Fechar",null).create();
        box.addView(primary("Adicionar à sacola",()->{
            if(hasSizes&&size.getSelectedItemPosition()==0){notice("Selecione um tamanho.");return;}
            try{
                int count=ShopRules.quantity(quantity.getText().toString());
                String key=p.optInt("id")+(hasSizes?":"+options.get(size.getSelectedItemPosition()):"");
                if(cart.optInt(key)+count>99){notice("Limite de 99 unidades por item e tamanho.");return;}
                cart.put(key,cart.optInt(key)+count);persist();dialog.dismiss();notice("Produto adicionado à sacola.");render();
            }catch(Exception e){quantity.setError(e.getMessage());}
        }));
        box.addView(text("Preço demonstrativo. Você pode simular a compra pela sacola.",11,muted));dialog.show();
    }
    private int cartCount(){int count=0;Iterator<String> keys=cart.keys();while(keys.hasNext()){int q=cart.optInt(keys.next());if(q>0&&q<=99)count+=q;}return count;}
    private JSONObject product(int id){for(int i=0;i<products.length();i++){JSONObject p=products.optJSONObject(i);if(p!=null&&p.optInt("id")==id)return p;}return null;}
    private void showCart() {
        content.addView(text("SEU INVENTÁRIO",10,green));content.addView(heading("Minha sacola",29));
        if(cart.length()==0){content.addView(text("Sua sacola está vazia. Encontre algo com a sua cara no bazar.",16,muted));content.addView(primary("Explorar produtos",()->{screen="Loja";render();}));return;}
        long total=0;Iterator<String> iterator=cart.keys();ArrayList<String> keys=new ArrayList<>();while(iterator.hasNext())keys.add(iterator.next());
        for(String key:keys){
            String[] parts=key.split(":");int id;try{id=Integer.parseInt(parts[0]);}catch(Exception bad){cart.remove(key);continue;}
            JSONObject p=product(id);int quantity=cart.optInt(key);if(quantity<1||quantity>99){cart.remove(key);continue;}
            LinearLayout item=column();item.setPadding(dp(14),dp(12),dp(14),dp(12));item.setBackground(background(paper,10));
            if(p==null)item.addView(text("Produto indisponível no catálogo atual.",14,muted));
            else {
                total+=ShopRules.lineTotal(p.optDouble("price"),quantity);
                item.addView(heading(p.optString("name")+(parts.length>1?" · "+parts[1]:""),16));
                item.addView(text(money.format(p.optDouble("price"))+" por unidade",13,muted));
            }
            LinearLayout controls=row();
            Button minus=button("−",()->changeQuantity(key,-1));minus.setContentDescription("Diminuir quantidade");controls.addView(minus,new LinearLayout.LayoutParams(dp(52),dp(48)));
            TextView amount=heading(String.valueOf(quantity),16);amount.setGravity(Gravity.CENTER);controls.addView(amount,new LinearLayout.LayoutParams(dp(38),dp(48)));
            Button plus=button("+",()->changeQuantity(key,1));plus.setContentDescription("Aumentar quantidade");controls.addView(plus,new LinearLayout.LayoutParams(dp(52),dp(48)));
            controls.addView(button("Remover",()->{cart.remove(key);persist();render();}),new LinearLayout.LayoutParams(0,dp(48),1));item.addView(controls);content.addView(item);gap(content,12);
        }
        content.addView(heading("Subtotal  "+money.format(total/100.0),24));
        content.addView(text("Finalize uma compra simulada com endereço e frete demonstrativo. Nenhuma cobrança ou entrega real.",14,muted));
        content.addView(primary("Finalizar compra",this::checkout));
        if(offline)content.addView(text("Catálogo offline: confira os preços ao reconectar.",13,muted));
    }
    private void changeQuantity(String key,int delta){int n=cart.optInt(key)+delta;if(n>99){notice("Limite de 99 unidades.");return;}try{if(n<1)cart.remove(key);else cart.put(key,n);}catch(Exception ignored){}persist();render();}
    private void checkout() {
        if(user==null){screen="Conta";render();notice("Entre na sua conta para finalizar a compra simulada.");return;}
        LinearLayout form=column();form.setPadding(dp(20),dp(12),dp(20),dp(16));
        form.addView(text("Use dados fictícios. Não haverá cobrança ou entrega real.",13,muted));
        String[] keys={"recipient","phone","postalCode","street","number","complement","district","city"};
        String[] labels={"Quem vai receber?","Telefone com DDD","CEP","Rua ou avenida","Número ou S/N","Complemento (opcional)","Bairro","Cidade"};
        Map<String,EditText> fields=new LinkedHashMap<>();
        for(int i=0;i<keys.length;i++){
            form.addView(text(labels[i],12,ink));
            EditText input=field(labels[i],keys[i].equals("phone")?InputType.TYPE_CLASS_PHONE:keys[i].equals("postalCode")?InputType.TYPE_CLASS_NUMBER:InputType.TYPE_CLASS_TEXT);
            fields.put(keys[i],input);form.addView(input);
        }
        fields.get("recipient").setText(user.optString("name"));
        form.addView(text("Estado",12,ink));Spinner state=new Spinner(this);state.setContentDescription("Estado de entrega");
        String[] states="Selecione AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
        state.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,states));form.addView(state);
        TextView status=text("Frete simulado: R$ 19,90. Grátis a partir de R$ 299,00.",13,muted);form.addView(status);
        Button review=primary("Revisar pedido",()->{});form.addView(review);
        ScrollView scroll=new ScrollView(this);scroll.addView(form);
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Endereço de entrega").setView(scroll).setNegativeButton("Voltar",null).create();
        review.setOnClickListener(v->{
            if(state.getSelectedItemPosition()==0){status.setText("Selecione o estado de entrega.");return;}
            JSONObject address=new JSONObject();JSONArray items=new JSONArray();JSONObject body=new JSONObject();
            try {
                for(String key:keys)address.put(key,fields.get(key).getText().toString().trim());address.put("state",state.getSelectedItem().toString());
                Iterator<String> iterator=cart.keys();while(iterator.hasNext()){String key=iterator.next();String[] parts=key.split(":",2);JSONObject item=new JSONObject();item.put("productId",Integer.parseInt(parts[0]));item.put("quantity",cart.optInt(key));item.put("size",parts.length>1?parts[1]:"");items.put(item);}
                body.put("items",items);body.put("address",address);
            }catch(Exception error){status.setText("Confira os itens da sacola.");return;}
            review.setEnabled(false);status.setText("Calculando resumo…");
            api.request("POST","/orders/quote",body,(data,error)->{
                if(destroyed)return;review.setEnabled(true);
                if(error!=null){status.setText(error);return;}status.setText("Confira os dados antes de confirmar.");
                try{body.put("address",data.getJSONObject("address"));body.put("expectedTotalCents",data.getLong("totalCents"));confirmOrder(body,data,dialog);}catch(Exception invalid){status.setText("Não foi possível calcular o pedido.");}
            });
        });dialog.show();
    }
    private String orderSummary(JSONObject order) {
        StringBuilder summary=new StringBuilder();JSONArray items=order.optJSONArray("items");
        if(items!=null)for(int i=0;i<items.length();i++){JSONObject item=items.optJSONObject(i);if(item==null)continue;summary.append(item.optInt("quantity")).append(" × ").append(item.optString("name"));if(!item.optString("size").isEmpty())summary.append(" · ").append(item.optString("size"));summary.append("\n");}
        summary.append("\nProdutos: ").append(money.format(order.optLong("subtotalCents")/100.0));
        summary.append("\nFrete simulado: ").append(money.format(order.optLong("shippingCents")/100.0));
        summary.append("\nTotal: ").append(money.format(order.optLong("totalCents")/100.0));
        JSONObject a=order.optJSONObject("address");if(a!=null)summary.append("\n\n").append(a.optString("recipient")).append("\n").append(a.optString("street")).append(", ").append(a.optString("number")).append(" ").append(a.optString("complement")).append("\n").append(a.optString("district")).append(" · ").append(a.optString("city")).append("/").append(a.optString("state")).append("\nCEP ").append(a.optString("postalCode"));
        return summary.toString();
    }
    private void confirmOrder(JSONObject body,JSONObject quote,AlertDialog addressDialog) {
        LinearLayout box=column();box.setPadding(dp(20),dp(12),dp(20),dp(16));box.addView(text(orderSummary(quote),15,ink));
        box.addView(text("Pagamento de demonstração. Nenhuma cobrança ou envio real. Prazo ilustrativo: 5 a 10 dias úteis.",13,muted));
        TextView status=text("",13,muted);box.addView(status);ScrollView scroll=new ScrollView(this);scroll.addView(box);
        String requestKey=UUID.randomUUID().toString();
        AlertDialog confirm=new AlertDialog.Builder(this).setTitle("Revisar pedido").setView(scroll).setNegativeButton("Voltar",null).setPositiveButton("Confirmar simulação",null).create();
        confirm.setOnShowListener(ignored->confirm.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
            confirm.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);confirm.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(false);confirm.setCancelable(false);status.setText("Registrando pedido…");
            api.request("POST","/orders",body,requestKey,(data,error)->{
                if(destroyed)return;
                if(error!=null){status.setText(error+" Tente confirmar novamente; a mesma tentativa não gera outro pedido.");confirm.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);confirm.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(true);confirm.setCancelable(true);return;}
                JSONObject order=data.optJSONObject("order");if(order==null){status.setText("Resposta inválida. Tente novamente.");confirm.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);return;}
                JSONArray items=body.optJSONArray("items");
                for(int i=0;i<items.length();i++){JSONObject item=items.optJSONObject(i);String key=item.optInt("productId")+(item.optString("size").isEmpty()?"":":"+item.optString("size"));int remaining=cart.optInt(key)-item.optInt("quantity");try{if(remaining>0)cart.put(key,remaining);else cart.remove(key);}catch(Exception ignoredError){}}
                persist();confirm.dismiss();addressDialog.dismiss();render();
                new AlertDialog.Builder(this).setTitle("Pedido simulado confirmado").setMessage("Pedido "+order.optString("id")+"\n\n"+orderSummary(order)+"\n\nNenhum valor foi cobrado. Não haverá entrega real.").setPositiveButton("Continuar explorando",(d,w)->{screen="Loja";render();}).show();
            });
        }));confirm.show();
    }
    private void showAccount() {
        content.addView(text("SUA CONTA NO BAZAR",10,green));
        if(user!=null) {
            content.addView(heading("Olá, "+user.optString("name"),28));content.addView(text(user.optString("email"),15,muted));gap(content,20);
            Button logout=primary("Sair da conta",()->api.request("POST","/auth/logout",null,(data,error)->{
                if(destroyed)return;if(error!=null){notice(error);return;}user=null;render();
            }));content.addView(logout);return;
        }
        content.addView(heading("Bom te ver por aqui.",27));content.addView(text("Entre com a mesma conta que você usa no site.",14,muted));
        EditText email=field("E-mail",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        EditText password=field("Senha",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);content.addView(email);content.addView(password);
        TextView status=text("",13,Color.rgb(158,64,47));content.addView(status);
        Button login=primary("Entrar",()->{});content.addView(login);
        login.setOnClickListener(v->{
            if(!android.util.Patterns.EMAIL_ADDRESS.matcher(email.getText().toString().trim()).matches()){email.setError("Informe um e-mail válido.");return;}
            if(password.length()==0){password.setError("Informe sua senha.");return;}
            JSONObject body=new JSONObject();try{body.put("email",email.getText().toString().trim());body.put("password",password.getText().toString());}catch(Exception ignored){}
            login.setEnabled(false);status.setText("Entrando…");
            api.request("POST","/auth/login",body,(data,error)->{
                if(destroyed)return;login.setEnabled(true);
                if(error!=null){status.setText(error);return;}user=data.optJSONObject("user");password.setText("");
                if(user==null){status.setText("Resposta de login inválida.");return;}hideKeyboard();render();
            });
        });
        gap(content,8);content.addView(button("Ainda não tenho conta",this::register));
        content.addView(text("Sua senha não é salva no aparelho. A sessão usa os cookies da API e é validada pelo servidor.",12,muted));
    }
    private void register() {
        LinearLayout form=column();form.setPadding(dp(20),dp(12),dp(20),dp(16));
        EditText name=field("Nome completo",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        EditText email=field("E-mail",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        EditText pass=field("Senha (mínimo 8 caracteres)",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        EditText confirm=field("Confirme sua senha",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        form.addView(name);form.addView(email);form.addView(pass);form.addView(confirm);TextView status=text("",13,Color.rgb(158,64,47));form.addView(status);
        ScrollView scroll=new ScrollView(this);scroll.addView(form);
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Criar conta").setView(scroll).setNegativeButton("Cancelar",null).create();
        Button submit=primary("Criar minha conta",()->{});form.addView(submit);
        submit.setOnClickListener(v->{
            if(name.length()<2){name.setError("Informe seu nome.");return;}
            if(!android.util.Patterns.EMAIL_ADDRESS.matcher(email.getText().toString().trim()).matches()){email.setError("Informe um e-mail válido.");return;}
            if(pass.length()<8){pass.setError("Use pelo menos 8 caracteres.");return;}
            if(!pass.getText().toString().equals(confirm.getText().toString())){confirm.setError("As senhas não coincidem.");return;}
            JSONObject body=new JSONObject();try{body.put("name",name.getText().toString().trim());body.put("email",email.getText().toString().trim());body.put("password",pass.getText().toString());body.put("confirmPassword",confirm.getText().toString());}catch(Exception ignored){}
            submit.setEnabled(false);status.setText("Criando conta…");
            api.request("POST","/auth/register",body,(data,error)->{if(destroyed)return;submit.setEnabled(true);if(error!=null){status.setText(error);return;}user=data.optJSONObject("user");if(user==null){status.setText("Resposta de cadastro inválida.");return;}dialog.dismiss();hideKeyboard();render();});
        });dialog.show();
    }
    private void hideKeyboard(){View v=getCurrentFocus();if(v!=null)((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(v.getWindowToken(),0);}
    private void image(ImageView view,String path) {
        if(path.isEmpty())return;
        final String url;
        try{url=new URL(new URL(api.base()+"/"),path).toString();}catch(Exception e){return;}
        view.setTag(url);Bitmap existing=imageCache.get(url);if(existing!=null){view.setImageBitmap(existing);return;}
        images.execute(()->{
            Bitmap bitmap=null;HttpURLConnection connection=null;
            try {
                connection=(HttpURLConnection)new URL(url).openConnection();connection.setConnectTimeout(8000);connection.setReadTimeout(12000);
                if(connection.getResponseCode()==200){BitmapFactory.Options opts=new BitmapFactory.Options();opts.inSampleSize=2;try(InputStream stream=connection.getInputStream()){bitmap=BitmapFactory.decodeStream(stream,null,opts);}}
            }catch(Exception ignored){}finally{if(connection!=null)connection.disconnect();}
            final Bitmap result=bitmap;
            if(result!=null){imageCache.put(url,result);runOnUiThread(()->{if(!destroyed&&url.equals(view.getTag()))view.setImageBitmap(result);});}
        });
    }
    @Override public void onBackPressed(){if(!screen.equals("Loja")){screen="Loja";render();}else super.onBackPressed();}
    @Override protected void onDestroy(){destroyed=true;api.close();images.shutdownNow();super.onDestroy();}
}
