loadAPI(25);
host.defineController("Repro", "Pressure Getter", "1.0", "fb4b5b2a-8c91-4b66-b781-629226ab746c", "jonvuri");
host.defineMidiPorts(0, 0);

function init() {
    var clip = host.createLauncherCursorClip(1, 128);
    host.getPreferences().getSignalSetting("Read note", "Pressure", "Read")
        .addSignalObserver(function () {
            var note = clip.getStep(0, 0, 60);
            host.println("Pressure Getter 1.0: state=" + note.state()
                + ", velocity=" + note.velocity() + ", pressure=" + note.pressure());
        });
}

function flush() {}
function exit() {}
