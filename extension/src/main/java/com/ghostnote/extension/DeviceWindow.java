package com.ghostnote.extension;

import com.bitwig.extension.controller.api.Device;
import com.bitwig.extension.controller.api.DeviceBank;
import com.google.gson.JsonArray;

/** Existing device handles, with absolute-position witnesses for page settlement. */
public record DeviceWindow(DeviceBank bank, int width) implements WindowPager.Window {
    @Override public int count() { return bank.itemCount().get(); }
    @Override public int position() { return bank.scrollPosition().get(); }
    @Override public void scroll(int position) { bank.scrollPosition().set(position); }
    @Override public String describe() {
        StringBuilder detail = new StringBuilder("device window " + WindowPager.Window.super.describe());
        for (int i = 0; i < Math.min(width, Math.max(0, count() - position())); i++)
            detail.append("; slot ").append(i).append(" reports ").append(bank.getDevice(i).position().get());
        return detail.toString();
    }
    @Override public JsonArray snapshot() {
        JsonArray rows = new JsonArray();
        int size = Math.min(width, Math.max(0, count() - position()));
        for (int i = 0; i < size; i++) {
            Device device = bank.getDevice(i);
            int absolute = position() + i;
            if (!device.exists().get() || device.position().get() != absolute) return null;
            rows.add(WindowPager.device(absolute, device.name().get(), device.isEnabled().get()));
        }
        return rows;
    }
}
