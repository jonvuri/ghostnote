package com.ghostnote.extension;

/** Check aggregate observer admission before experimental handles are allocated. */
public final class ShadowObserverBudgetTest {
    public static void main(String[] args) {
        RigConfig config = new RigConfig();
        check(config.experimentalStepDataObservers() == 1, "baseline step-data observer is counted");
        config.cacheShadowObservers = 2;
        config.cacheLifecycleResearch = true;
        check(config.experimentalStepDataObservers() == 6, "shadow authority and two reuse observers are counted");
        config.cacheScaleObservers = 504;
        config.cacheScaleWidthSteps = 1;
        check(config.experimentalStepDataObservers() == 512, "aggregate equality is admitted");
        config.cacheScaleObservers++;
        refuses(config, "the next observer is rejected");
        config.cacheScaleObservers = Integer.MAX_VALUE;
        refuses(config, "integer overflow cannot admit the configuration");
        config.cacheScaleObservers = -1;
        refuses(config, "negative count cannot hide other observers");
        System.out.println("Shadow observer budget: 1 test group passed.");
    }
    private static void refuses(RigConfig config, String message) {
        try { config.experimentalStepDataObservers(); }
        catch (IllegalArgumentException expected) { return; }
        throw new AssertionError(message);
    }
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
}
