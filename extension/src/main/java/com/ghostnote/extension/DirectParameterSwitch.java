package com.ghostnote.extension;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The DirectParameter name and value callbacks since the device cursor reached its current target (8h4a5, E243).
 *
 * <p>Bitwig calls the ID observer only when the ID list changes. A move to a device with the same ID list, for
 * example a Polysynth after a Polysynth on another track, calls no ID observer. It calls the name and value
 * observers for every ID, also when the values are equal (E243 P4). These callbacks usually arrive before the
 * next {@code directparam.list begin}.
 *
 * <p>Each callback carries the target stamp (track, device name, device index, nesting, route) that the cursor
 * reports at that time. A new stamp discards the callbacks of the earlier stamp, so a value from an earlier
 * device is never kept. The current target settles with the unchanged ID list when each ID has a name and a
 * value under the current stamp.
 */
public final class DirectParameterSwitch {
    private String stamp;
    private final Map<String, String> names = new LinkedHashMap<>();
    private final Map<String, Double> values = new LinkedHashMap<>();

    /** Record one name callback under the target stamp of this moment. */
    public void name(String targetStamp, String id, String name) {
        follow(targetStamp);
        names.put(id, name);
    }

    /** Record one value callback under the target stamp of this moment. */
    public void value(String targetStamp, String id, double value) {
        follow(targetStamp);
        values.put(id, value);
    }

    private void follow(String targetStamp) {
        if (targetStamp.equals(stamp)) return;
        stamp = targetStamp;
        names.clear();
        values.clear();
    }

    /** True when each ID has a name and a value under {@code targetStamp}. An empty list never settles here. */
    public boolean covers(String targetStamp, String[] ids) {
        if (ids.length == 0 || !targetStamp.equals(stamp)) return false;
        for (String id : ids) {
            if (!names.containsKey(id) || !values.containsKey(id)) return false;
        }
        return true;
    }

    /** The name of one ID under the current stamp, or null. */
    public String nameOf(String id) { return names.get(id); }

    /** The value of one ID under the current stamp, or null. */
    public Double valueOf(String id) { return values.get(id); }

    /** The current stamp, for diagnostics. */
    public String stamp() { return stamp; }
}
