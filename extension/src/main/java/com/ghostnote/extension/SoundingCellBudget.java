package com.ghostnote.extension;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 8h1b admission by resident sounding cells. The host keeps one note step for each sounding cell of each
 * full-width proxy bound to a clip (E225). The cache knows the cells of a clip only after it reads the clip,
 * so admission follows the read. A clip above the per-clip limit or the budget is refused; its proxy must be
 * released. Otherwise the least recently used residents are evicted until the clip fits. The caller releases
 * each evicted proxy with the measured release action. Research only.
 */
public final class SoundingCellBudget {
    public record Decision(boolean admitted, String reason, List<String> evicted, long residentCells) {}

    private long budgetCells = Long.MAX_VALUE, clipLimitCells = Long.MAX_VALUE, residentCells;
    private final LinkedHashMap<String, Long> residents = new LinkedHashMap<>(16, 0.75f, true);
    private long admissions, refusals, evictions;

    public void configure(long budget, long clipLimit) {
        if (budget < 1 || clipLimit < 1 || clipLimit > budget) throw new IllegalArgumentException("invalid sounding-cell budget");
        budgetCells = budget; clipLimitCells = clipLimit;
    }

    /**
     * Admit {@code key} with its measured cells. A resident key is replaced by its new cell count. The keys in
     * {@code busy} are not evicted, for example a handle that a read still uses.
     */
    public Decision admit(String key, long cells, Set<String> busy) {
        if (key == null || key.isEmpty() || cells < 0) throw new IllegalArgumentException("invalid admission");
        Long prior = residents.remove(key);
        if (prior != null) residentCells -= prior;
        if (cells > clipLimitCells) { refusals++; return new Decision(false, "clip-sounding-cells-exceed-limit", List.of(), residentCells); }
        if (cells > budgetCells) { refusals++; return new Decision(false, "clip-sounding-cells-exceed-budget", List.of(), residentCells); }
        List<String> evicted = new ArrayList<>();
        var order = residents.entrySet().iterator();
        while (residentCells + cells > budgetCells && order.hasNext()) {
            Map.Entry<String, Long> entry = order.next();
            if (busy.contains(entry.getKey())) continue;
            evicted.add(entry.getKey()); residentCells -= entry.getValue(); order.remove();
        }
        if (residentCells + cells > budgetCells) {
            // Busy residents hold the budget. Refuse instead of exceeding it.
            refusals++;
            return new Decision(false, "busy-residents-hold-budget", evicted, residentCells);
        }
        residents.put(key, cells); residentCells += cells; admissions++; evictions += evicted.size();
        return new Decision(true, "admitted", evicted, residentCells);
    }

    /** A warm read refreshes the eviction order. */
    public boolean touch(String key) { return residents.get(key) != null; }

    /** The caller released this proxy. */
    public boolean release(String key) {
        Long cells = residents.remove(key);
        if (cells == null) return false;
        residentCells -= cells; return true;
    }

    public long residentCells() { return residentCells; }
    public List<String> order() { return List.copyOf(residents.keySet()); }

    public JsonObject status() {
        JsonObject result = new JsonObject();
        result.addProperty("budgetCells", budgetCells == Long.MAX_VALUE ? -1 : budgetCells);
        result.addProperty("clipLimitCells", clipLimitCells == Long.MAX_VALUE ? -1 : clipLimitCells);
        result.addProperty("residentCells", residentCells);
        result.addProperty("admissions", admissions);
        result.addProperty("refusals", refusals);
        result.addProperty("evictions", evictions);
        JsonArray order = new JsonArray();
        residents.forEach((key, cells) -> { JsonArray row = new JsonArray(); row.add(key); row.add(cells); order.add(row); });
        result.add("lruOrder", order);
        return result;
    }

    public static JsonObject json(Decision decision) {
        JsonObject result = new JsonObject();
        result.addProperty("admitted", decision.admitted());
        result.addProperty("reason", decision.reason());
        JsonArray evicted = new JsonArray(); decision.evicted().forEach(evicted::add);
        result.add("evicted", evicted);
        result.addProperty("residentCells", decision.residentCells());
        return result;
    }
}
