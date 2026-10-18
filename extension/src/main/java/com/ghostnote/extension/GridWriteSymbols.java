package com.ghostnote.extension;

import java.lang.reflect.Method;

/** E276: the host's raw parameter path, after the reader checks the jar hash. */
public final class GridWriteSymbols {
    private GridWriteSymbols() {}

    public static Method fixtureValueSetter(Object atom) throws Exception {
        if (!atom.getClass().getName().equals("tqm"))
            throw new IllegalStateException("unexpected-fixture-value-class");
        Class<?> base = Class.forName("ccA", false, atom.getClass().getClassLoader());
        if (!base.isInstance(atom)) throw new IllegalStateException("unexpected-fixture-value-base");
        // ParameterValueTarget.setCurrentValue calls HHL.kyi(double). On tqm,
        // ccA.kyi calls bcf.eOi: begin edit, clamp native value, set, end edit.
        return base.getMethod("kyi", double.class);
    }

    public static Method fixtureCableSetter(Object destination, Object before, Object after) throws Exception {
        String prefix = "com.bitwig.flt.document.core.master.device.";
        if (!destination.getClass().getName().equals(prefix + "mvZ") || before == after)
            throw new IllegalStateException("unexpected-fixture-port-class");
        ClassLoader loader = destination.getClass().getClassLoader();
        Class<?> base = Class.forName(prefix + "UL", false, loader);
        Class<?> sourceType = Class.forName("a", false, loader);
        for (Object source : new Object[]{before, after})
            if (source != null && (!source.getClass().getName().equals(prefix + "WAr") || !sourceType.isInstance(source)))
                throw new IllegalStateException("unexpected-fixture-source-class");
        if (!base.isInstance(destination) || base.getMethod("D1G").invoke(destination) != before)
            throw new IllegalStateException("fixture-source-identity-changed");
        // UL.ffA(a) dispatches to xts.eOi(a): begin edit, relationship setter,
        // change notification, end edit. Do not call the lower yWH setter.
        return base.getMethod("ffA", sourceType);
    }

    public static Method fixtureModuleDelete(Object grid, Object module) throws Exception {
        String prefix = "com.bitwig.flt.document.core.master.device.";
        if (!grid.getClass().getName().equals(prefix + "gOr")
                || !module.getClass().getName().equals(prefix + "DbL"))
            throw new IllegalStateException("unexpected-fixture-module-class");
        Class<?> base = Class.forName(prefix + "had", false, module.getClass().getClassLoader());
        if (!base.isInstance(module) || base.getMethod("Fuu").invoke(module) != grid)
            throw new IllegalStateException("fixture-module-parent-changed");
        // had.qON calls cbl.ffA(List): begin delete edit, clean references,
        // remove the owned module, then end the edit. DbL.bm_ is resize completion.
        return base.getMethod("qON");
    }
}
