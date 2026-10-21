package com.ghostnote.extension;

import java.io.InputStream;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;

/** Exact-build read symbols from local bytecode inspection. See E273. */
public final class GridReadSymbols implements GridGraphRead.Reader {
    public static final String JAR_SHA256 = "382c655d0b9e8db6bd433dc6100ef3a4ee23abf6a6615f79c40f0c2645792c93";
    private final Method descriptor, classId, name, properties, propertyId, enabled, filter, value;
    private final Method childCount, child;
    private final Class<?> relationship;
    private final Object filterInstance;
    private Class<?> nativeDevice;

    public GridReadSymbols(Class<?> hostClass) throws Exception {
        Path jar = Path.of(hostClass.getProtectionDomain().getCodeSource().getLocation().toURI());
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = Files.newInputStream(jar)) {
            byte[] buffer = new byte[65536];
            for (int n; (n = input.read(buffer)) != -1;) digest.update(buffer, 0, n);
        }
        String actual = HexFormat.of().formatHex(digest.digest());
        if (!JAR_SHA256.equals(actual)) throw new IllegalStateException("unsupported-host-jar:" + actual);
        ClassLoader loader = hostClass.getClassLoader();
        Class<?> atom = Class.forName("com.bitwig.ramona.core.HEV", false, loader);
        Class<?> schema = Class.forName("cXV", false, loader);
        Class<?> named = Class.forName("cXZ", false, loader);
        Class<?> property = Class.forName("cYF", false, loader);
        relationship = Class.forName("cYH", false, loader);
        Class<?> serial = Class.forName("com.bitwig.ramona.serial.vWM", false, loader);
        descriptor = atom.getMethod("mW_");
        classId = schema.getMethod("pea");
        name = named.getMethod("lSJ");
        properties = schema.getMethod("ciZ");
        propertyId = Class.forName("cYs", false, loader).getMethod("QiZ");
        enabled = property.getMethod("nM_");
        filter = serial.getMethod("ffA", property, atom);
        filterInstance = serial.getField("cG3").get(null);
        value = property.getMethod("eOi", atom);
        childCount = relationship.getMethod("wi2", atom);
        child = relationship.getMethod("eOi", atom, int.class);
    }

    /** Use a structurally validated candidate table in the scratch doctor only. */
    public GridReadSymbols(GridDoctorSymbols table) throws Exception {
        nativeDevice = table.type("native-device");
        descriptor = table.method("descriptor"); classId = table.method("class-id");
        name = table.method("name"); properties = table.method("properties");
        propertyId = table.method("property-id"); enabled = table.method("enabled-field");
        filter = table.method("serialization-filter"); filterInstance = table.field("filter-instance").get(null);
        value = table.method("scalar-read"); childCount = table.method("child-count");
        child = table.method("child-read"); relationship = table.type("relationship");
    }

    public String name(Object object) throws Exception { return (String) name.invoke(descriptor.invoke(object)); }
    public int classId(Object object) throws Exception { return (int) classId.invoke(descriptor.invoke(object)); }
    public List<?> properties(Object object) throws Exception { return (List<?>) properties.invoke(descriptor.invoke(object)); }
    public int id(Object property) throws Exception { return (int) propertyId.invoke(property); }
    public String propertyName(Object property) throws Exception { return (String) name.invoke(property); }
    public boolean included(Object property, Object object) throws Exception {
        return (boolean) enabled.invoke(property) && (boolean) filter.invoke(filterInstance, property, object);
    }
    /** E274: property 406 is an existing child excluded by the file serializer. */
    public boolean rootBridge(Object property, Object object) throws Exception {
        if ((nativeDevice != null ? object.getClass() != nativeDevice
                : !object.getClass().getName().equals("com.bitwig.flt.document.core.master.device.S2E")) || id(property) != 406) return false;
        if (!propertyName(property).equals("device_contents") || !relationship(property)
                || !(boolean) enabled.invoke(property))
            throw new IllegalStateException("unexpected-device-contents-descriptor");
        return true;
    }
    public boolean relationship(Object property) { return relationship.isInstance(property); }
    public int childCount(Object property, Object object) throws Exception { return (int) childCount.invoke(property, object); }
    public Object child(Object property, Object object, int index) throws Exception { return child.invoke(property, object, index); }
    public Object value(Object property, Object object) throws Exception { return value.invoke(property, object); }

    public static Object target(Object proxy) throws Exception {
        return proxy.getClass().getMethod("getDeepestTarget").invoke(proxy);
    }

    public static Object document(Object proxy) throws Exception {
        Object deepest = proxy.getClass().getMethod("getDeepestProxy").invoke(proxy);
        return deepest.getClass().getMethod("getDocument").invoke(deepest);
    }

    public static void queue(Object proxy, Runnable task) throws Exception {
        Class<?> base = Class.forName("com.bitwig.flt.control_surface.proxy.ControlSurfaceObject", false,
            proxy.getClass().getClassLoader());
        Method exec = base.getDeclaredMethod("exec", Runnable.class);
        exec.setAccessible(true);
        exec.invoke(proxy, task);
    }

    public static void requireDocumentThread(Object proxy) throws Exception {
        if (!(boolean) proxy.getClass().getMethod("isDocumentThread").invoke(proxy))
            throw new IllegalStateException("not-document-thread");
    }
}
