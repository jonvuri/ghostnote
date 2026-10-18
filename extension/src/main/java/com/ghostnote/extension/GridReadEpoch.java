package com.ghostnote.extension;

import java.lang.ref.WeakReference;
import java.util.UUID;

/** One weak target binding. No document graph survives through a strong handle. */
public final class GridReadEpoch {
    public final String token = UUID.randomUUID().toString();
    private final WeakReference<Object> document, track, device;

    public GridReadEpoch(Object document, Object track, Object device) {
        if (document == null || track == null || device == null) throw new IllegalArgumentException("absent-target");
        this.document = new WeakReference<>(document);
        this.track = new WeakReference<>(track);
        this.device = new WeakReference<>(device);
    }

    public void require(String token, Object document, Object track, Object device) {
        if (!this.token.equals(token) || document == null || track == null || device == null
                || this.document.get() != document || this.track.get() != track || this.device.get() != device)
            throw new IllegalStateException("stale-grid-epoch-or-target");
    }
}
