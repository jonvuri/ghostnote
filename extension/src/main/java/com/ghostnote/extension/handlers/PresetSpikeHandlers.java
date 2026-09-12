package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.BrowserFilterColumn;
import com.bitwig.extension.controller.api.BrowserFilterItem;
import com.bitwig.extension.controller.api.BrowserFilterItemBank;
import com.bitwig.extension.controller.api.BrowserResultsItem;
import com.bitwig.extension.controller.api.Device;
import com.bitwig.extension.controller.api.DeviceBank;
import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.ControllerHost;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Internal D03 operations for plug-in preset file and popup-browser tests. */
public final class PresetSpikeHandlers extends HandlerGroup {
    public PresetSpikeHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("spike.preset.deviceStatus", params -> deviceStatus(params));
        r.on("spike.preset.createTrack", params -> createTrack(params));
        r.on("spike.preset.browserPrepareContentType", params -> browserPrepareContentType(params));
        r.on("spike.preset.browserOpen", params -> browserOpen(params));
        r.on("spike.preset.browserStatus", params -> browserStatus());
        r.on("spike.preset.browserSetContentType", params -> browserSetContentType(params));
        r.on("spike.preset.browserScroll", params -> browserScroll(params));
        r.on("spike.preset.browserSelectFilter", params -> browserSelectFilter(params));
        r.on("spike.preset.browserSelectResult", params -> browserSelectResult(params));
        r.on("spike.preset.browserSetAudition", params -> browserSetAudition(params));
        r.on("spike.preset.browserCommit", params -> browserCommit(params));
        r.on("spike.preset.browserCancel", params -> browserCancel());
    }

    private JsonElement createTrack(JsonObject params) {
        int position = params.get("position").getAsInt();
        String type = params.get("type").getAsString();
        if ("audio".equals(type)) {
            rig.application.createAudioTrack(position);
        } else if ("effect".equals(type)) {
            rig.application.createEffectTrack(position);
        } else {
            throw new IllegalArgumentException("D03 track type must be audio or effect");
        }
        return ok();
    }

    private JsonElement browserPrepareContentType(JsonObject params) {
        int index = params.get("index").getAsInt();
        if (index < 0) {
            throw new IllegalArgumentException("content type index must not be negative");
        }
        rig.presetBrowser.selectedContentTypeIndex().set(index);
        JsonObject result = ok();
        result.addProperty("requested", index);
        result.addProperty("visible", rig.presetBrowser.exists().get());
        return result;
    }

    private JsonElement deviceStatus(JsonObject params) {
        int cursorIndex = params.has("cursor") ? params.get("cursor").getAsInt() : 0;
        int deviceIndex = params.get("deviceIndex").getAsInt();
        if (cursorIndex != 0) {
            throw new IllegalArgumentException("D03 preset proof uses cursor 0 only");
        }
        if (deviceIndex < 0 || deviceIndex >= rig.config.deviceBank) {
            throw new IllegalArgumentException("deviceIndex is outside the configured bank");
        }
        Device device = rig.cursorDeviceBanks[cursorIndex].getDevice(deviceIndex);
        JsonObject result = new JsonObject();
        result.addProperty("exists", device.exists().get());
        result.addProperty("index", deviceIndex);
        result.addProperty("name", device.name().get());
        result.addProperty("presetName", device.presetName().get());
        result.addProperty("presetCreator", device.presetCreator().get());
        result.addProperty("presetCategory", device.presetCategory().get());
        result.addProperty("enabled", device.isEnabled().get());
        result.addProperty("isPlugin", device.isPlugin().get());
        result.addProperty("deviceType", device.deviceType().get());
        result.addProperty("trackChannelId", rig.cursorTracks[cursorIndex].channelId().get());
        return result;
    }

    private JsonElement browserOpen(JsonObject params) {
        int cursorIndex = params.has("cursor") ? params.get("cursor").getAsInt() : 0;
        if (cursorIndex < 0 || cursorIndex >= rig.cursorDeviceBanks.length) {
            throw new IllegalArgumentException("cursor is outside the configured pool");
        }
        String expectedTrackChannelId = params.get("expectedTrackChannelId").getAsString();
        String actualTrackChannelId = rig.cursorTracks[cursorIndex].channelId().get();
        if (!expectedTrackChannelId.equals(actualTrackChannelId)) {
            throw new IllegalArgumentException("browser target track changed");
        }
        JsonArray expectedNames = params.getAsJsonArray("expectedDeviceNames");
        DeviceBank bank = rig.cursorDeviceBanks[cursorIndex];
        if (bank.itemCount().get() != expectedNames.size()) {
            throw new IllegalArgumentException("browser target device count changed");
        }
        for (int index = 0; index < expectedNames.size(); index++) {
            String expectedName = expectedNames.get(index).getAsString();
            Device actual = bank.getDevice(index);
            if (!actual.exists().get() || !expectedName.equals(actual.name().get())) {
                throw new IllegalArgumentException("browser target device chain changed at " + index);
            }
        }
        if (params.has("replaceDeviceIndex")) {
            int deviceIndex = params.get("replaceDeviceIndex").getAsInt();
            if (deviceIndex < 0 || deviceIndex >= expectedNames.size()) {
                throw new IllegalArgumentException("replacement device is outside the guarded chain");
            }
            bank.getDevice(deviceIndex).replaceDeviceInsertionPoint().browse();
        } else {
            rig.cursorTracks[cursorIndex].endOfDeviceChainInsertionPoint().browse();
        }
        return ok();
    }

    private JsonElement browserStatus() {
        JsonObject result = new JsonObject();
        result.addProperty("exists", rig.presetBrowser.exists().get());
        result.addProperty("title", rig.presetBrowser.title().get());
        JsonArray contentTypes = new JsonArray();
        for (String name : rig.presetBrowser.contentTypeNames().get()) contentTypes.add(name);
        result.add("contentTypes", contentTypes);
        result.addProperty("selectedContentType", rig.presetBrowser.selectedContentTypeName().get());
        result.addProperty("selectedContentTypeIndex", rig.presetBrowser.selectedContentTypeIndex().get());
        result.addProperty("canAudition", rig.presetBrowser.canAudition().get());
        result.addProperty("shouldAudition", rig.presetBrowser.shouldAudition().get());

        JsonArray filters = new JsonArray();
        for (int columnIndex = 0; columnIndex < rig.presetBrowserFilters.length; columnIndex++) {
            filters.add(filterStatus(columnIndex));
        }
        result.add("filters", filters);

        JsonObject results = new JsonObject();
        results.addProperty("entryCount", rig.presetBrowser.resultsColumn().entryCount().get());
        results.addProperty("itemCount", rig.presetBrowserResults.itemCount().get());
        results.addProperty("scrollPosition", rig.presetBrowserResults.scrollPosition().get());
        results.addProperty("canScrollBackwards", rig.presetBrowserResults.canScrollBackwards().get());
        results.addProperty("canScrollForwards", rig.presetBrowserResults.canScrollForwards().get());
        JsonArray resultItems = new JsonArray();
        int resultStart = rig.presetBrowserResults.scrollPosition().get();
        for (int itemIndex = 0; itemIndex < Rig.PRESET_BROWSER_BANK; itemIndex++) {
            BrowserResultsItem item = rig.presetBrowserResults.getItemAt(itemIndex);
            if (!item.exists().get()) continue;
            JsonObject row = new JsonObject();
            row.addProperty("index", resultStart + itemIndex);
            row.addProperty("name", item.name().get());
            row.addProperty("selected", item.isSelected().get());
            resultItems.add(row);
        }
        results.add("items", resultItems);
        result.add("results", results);
        result.addProperty("guard", sha256(result.toString()));
        return result;
    }

    private JsonObject filterStatus(int columnIndex) {
        BrowserFilterColumn column = rig.presetBrowserFilters[columnIndex];
        BrowserFilterItemBank bank = rig.presetBrowserFilterBanks[columnIndex];
        JsonObject result = new JsonObject();
        result.addProperty("key", Rig.PRESET_BROWSER_FILTER_NAMES[columnIndex]);
        result.addProperty("exists", column.exists().get());
        result.addProperty("name", column.name().get());
        result.addProperty("entryCount", column.entryCount().get());
        result.addProperty("itemCount", bank.itemCount().get());
        result.addProperty("scrollPosition", bank.scrollPosition().get());
        result.addProperty("canScrollBackwards", bank.canScrollBackwards().get());
        result.addProperty("canScrollForwards", bank.canScrollForwards().get());
        BrowserFilterItem wildcard = column.getWildcardItem();
        JsonObject wildcardStatus = new JsonObject();
        wildcardStatus.addProperty("exists", wildcard.exists().get());
        wildcardStatus.addProperty("name", wildcard.name().get());
        wildcardStatus.addProperty("selected", wildcard.isSelected().get());
        wildcardStatus.addProperty("hitCount", wildcard.hitCount().get());
        result.add("wildcard", wildcardStatus);
        JsonArray items = new JsonArray();
        int start = bank.scrollPosition().get();
        for (int itemIndex = 0; itemIndex < Rig.PRESET_BROWSER_BANK; itemIndex++) {
            BrowserFilterItem item = bank.getItemAt(itemIndex);
            if (!item.exists().get()) continue;
            JsonObject row = new JsonObject();
            row.addProperty("index", start + itemIndex);
            row.addProperty("name", item.name().get());
            row.addProperty("selected", item.isSelected().get());
            row.addProperty("hitCount", item.hitCount().get());
            items.add(row);
        }
        result.add("items", items);
        return result;
    }

    private JsonElement browserSetContentType(JsonObject params) {
        int index = params.get("index").getAsInt();
        String[] names = rig.presetBrowser.contentTypeNames().get();
        if (index < 0 || index >= names.length) {
            throw new IllegalArgumentException("content type index is outside the current list");
        }
        int before = rig.presetBrowser.selectedContentTypeIndex().get();
        if (params.has("relative") && params.get("relative").getAsBoolean()) {
            rig.presetBrowser.selectedContentTypeIndex().inc(index - before);
        } else {
            rig.presetBrowser.selectedContentTypeIndex().set(index);
        }
        JsonObject result = ok();
        result.addProperty("before", before);
        result.addProperty("requested", index);
        return result;
    }

    private JsonElement browserScroll(JsonObject params) {
        String target = params.get("target").getAsString();
        int position = params.get("position").getAsInt();
        if ("results".equals(target)) {
            rig.presetBrowserResults.scrollIntoView(position);
        } else {
            rig.presetBrowserFilterBanks[filterIndex(target)].scrollIntoView(position);
        }
        return ok();
    }

    private JsonElement browserSelectFilter(JsonObject params) {
        int columnIndex = filterIndex(params.get("column").getAsString());
        BrowserFilterColumn column = rig.presetBrowserFilters[columnIndex];
        if (params.has("wildcard") && params.get("wildcard").getAsBoolean()) {
            column.getWildcardItem().isSelected().set(true);
            return ok();
        }
        int index = params.get("index").getAsInt();
        BrowserFilterItemBank bank = rig.presetBrowserFilterBanks[columnIndex];
        int start = bank.scrollPosition().get();
        int offset = index - start;
        if (offset < 0 || offset >= Rig.PRESET_BROWSER_BANK
                || !bank.getItemAt(offset).exists().get()) {
            throw new IllegalArgumentException("filter item is outside the current bank window");
        }
        bank.getItemAt(offset).isSelected().set(true);
        return ok();
    }

    private JsonElement browserSelectResult(JsonObject params) {
        int index = params.get("index").getAsInt();
        int start = rig.presetBrowserResults.scrollPosition().get();
        int offset = index - start;
        if (offset < 0 || offset >= Rig.PRESET_BROWSER_BANK
                || !rig.presetBrowserResults.getItemAt(offset).exists().get()) {
            throw new IllegalArgumentException("result is outside the current bank window");
        }
        rig.presetBrowserResults.getItemAt(offset).isSelected().set(true);
        return ok();
    }

    private JsonElement browserSetAudition(JsonObject params) {
        rig.presetBrowser.shouldAudition().set(params.get("enabled").getAsBoolean());
        return ok();
    }

    private JsonElement browserCommit(JsonObject params) {
        String expectedGuard = params.get("expectedGuard").getAsString();
        JsonObject status = browserStatus().getAsJsonObject();
        if (!expectedGuard.equals(status.get("guard").getAsString())) {
            throw new IllegalArgumentException("popup browser state changed before commit");
        }
        rig.presetBrowser.commit();
        return ok();
    }

    private JsonElement browserCancel() {
        rig.presetBrowser.cancel();
        return ok();
    }

    private int filterIndex(String key) {
        for (int index = 0; index < Rig.PRESET_BROWSER_FILTER_NAMES.length; index++) {
            if (Rig.PRESET_BROWSER_FILTER_NAMES[index].equals(key)) return index;
        }
        throw new IllegalArgumentException("unknown browser filter column: " + key);
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder();
            for (byte item : digest) result.append(String.format("%02x", item));
            return result.toString();
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
