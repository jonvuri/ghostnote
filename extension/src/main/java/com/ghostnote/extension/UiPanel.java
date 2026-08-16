package com.ghostnote.extension;

import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.DocumentState;
import com.bitwig.extension.controller.api.SettableStringValue;
import com.bitwig.extension.controller.api.Setting;

/** The small product surface in Bitwig's controller pane. */
public final class UiPanel {
    private static final String CAT_STATUS = "Status";
    private static final String CAT_RECORD = "Record";

    public static final int STATUS_TEXT_CHARS = 96;
    public static final int OBSERVATION_RECORD_CHARS = 262144;

    public final SettableStringValue statusText;
    public final SettableStringValue statusStore;
    public final SettableStringValue recordSetting;
    public final int recordChars;
    public final String recordUnavailable;

    private String lastPushedStatus = "";
    private boolean statusStoreObserved;
    private boolean statusPushStarted;
    private boolean statusRepairing;

    public UiPanel(ControllerHost host) {
        DocumentState documentState = host.getDocumentState();

        statusText = documentState.getStringSetting(
            "Last change", CAT_STATUS, STATUS_TEXT_CHARS, "");
        statusText.addValueObserver(this::statusChanged);

        // E20d: Bitwig stores this value safely but can lock when it draws the
        // field. Test the undocumented Setting downcast before construction.
        int requestedChars = OBSERVATION_RECORD_CHARS;
        if (asSetting(statusText) == null) {
            statusStore = null;
            recordSetting = null;
            recordChars = 0;
            recordUnavailable = "Setting downcast unavailable. The observation record was not "
                + "created because a visible large field can lock Bitwig (E20d).";
            return;
        }

        // Bitwig can first report the default visible value and then the value
        // from the project. A visible setting alone cannot distinguish that
        // second callback from a user edit. Keep one hidden product-owned mirror.
        // Its callbacks are authoritative because a user cannot edit it.
        SettableStringValue createdStatusStore = documentState.getStringSetting(
            "Last change value", CAT_RECORD, STATUS_TEXT_CHARS, "");
        Setting hideableStatusStore = asSetting(createdStatusStore);
        if (hideableStatusStore == null) {
            throw new IllegalStateException("the Last change value could not be hidden");
        }
        hideableStatusStore.hide();
        statusStore = createdStatusStore;
        createdStatusStore.addValueObserver(this::storedStatusChanged);

        SettableStringValue created = documentState.getStringSetting(
            "Observation record", CAT_RECORD, requestedChars, "");
        Setting hideable = asSetting(created);
        if (hideable == null) {
            recordSetting = null;
            recordChars = 0;
            recordUnavailable = "The observation record could not be hidden. It was not wired "
                + "or written because a visible large field can lock Bitwig (E20d).";
            return;
        }

        // Hide during init. Visibility does not persist across an extension
        // restart, so a later hide would expose the field during construction.
        hideable.hide();
        recordSetting = created;
        recordChars = requestedChars;
        recordUnavailable = null;
    }

    /** Push one product-owned status value. */
    public void pushStatus(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("status value must not be blank");
        }
        if (value.length() > STATUS_TEXT_CHARS) {
            throw new IllegalArgumentException(
                "status value exceeds " + STATUS_TEXT_CHARS + " characters");
        }
        statusPushStarted = true;
        lastPushedStatus = value;
        statusRepairing = true;
        if (statusStore != null) statusStore.set(value);
        statusText.set(value);
    }

    /** Accept project-load callbacks only from the hidden owned value. */
    private void storedStatusChanged(String value) {
        statusStoreObserved = true;
        if (statusPushStarted && !value.equals(lastPushedStatus)) {
            // A delayed project-load callback cannot replace a newer push.
            statusStore.set(lastPushedStatus);
            return;
        }
        lastPushedStatus = value;
        statusRepairing = true;
        statusText.set(value);
    }

    /** Repair a user edit without a bridge request, timer, or server poll. */
    private void statusChanged(String value) {
        // This fallback applies only when the Setting downcast failed before the
        // hidden store could be created. The normal path trusts the store.
        if (!statusStoreObserved && statusStore == null && !statusPushStarted) {
            lastPushedStatus = value;
            return;
        }

        if (value.equals(lastPushedStatus)) {
            statusRepairing = false;
            return;
        }

        // A callback can contain the old persisted value after a new push. Set
        // the product value again in that case. The matching callback ends the
        // repair and prevents recursion.
        if (!statusRepairing) statusRepairing = true;
        statusText.set(lastPushedStatus);
    }

    /** Guard the undocumented Bitwig value-to-Setting downcast. */
    public static Setting asSetting(Object value) {
        return value instanceof Setting setting ? setting : null;
    }
}
