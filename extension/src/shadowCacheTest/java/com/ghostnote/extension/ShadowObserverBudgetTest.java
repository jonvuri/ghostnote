package com.ghostnote.extension;

/** Check aggregate observer admission before experimental handles are allocated. */
public final class ShadowObserverBudgetTest {
    public static void main(String[] args) {
        RigConfig config = new RigConfig();
        check(config.experimentalStepDataObservers() == 1, "baseline step-data observer is counted");
        config.cacheShadowObservers = 2;
        config.cacheLifecycleResearch = true;
        check(config.experimentalStepDataObservers() == 6, "shadow authority and two reuse observers are counted");
        // 8h1a: allocation has a research ceiling. The selected 512 limit applies to the active set at runtime.
        int ceiling = ShadowProjectCache.RESEARCH_MAX_OBSERVERS + 16;
        config.cacheScaleObservers = ceiling - 8;
        config.cacheScaleWidthSteps = 1;
        check(config.experimentalStepDataObservers() == ceiling, "aggregate allocation equality is admitted");
        config.cacheScaleObservers++;
        refuses(config, "the next observer is rejected");
        config.cacheScaleObservers = Integer.MAX_VALUE;
        refuses(config, "integer overflow cannot admit the configuration");
        config.cacheScaleObservers = -1;
        refuses(config, "negative count cannot hide other observers");
        // Load the runtime classification offline. A count drift fails here, not at controller init.
        check(RuntimeProfile.NORMAL.methodNames().size() == 87 && RuntimeProfile.PROBE.methodNames().size() == 100
            && RuntimeProfile.PROBE.includes("cache.configure") && !RuntimeProfile.NORMAL.includes("cache.configure"),
            "runtime method classification initializes with 8h1a cache.configure");
        System.out.println("Shadow observer budget: 2 test groups passed.");
    }
    private static void refuses(RigConfig config, String message) {
        try { config.experimentalStepDataObservers(); }
        catch (IllegalArgumentException expected) { return; }
        throw new AssertionError(message);
    }
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
}
