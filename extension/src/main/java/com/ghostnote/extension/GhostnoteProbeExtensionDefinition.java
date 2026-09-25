package com.ghostnote.extension;

/** Active Phase 8 and D13 regression runtime. */
public final class GhostnoteProbeExtensionDefinition extends GhostnoteExtensionDefinition {
    @Override
    public String getName() {
        return "ghostnote probe";
    }

    @Override
    public String getHardwareModel() {
        return "ghostnote probe bridge";
    }
}
