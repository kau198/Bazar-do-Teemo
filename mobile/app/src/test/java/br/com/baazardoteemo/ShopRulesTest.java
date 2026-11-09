package br.com.baazardoteemo;
import org.junit.Test;
import static org.junit.Assert.*;

public class ShopRulesTest {
    @Test public void acceptsPublishedAndLanOrigins() {
        assertEquals("https://loja.example", ShopRules.serverUrl(" https://loja.example/ "));
        assertEquals("http://192.168.0.5:3000", ShopRules.serverUrl("http://192.168.0.5:3000"));
    }
    @Test public void rejectsCredentialsAndApiPaths() {
        for(String value:new String[]{"file:///tmp/a","https://user:pass@host.com","https://host.com/api/v1","https://host.com?password=a","localhost:3000"}) {
            try {ShopRules.serverUrl(value);fail(value);} catch(IllegalArgumentException expected){}
        }
    }
    @Test public void searchIgnoresAccentsAndCase() {
        assertEquals("pelucia teemo",ShopRules.searchKey("PELÚCIA Teemo"));
    }
    @Test public void quantitiesStayWithinLimits() {
        assertEquals(3,ShopRules.quantity("3"));
        for(String value:new String[]{"0","-1","100","1.5","abc",""}) {
            try {ShopRules.quantity(value);fail(value);}catch(IllegalArgumentException expected){}
        }
    }
    @Test public void subtotalUsesCents() {
        assertEquals(47970L,ShopRules.lineTotal(159.90,3));
        assertEquals(30L,ShopRules.lineTotal(0.10,3));
    }
}
