package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.Application;
import com.bitwig.extension.controller.api.Clip;
import com.bitwig.extension.controller.api.ClipLauncherSlot;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.PinnableCursorClip;
import com.bitwig.extension.controller.api.Project;
import com.bitwig.extension.controller.api.Track;
import com.bitwig.extension.controller.api.TrackBank;
import com.bitwig.extension.controller.api.Transport;
import com.ghostnote.extension.Rig;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

/** Read-only runtime proxy inventory for E130. */
public final class ApiInventoryHandlers extends HandlerGroup {
    private static final Pattern CONTENT_PATTERN = Pattern.compile(
        "(?i)(clip|note|midi|event|content|serial|transfer|clipboard|drag|drop|"
            + "export|import|save|bounce|stream|data)");

    public ApiInventoryHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("api.runtimeMethods", this::runtimeMethods);
    }

    private JsonElement runtimeMethods(JsonObject params) {
        JsonArray targets = new JsonArray();
        addTarget(targets, "host", host, ControllerHost.class);
        addTarget(targets, "application", rig.application, Application.class);
        addTarget(targets, "project", rig.project, Project.class);
        addTarget(targets, "trackBank", rig.trackBank, TrackBank.class);
        addTarget(targets, "track0", rig.trackBank.getItemAt(0), Track.class);
        addTarget(
            targets,
            "slot0",
            rig.trackBank.getItemAt(0).clipLauncherSlotBank().getItemAt(0),
            ClipLauncherSlot.class);
        addTarget(targets, "fineClip", rig.fineClip, PinnableCursorClip.class);
        addTarget(targets, "followerClip", rig.followerClip, Clip.class);
        addTarget(targets, "arrangerClip", rig.arrangerClip, Clip.class);
        addTarget(targets, "transport", rig.transport, Transport.class);

        JsonObject result = new JsonObject();
        result.addProperty("readOnly", true);
        result.add("targets", targets);
        return result;
    }

    private static void addTarget(JsonArray targets, String name, Object target, Class<?> apiType) {
        JsonObject result = new JsonObject();
        result.addProperty("name", name);
        result.addProperty("apiType", apiType.getName());
        result.addProperty("runtimeType", target.getClass().getName());

        Set<String> apiMethods = new HashSet<>();
        for (Method method : apiType.getMethods()) {
            apiMethods.add(methodKey(method));
        }

        Method[] runtimeMethods = target.getClass().getMethods();
        Arrays.sort(runtimeMethods, Comparator.comparing(ApiInventoryHandlers::methodSignature));
        JsonArray extras = new JsonArray();
        JsonArray contentExtras = new JsonArray();
        Set<Class<?>> candidateReturnTypes = new HashSet<>();
        int publicCount = 0;
        for (Method method : runtimeMethods) {
            if (!Modifier.isPublic(method.getModifiers())
                    || method.getDeclaringClass().equals(Object.class)) {
                continue;
            }
            publicCount++;
            if (apiMethods.contains(methodKey(method))) {
                continue;
            }
            String signature = methodSignature(method);
            extras.add(signature);
            if (CONTENT_PATTERN.matcher(contentSignature(method)).find()) {
                contentExtras.add(signature);
                Class<?> returnType = method.getReturnType();
                if (!returnType.isPrimitive() && !returnType.equals(String.class)) {
                    candidateReturnTypes.add(returnType);
                }
            }
        }
        result.addProperty("apiPublicMethodCount", apiMethods.size());
        result.addProperty("runtimePublicMethodCount", publicCount);
        result.addProperty("runtimeExtraCount", extras.size());
        result.add("runtimeExtras", extras);
        result.add("contentCandidateExtras", contentExtras);
        result.add("candidateReturnTypes", inspectReturnTypes(candidateReturnTypes, apiMethods));
        targets.add(result);
    }

    private static JsonArray inspectReturnTypes(
            Set<Class<?>> returnTypes, Set<String> apiMethods) {
        JsonArray results = new JsonArray();
        returnTypes.stream().sorted(Comparator.comparing(Class::getName)).forEach(returnType -> {
            JsonObject result = new JsonObject();
            result.addProperty("type", returnType.getName());
            JsonArray contentExtras = new JsonArray();
            Method[] methods = returnType.getMethods();
            Arrays.sort(methods, Comparator.comparing(ApiInventoryHandlers::methodSignature));
            for (Method method : methods) {
                if (!apiMethods.contains(methodKey(method))
                        && CONTENT_PATTERN.matcher(contentSignature(method)).find()) {
                    contentExtras.add(methodSignature(method));
                }
            }
            result.add("contentExtras", contentExtras);
            results.add(result);
        });
        return results;
    }

    private static String methodKey(Method method) {
        return method.getName() + "(" + String.join(",", parameterNames(method)) + ")";
    }

    private static String methodSignature(Method method) {
        return methodKey(method) + ":" + method.getReturnType().getTypeName()
            + "@" + method.getDeclaringClass().getName();
    }

    private static String contentSignature(Method method) {
        return methodKey(method) + ":" + method.getReturnType().getTypeName();
    }

    private static String[] parameterNames(Method method) {
        return Arrays.stream(method.getParameterTypes()).map(Class::getTypeName).toArray(String[]::new);
    }
}
