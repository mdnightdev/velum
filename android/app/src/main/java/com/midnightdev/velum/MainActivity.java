package com.midnightdev.velum;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import java.io.File;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        checkRootDetection();
        checkTamperDetection();
    }

    private void checkRootDetection() {
        boolean isRooted = checkForRoot();
        if (isRooted) {
            Log.w(TAG, "Device is rooted - security risk");
        }
    }

    private boolean checkForRoot() {
        String[] rootPaths = {
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/data/data/com.noshufou.android.su",
            "/system/app/SuperSU.apk",
            "/system/etc/init.d/99SuperSUDaemon",
            "/system/bin/.ext/.su",
            "/system/usr/weNeedRoot.sh",
            "/system/etc/recovery-sup",
            "/tmp/su",
            "/cache/su"
        };

        for (String path : rootPaths) {
            if (new File(path).exists()) {
                return true;
            }
        }

        try {
            Process process = Runtime.getRuntime().exec(new String[]{"which", "su"});
            if (process.waitFor() == 0) {
                return true;
            }
        } catch (Exception e) {
            Log.e(TAG, "Root detection error", e);
        }

        return false;
    }

    private void checkTamperDetection() {
        boolean isTampered = checkForTamper();
        if (isTampered) {
            Log.w(TAG, "App may be tampered - security risk");
        }
    }

    private boolean checkForTamper() {
        String debuggable = isDebuggable() ? "debuggable" : "not debuggable";
        Log.i(TAG, "App tamper check: " + debuggable);
        return isDebuggable();
    }

    private boolean isDebuggable() {
        return (getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }
}
