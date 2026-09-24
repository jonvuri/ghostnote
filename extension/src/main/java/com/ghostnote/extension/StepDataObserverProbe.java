package com.ghostnote.extension;

import com.bitwig.extension.controller.api.Clip;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import java.util.Arrays;

/** Bounded occupancy recorder for the E130 step-data observer follow-up. */
public final class StepDataObserverProbe {
    private final int steps;
    private final int keys;
    private final byte[] states;
    private int generation;
    private long preparedAtNanos = System.nanoTime();
    private long firstCallbackNanos;
    private long lastCallbackNanos;
    private long callbacks;
    private long uniqueCells;
    private long invalidCells;
    private final long[] callbackStates = new long[4];
    private double grid = Rig.STEP_SIZE;
    private int page;

    public StepDataObserverProbe(int steps, int keys) {
        this.steps = steps;
        this.keys = keys;
        states = new byte[steps * keys];
        Arrays.fill(states, (byte) -1);
    }

    /** Register the init-only Bitwig observer. */
    public void attach(Clip clip) {
        clip.addStepDataObserver(this::record);
    }

    /** Clear the bounded view before one target, grid, page, or mutation arm. */
    public JsonObject prepare() {
        generation++;
        Arrays.fill(states, (byte) -1);
        Arrays.fill(callbackStates, 0);
        preparedAtNanos = System.nanoTime();
        firstCallbackNanos = 0;
        lastCallbackNanos = 0;
        callbacks = 0;
        uniqueCells = 0;
        invalidCells = 0;
        return state();
    }

    public void setGrid(double value) {
        grid = value;
    }

    public void setPage(int value) {
        page = value;
    }

    /** Return aggregate coverage and the current non-empty occupancy map. */
    public JsonObject read() {
        return state();
    }

    private void record(int x, int y, int state) {
        long now = System.nanoTime();
        if (firstCallbackNanos == 0) firstCallbackNanos = now;
        lastCallbackNanos = now;
        callbacks++;
        callbackStates[state >= 0 && state <= 2 ? state : 3]++;
        if (x < 0 || x >= steps || y < 0 || y >= keys) {
            invalidCells++;
            return;
        }
        int index = x * keys + y;
        if (states[index] == -1) uniqueCells++;
        states[index] = (byte) state;
    }

    private JsonObject state() {
        long now = System.nanoTime();
        long[] currentStates = new long[4];
        JsonArray nonEmpty = new JsonArray();
        for (int x = 0; x < steps; x++) {
            for (int y = 0; y < keys; y++) {
                int state = states[x * keys + y];
                if (state < 0) continue;
                currentStates[state <= 2 ? state : 3]++;
                if (state != 0) {
                    JsonObject cell = new JsonObject();
                    cell.addProperty("x", x);
                    cell.addProperty("y", y);
                    cell.addProperty("state", state);
                    nonEmpty.add(cell);
                }
            }
        }

        JsonObject result = new JsonObject();
        result.addProperty("generation", generation);
        result.addProperty("steps", steps);
        result.addProperty("keys", keys);
        result.addProperty("grid", grid);
        result.addProperty("page", page);
        result.addProperty("callbacks", callbacks);
        result.addProperty("uniqueCells", uniqueCells);
        result.addProperty("repeatedCallbacks", callbacks - uniqueCells - invalidCells);
        result.addProperty("invalidCells", invalidCells);
        result.add("callbackStates", counts(callbackStates));
        result.add("currentStates", counts(currentStates));
        result.addProperty("sincePrepareMicros", (now - preparedAtNanos) / 1_000);
        if (firstCallbackNanos > 0) {
            result.addProperty("firstCallbackMicros", (firstCallbackNanos - preparedAtNanos) / 1_000);
            result.addProperty("lastCallbackMicros", (lastCallbackNanos - preparedAtNanos) / 1_000);
            result.addProperty("callbackSpanMicros", (lastCallbackNanos - firstCallbackNanos) / 1_000);
        }
        result.add("nonEmpty", nonEmpty);
        return result;
    }

    private static JsonObject counts(long[] values) {
        JsonObject result = new JsonObject();
        result.addProperty("empty", values[0]);
        result.addProperty("sustain", values[1]);
        result.addProperty("noteOn", values[2]);
        result.addProperty("other", values[3]);
        return result;
    }

}
