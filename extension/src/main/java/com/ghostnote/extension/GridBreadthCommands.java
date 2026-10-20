package com.ghostnote.extension;

import java.lang.reflect.Method;

/**
 * Command metadata for the three 9b.3 cases. Resolution does not run a command.
 * Admission and independent descriptor readback belong to the caller.
 */
public final class GridBreadthCommands {
    public static final String GATES_TYPE = "8d644ad7-8d77-4f05-a36e-04a57f719635";
    public static final String SOURCE_TYPE = "098ad9c6-b4c9-4ec1-887f-eaf588611056";
    public static final String TARGET_TYPE = "2ddd3d4f-04b9-4ad5-a6f7-08e01df14c0f";
    public final Class<?> booleanAtom, sourceAtom, targetAtom, transfer;
    public final Method setBoolean, removeMapping, restoreMapping, targetDomain, domainExtent;

    public GridBreadthCommands(ClassLoader loader) throws ReflectiveOperationException {
        booleanAtom = type(loader, "QY");
        sourceAtom = type(loader, "com.bitwig.flt.document.core.master.device.NDn");
        targetAtom = type(loader, "Hjt");
        transfer = type(loader, "jas");
        // Xuo.eOi dispatches to QY.NaF. The latter owns the boolean edit.
        setBoolean = type(loader, "Xuo").getMethod("eOi", boolean.class);
        Class<?> sourceBase = type(loader, "com.bitwig.flt.document.core.master.device.Net");
        // Net.cG3 dispatches to NDn.eOi, which removes one matching mapping.
        removeMapping = sourceBase.getMethod("cG3", targetAtom);
        // The NDn override calls an inline edit wrapper. It clamps native units.
        restoreMapping = sourceBase.getMethod("eOi", targetAtom, double.class,
            boolean.class, transfer, sourceAtom);
        targetDomain = targetAtom.getMethod("aGJ");
        Class<?> domain = type(loader, "MTu");
        domainExtent = domain.getMethod("NCM");
        if (setBoolean.getReturnType() != void.class || removeMapping.getReturnType() != void.class
                || restoreMapping.getReturnType() != void.class
                || targetDomain.getReturnType() != domain
                || !domainExtent.getDeclaringClass().isAssignableFrom(domain)
                || domainExtent.getReturnType() != double.class)
            throw new IllegalStateException("breadth-command-signature");
    }

    private static Class<?> type(ClassLoader loader, String name) throws ClassNotFoundException {
        return Class.forName(name, false, loader);
    }
}
