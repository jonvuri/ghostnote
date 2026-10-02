package com.ghostnote.extension;

import java.util.UUID;

/** A distinct catalog entry for the Phase 8g live controls. */
public final class GhostnoteShadowCacheExtensionDefinition extends GhostnoteExtensionDefinition {
    private static final UUID SHADOW_DRIVER_ID = UUID.fromString("bfa28180-fdac-4c43-9b0c-e4d33065012c");

    @Override public UUID getId() { return SHADOW_DRIVER_ID; }
    @Override public String getName() { return "ghostnote 8g controls"; }
    @Override public String getHardwareModel() { return "ghostnote 8g controls"; }
    @Override public String getVersion() { return "0.0.1-8g-controls-1"; }
}
