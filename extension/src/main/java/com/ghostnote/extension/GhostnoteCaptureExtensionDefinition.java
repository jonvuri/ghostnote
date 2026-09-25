package com.ghostnote.extension;

/** Optional capture runtime. Deploy it in place of the normal runtime. */
public final class GhostnoteCaptureExtensionDefinition extends GhostnoteExtensionDefinition {
    @Override
    public String getName() {
        return "ghostnote capture";
    }

    @Override
    public String getHardwareModel() {
        return "ghostnote capture bridge";
    }
}
