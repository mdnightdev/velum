package com.midnightdev.velum;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final int PERMISSION_REQUEST_CODE = 9001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Prevent screen capture, screen recording, and system recents switcher previews
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
        checkRootDetection();
        checkTamperDetection();
        checkAndRequestPermissions();
    }

    private void checkAndRequestPermissions() {
        List<String> permissionsNeeded = new ArrayList<>();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.POST_NOTIFICATIONS);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.READ_MEDIA_IMAGES);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_VIDEO) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.READ_MEDIA_VIDEO);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.READ_MEDIA_AUDIO);
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            }
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.CAMERA);
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.RECORD_AUDIO);
        }

        if (!permissionsNeeded.isEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                permissionsNeeded.toArray(new String[0]),
                PERMISSION_REQUEST_CODE
            );
        }
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
