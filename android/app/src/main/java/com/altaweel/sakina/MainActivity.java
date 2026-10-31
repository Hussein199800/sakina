package com.altaweel.sakina;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SakinaOverlayPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
