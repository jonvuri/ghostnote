package com.ghostnote.extension;

import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;

/** Resolve command metadata without host class initialization or native calls. */
public final class GridBreadthCommandsTest {
    public static void main(String[] args) throws Exception {
        if (args.length != 1) throw new IllegalArgumentException("pinned host jar required");
        Path jar = Path.of(args[0]);
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (var input = Files.newInputStream(jar)) {
            byte[] buffer = new byte[65536];
            for (int count; (count = input.read(buffer)) != -1;) digest.update(buffer, 0, count);
        }
        if (!GridReadSymbols.JAR_SHA256.equals(HexFormat.of().formatHex(digest.digest())))
            throw new IllegalStateException("unsupported host jar");
        try (var loader = new URLClassLoader(new java.net.URL[]{
                jar.toUri().toURL(), jar.resolveSibling("libs.jar").toUri().toURL()},
                ClassLoader.getPlatformClassLoader())) {
            GridBreadthCommands symbols = new GridBreadthCommands(loader);
            var edit = new GridAttachmentSymbols.Symbols(loader);
            var engine = new GridEngineSymbols.Symbols(loader);
            Class<?> editType = edit.document.getReturnType();
            if (editType.isAssignableFrom(engine.document) || engine.document.isAssignableFrom(editType)
                    || !edit.document.getParameterTypes()[0].isAssignableFrom(engine.document)
                    || !edit.journalMap.getDeclaringClass().isAssignableFrom(editType)
                    || !engine.connection.getDeclaringClass().isAssignableFrom(engine.document)
                    || !engine.state.getDeclaringClass().isAssignableFrom(engine.document))
                throw new AssertionError("project and edit-document receiver roles changed");
            System.out.println("Project Svr and edit document cZl are distinct; lookup and receiver roles pass.");
            if (!symbols.setBoolean.getDeclaringClass().isAssignableFrom(symbols.booleanAtom)
                    || !symbols.removeMapping.getDeclaringClass().isAssignableFrom(symbols.sourceAtom)
                    || !symbols.restoreMapping.getDeclaringClass().isAssignableFrom(symbols.sourceAtom)
                    || !symbols.transfer.isEnum())
                throw new AssertionError("command inheritance or transfer type changed");
            Class<?> module = Class.forName(
                "com.bitwig.flt.document.core.master.device.DbL", false, loader);
            var factory = module.getMethod("pvN", java.util.UUID.class);
            if (!java.lang.reflect.Modifier.isStatic(factory.getModifiers())
                    || factory.getReturnType() != module)
                throw new AssertionError("factory shape changed");
            for (var method : new java.lang.reflect.Method[]{symbols.setBoolean, symbols.removeMapping,
                    symbols.restoreMapping, symbols.targetDomain, symbols.domainExtent, factory})
                System.out.println(method.toGenericString());
            System.out.println("Pinned jar, boolean command, mapping commands, domain, and factory metadata pass.");
            System.out.println("No host class initialization or native command ran.");
        }
    }
}
