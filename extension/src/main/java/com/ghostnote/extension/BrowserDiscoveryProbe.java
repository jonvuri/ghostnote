package com.ghostnote.extension;

import com.bitwig.extension.controller.api.*;
import com.google.gson.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.function.Supplier;

/** R05 discovery only. No result selection or commit; audition can only be disabled. */
public final class BrowserDiscoveryProbe {
    public static final String MARKER = "r05-browser-discovery-v4";
    public static final int PAGE_SIZE = 128;
    private final PopupBrowser browser;
    private final BrowserResultMetadata metadata = new BrowserResultMetadata();
    private final BrowserFilterColumn[] columns;
    private final BrowserFilterItemBank[] filters;
    private final BrowserResultsItemBank results;
    private final Supplier<JsonObject> context;
    private final Runnable browse;
    private String owner;
    private JsonObject ownedContext;
    private boolean observedOpen;
    private long sequence;
    private static final String[] KEYS = {
        "smartCollection", "location", "device", "category", "tag", "deviceType", "fileType", "creator"
    };

    public BrowserDiscoveryProbe(PopupBrowser browser, Supplier<JsonObject> context, Runnable browse) {
        this.browser = browser;
        this.context = context;
        this.browse = browse;
        browser.exists().markInterested();
        browser.title().markInterested();
        browser.contentTypeNames().markInterested();
        browser.selectedContentTypeIndex().markInterested();
        browser.selectedContentTypeName().markInterested();
        browser.shouldAudition().markInterested();
        browser.exists().addValueObserver(value -> {
            if (owner != null && value) observedOpen = true;
            if (!value && observedOpen) release();
        });
        columns = new BrowserFilterColumn[] {
            browser.smartCollectionColumn(), browser.locationColumn(), browser.deviceColumn(),
            browser.categoryColumn(), browser.tagColumn(), browser.deviceTypeColumn(),
            browser.fileTypeColumn(), browser.creatorColumn()
        };
        filters = new BrowserFilterItemBank[columns.length];
        for (int i = 0; i < columns.length; i++) {
            columns[i].exists().markInterested();
            columns[i].entryCount().markInterested();
            mark(columns[i].getWildcardItem());
            filters[i] = columns[i].createItemBank(PAGE_SIZE);
            filters[i].scrollPosition().markInterested();
            filters[i].itemCount().markInterested();
            for (int j = 0; j < PAGE_SIZE; j++) mark(filters[i].getItemAt(j));
        }
        browser.resultsColumn().entryCount().markInterested();
        results = browser.resultsColumn().createItemBank(PAGE_SIZE);
        results.scrollPosition().markInterested();
        for (int j = 0; j < PAGE_SIZE; j++) mark(results.getItemAt(j));
    }

    private static void mark(BrowserItem item) {
        item.exists().markInterested();
        item.name().markInterested();
        item.isSelected().markInterested();
    }

    public JsonObject handle(JsonObject params) {
        String operation = string(params, "operation");
        if (operation.equals("status")) return status();
        String token = string(params, "token");
        if (operation.equals("cancel")) {
            // A closed owned popup is already canceled. Never cancel a replacement popup.
            if (owner == null && !browser.exists().get()) return receipt();
            require(token.equals(owner), "browser is not owned by this token");
            if (browser.exists().get()) browser.cancel();
            release();
            return receipt();
        }
        JsonObject before = status();
        require(string(params, "guard").equals(before.get("guard").getAsString()),
            "browser or target changed since readback");
        if (operation.equals("open")) {
            require(!metadata.pending(), "metadata read is pending");
            require(owner == null && !browser.exists().get(), "a browser session already exists");
            JsonObject target = context.get();
            require(!string(target, "project").isBlank(), "project is unnamed");
            require(string(target, "trackName").startsWith("gn-r05-"), "target is not an R05 scratch track");
            require(target.get("trackExists").getAsBoolean()
                && target.get("deviceCount").getAsInt() == 0, "scratch target is absent or nonempty");
            require(string(params, "project").equals(string(target, "project"))
                && string(params, "generation").equals(string(target, "generation"))
                && string(params, "trackId").equals(string(target, "trackId")), "wrong scratch target");
            owner = token;
            ownedContext = target.deepCopy();
            observedOpen = false;
            sequence++;
            // Keep ownership on an uncertain browse call so the caller can inspect/cancel.
            browser.shouldAudition().set(false);
            browse.run();
            return receipt();
        }
        require(token.equals(owner) && browser.exists().get(), "owned browser is not open");
        require(context.get().equals(ownedContext), "project, target, or selection changed");
        require(!metadata.pending(), "metadata read is pending");
        switch (operation) {
            case "auditionOff" -> browser.shouldAudition().set(false);
            case "resetFilters" -> {
                requireQuiet();
                // E346: device and smart-collection proxies are unbound on 6.1.4.
                for (int i = 0; i < columns.length; i++) if (columns[i].exists().get()) {
                    require(columns[i].getWildcardItem().exists().get(), "bound filter has no wildcard");
                }
                for (int i = 0; i < columns.length; i++) if (columns[i].exists().get()) {
                    columns[i].getWildcardItem().isSelected().set(true);
                    filters[i].scrollPosition().set(0);
                }
                results.scrollPosition().set(0);
            }
            case "filterPage" -> {
                requireQuiet();
                int column = filterColumn(params);
                filters[column].scrollPosition().set(offset(params, filters[column].itemCount().get(), 1024));
            }
            case "filter" -> {
                requireQuiet();
                int column = filterColumn(params);
                String name = string(params, "name");
                int index = offset(params, filters[column].itemCount().get(), 1024);
                int relative = index - filters[column].scrollPosition().get();
                require(relative >= 0 && relative < PAGE_SIZE, "filter item is not on the observed page");
                BrowserFilterItem match = filters[column].getItemAt(relative);
                require(match.exists().get() && name.equals(match.name().get()), "filter identity changed");
                match.isSelected().set(true);
            }
            case "inspectPage" -> {
                requireQuiet();
                // Fixed first 16 visible rows. Caller cannot supply reflection names or native targets.
                int count = Math.min(16, browser.resultsColumn().entryCount().get() - results.scrollPosition().get());
                require(count > 0, "no visible results to inspect");
                BrowserResultsItem[] items = new BrowserResultsItem[count];
                int[] indices = new int[count];
                String[] names = new String[count];
                for (int i = 0; i < count; i++) {
                    items[i] = results.getItemAt(i);
                    require(items[i].exists().get(), "metadata page is incomplete");
                    indices[i] = results.scrollPosition().get() + i;
                    names[i] = items[i].name().get();
                }
                metadata.start(items, indices, names);
            }
            case "page" -> {
                requireQuiet();
                results.scrollPosition().set(offset(params, browser.resultsColumn().entryCount().get(), 4096));
            }
            default -> throw new IllegalArgumentException("unknown browser operation: " + operation);
        }
        sequence++;
        return receipt();
    }

