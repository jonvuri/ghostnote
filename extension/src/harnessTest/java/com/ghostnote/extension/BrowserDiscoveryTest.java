package com.ghostnote.extension;

import com.bitwig.extension.controller.api.*;
import com.google.gson.*;
import java.lang.reflect.*;
import java.util.*;

/** Host-proxy tests exercise the actual handler's ownership and stale-state refusals. */
public final class BrowserDiscoveryTest {
    private static final class Fake implements InvocationHandler {
        final Class<?> type;
        final Map<String, Object> children = new HashMap<>();
        Object value;
        int calls;
        Fake(Class<?> type) { this.type = type; }
        @Override public Object invoke(Object proxy, Method method, Object[] args) {
            String name = method.getName();
            if (name.equals("set")) { value = args[0]; calls++; return null; }
            if (name.equals("get")) {
                if (value != null) return value;
                Class<?> result = method.getReturnType();
                if (result == boolean.class) return false;
                if (result == int.class) return 0;
                if (result == String[].class) return new String[0];
                return "";
            }
            if (method.getReturnType() == void.class) { calls++; return null; }
            Class<?> result = method.getReturnType();
            if (name.equals("getItemAt")) result = type == BrowserFilterItemBank.class
                ? BrowserFilterItem.class : BrowserResultsItem.class;
            Class<?> childType = result;
            return children.computeIfAbsent(name + Arrays.toString(args), key -> proxy(childType));
        }
    }
    private static Object proxy(Class<?> type) {
        return Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] { type }, new Fake(type));
    }
    private static Fake fake(Object proxy) { return (Fake) Proxy.getInvocationHandler(proxy); }
    private static void value(Object proxy, Object value) { fake(proxy).value = value; }
    private static JsonObject params(String operation, BrowserDiscoveryProbe probe) {
        JsonObject value = new JsonObject();
        value.addProperty("operation", operation);
        value.addProperty("token", "owner");
        value.addProperty("guard", probe.status().get("guard").getAsString());
        return value;
    }
    private static void refuses(Runnable action, String message) {
        try { action.run(); } catch (IllegalArgumentException expected) {
            if (!expected.getMessage().contains(message)) throw new AssertionError(expected);
            return;
        }
        throw new AssertionError("did not refuse: " + message);
    }
    public static void main(String[] args) {
        PopupBrowser browser = (PopupBrowser) proxy(PopupBrowser.class);
        value(browser.contentTypeNames(), new String[] { "Devices", "Plug-ins" });
        JsonObject target = JsonParser.parseString("""
            {"project":"R05","generation":"g1","trackId":"t1","trackName":"gn-r05-test",
             "trackExists":true,"deviceCount":0,"selectionRevision":0}
            """).getAsJsonObject();
        int[] opens = { 0 };
        BrowserDiscoveryProbe probe = new BrowserDiscoveryProbe(browser, target::deepCopy, () -> {
            opens[0]++;
            value(browser.exists(), true);
            value(browser.shouldAudition(), true); // E344: the host resets this when opening.
        });
        JsonObject open = params("open", probe);
        open.addProperty("project", "R05");
        open.addProperty("generation", "g1");
        open.addProperty("trackId", "wrong");
        refuses(() -> probe.handle(open), "wrong scratch target");
        if (opens[0] != 0) throw new AssertionError("invalid target opened browser");
        open.addProperty("trackId", "t1");
        probe.handle(open);
        if (opens[0] != 1 || !browser.shouldAudition().get()) throw new AssertionError("host open reset");
        refuses(() -> probe.handle(open), "changed since readback");
        refuses(() -> probe.handle(params("resetFilters", probe)), "audition is enabled");
        probe.handle(params("auditionOff", probe));
        if (browser.shouldAudition().get()) throw new AssertionError("post-open audition disable");
        BrowserFilterColumn location = browser.locationColumn();
        value(location.exists(), true);
        value(location.getWildcardItem().exists(), true);
        BrowserFilterItemBank locations = location.createItemBank(BrowserDiscoveryProbe.PAGE_SIZE);
        value(locations.itemCount(), 2);
        BrowserFilterItem devices = locations.getItemAt(1);
        value(devices.exists(), true);
        value(devices.name(), "Devices");
        int unboundCalls = fake(browser.deviceColumn().getWildcardItem().isSelected()).calls;
        probe.handle(params("resetFilters", probe));
        if (!location.getWildcardItem().isSelected().get()) throw new AssertionError("bound reset missing");
        if (fake(browser.deviceColumn().getWildcardItem().isSelected()).calls != unboundCalls)
            throw new AssertionError("unbound filter was written");
        int resetCalls = fake(location.getWildcardItem().isSelected()).calls;
        value(browser.deviceTypeColumn().exists(), true);
        refuses(() -> probe.handle(params("resetFilters", probe)), "bound filter has no wildcard");
        if (fake(location.getWildcardItem().isSelected()).calls != resetCalls)
            throw new AssertionError("reset wrote before validating all bound filters");
        value(browser.deviceTypeColumn().exists(), false);
        JsonObject bound = params("filterPage", probe);
        bound.addProperty("key", "location");
        bound.addProperty("offset", 1024);
        value(locations.itemCount(), 2000);
        bound.addProperty("guard", probe.status().get("guard").getAsString());
        refuses(() -> probe.handle(bound), "outside bounded scan");
        value(locations.itemCount(), 2);
        JsonObject select = params("filter", probe);
        select.addProperty("key", "location");
        select.addProperty("offset", 1);
        select.addProperty("name", "Wrong");
        refuses(() -> probe.handle(select), "filter identity changed");
        select.addProperty("name", "Devices");
        probe.handle(select);
        if (!devices.isSelected().get()) throw new AssertionError("location selection missing");
        JsonObject absent = params("filterPage", probe);
        absent.addProperty("key", "deviceType");
        absent.addProperty("offset", 0);
        refuses(() -> probe.handle(absent), "filter is absent");
        absent.addProperty("key", "creator");
        refuses(() -> probe.handle(absent), "outside R05 scope");
        JsonObject removed = params("contentType", probe);
        refuses(() -> probe.handle(removed), "unknown browser operation");
        refuses(() -> probe.handle(params("commit", probe)), "unknown browser operation");
        value(browser.resultsColumn().entryCount(), 8);
        JsonObject fractional = params("page", probe);
        fractional.addProperty("contentType", "Devices");
        fractional.addProperty("offset", 0.5);
        refuses(() -> probe.handle(fractional), "outside bounded scan");
        JsonObject stale = params("resetFilters", probe);
        stale.addProperty("contentType", "Devices");
        target.addProperty("selectionRevision", 1);
        refuses(() -> probe.handle(stale), "changed since readback");
        JsonObject changed = params("resetFilters", probe);
        changed.addProperty("contentType", "Devices");
        refuses(() -> probe.handle(changed), "selection changed");
        JsonObject cancel = params("cancel", probe);
        cancel.addProperty("token", "foreign");
        refuses(() -> probe.handle(cancel), "not owned");
        cancel.addProperty("token", "owner");
        probe.handle(cancel); // Cleanup remains possible after selection interference.
        if (probe.status().get("owned").getAsBoolean()) throw new AssertionError("owner not released");
        refuses(() -> probe.handle(params("commit", probe)), "owned browser is not open");
        testScalarMetadata();
        System.out.println("BrowserDiscoveryTest: PASS");
    }
    private static class MetadataBase {
        private final String filename = "fixture.bwpreset";
        private final java.io.File root = new java.io.File("/tmp/library");
        private final Object opaque = new Object() {
            @Override public String toString() { throw new AssertionError("opaque metadata traversed"); }
        };
        private static final String ignored = "static";
    }
    private static final class MetadataItem extends MetadataBase {
        private final java.util.UUID id = java.util.UUID.fromString("00000000-0000-0000-0000-000000000001");
    }
    private static void testScalarMetadata() {
        try {
            JsonArray rows = BrowserResultMetadata.scalarFields(new MetadataItem(), MetadataBase.class);
            if (rows.size() != 3) throw new AssertionError("metadata scope differs: " + rows);
            if (!rows.toString().contains("fixture.bwpreset") || !rows.toString().contains("/tmp/library"))
                throw new AssertionError("metadata scalar values missing");
            if (rows.toString().contains("opaque") || rows.toString().contains("ignored"))
                throw new AssertionError("metadata crossed scalar boundary");
        } catch (IllegalAccessException error) { throw new AssertionError(error); }
    }

}