    private void requireQuiet() {
        require(!browser.shouldAudition().get(), "browser audition is enabled");
    }

    private int filterColumn(JsonObject params) {
        String key = string(params, "key");
        require(key.equals("location") || key.equals("deviceType"), "filter outside R05 scope");
        for (int i = 0; i < KEYS.length; i++) if (KEYS[i].equals(key)) {
            require(columns[i].exists().get(), "filter is absent");
            return i;
        }
        throw new IllegalArgumentException("unknown filter");
    }

    private static int offset(JsonObject params, int count, int limit) {
        JsonElement value = params.get("offset");
        require(value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isNumber(),
            "page offset must be an integer");
        double offset = value.getAsDouble();
        require(Double.isFinite(offset) && offset == Math.rint(offset) && offset >= 0
            && offset < count && offset < limit, "page offset outside bounded scan");
        return (int) offset;
    }

    public JsonObject status() {
        JsonObject value = new JsonObject();
        value.addProperty("marker", MARKER);
        value.addProperty("sequence", sequence);
        value.add("metadata", metadata.status());
        value.addProperty("owned", owner != null);
        value.add("context", context.get());
        value.addProperty("exists", browser.exists().get());
        value.addProperty("title", browser.title().get());
        value.add("contentTypes", new Gson().toJsonTree(browser.contentTypeNames().get()));
        value.addProperty("contentTypeIndex", browser.selectedContentTypeIndex().get());
        value.addProperty("contentTypeName", browser.selectedContentTypeName().get());
        value.addProperty("shouldAudition", browser.shouldAudition().get());
        JsonArray filterRows = new JsonArray();
        for (int i = 0; i < columns.length; i++) {
            JsonObject column = new JsonObject();
            column.addProperty("key", KEYS[i]);
            column.addProperty("exists", columns[i].exists().get());
            column.addProperty("count", columns[i].entryCount().get());
            column.addProperty("bankCount", filters[i].itemCount().get());
            column.addProperty("offset", filters[i].scrollPosition().get());
            column.add("wildcard", item(columns[i].getWildcardItem(), -1));
            column.add("items", items(filters[i]));
            filterRows.add(column);
        }
        value.add("filters", filterRows);
        value.addProperty("resultCount", browser.resultsColumn().entryCount().get());
        value.addProperty("resultOffset", results.scrollPosition().get());
        value.add("results", items(results));
        try {
            value.addProperty("guard", HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(value.toString().getBytes(StandardCharsets.UTF_8))));
        } catch (java.security.NoSuchAlgorithmException error) {
            throw new IllegalStateException(error);
        }
        return value;
    }

    private static JsonArray items(BrowserItemBank<?> bank) {
        JsonArray rows = new JsonArray();
        for (int i = 0; i < PAGE_SIZE; i++) {
            BrowserItem item = bank.getItemAt(i);
            if (item.exists().get()) rows.add(item(item, bank.scrollPosition().get() + i));
        }
        return rows;
    }

    private static JsonObject item(BrowserItem item, int index) {
        JsonObject value = new JsonObject();
        value.addProperty("index", index);
        value.addProperty("exists", item.exists().get());
        value.addProperty("name", item.name().get());
        value.addProperty("selected", item.isSelected().get());
        return value;
    }

    private void release() { owner = null; ownedContext = null; observedOpen = false; sequence++; }
    private static JsonObject receipt() {
        JsonObject value = new JsonObject();
        value.addProperty("requested", true);
        value.addProperty("readbackRequired", true);
        return value;
    }
    private static String string(JsonObject value, String key) {
        JsonElement item = value.get(key);
        require(item != null && item.isJsonPrimitive() && item.getAsJsonPrimitive().isString()
            && !item.getAsString().isEmpty(), key + " must be a nonempty string");
        return item.getAsString();
    }
    private static void require(boolean condition, String message) {
        if (!condition) throw new IllegalArgumentException(message);
    }
}
