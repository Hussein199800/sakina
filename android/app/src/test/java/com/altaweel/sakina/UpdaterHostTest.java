package com.altaweel.sakina;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.net.URL;
import org.junit.Test;

/** المحدّث يتبع التحويلات إلى خوادم GitHub عبر https فقط */
public class UpdaterHostTest {

    @Test
    public void allowsGithubHostsOverHttps() throws Exception {
        assertTrue(SakinaUpdaterPlugin.allowedHost(new URL("https://github.com/Hussein199800/sakina/releases/download/v1/sakina.apk")));
        assertTrue(SakinaUpdaterPlugin.allowedHost(new URL("https://objects.githubusercontent.com/x")));
        assertTrue(SakinaUpdaterPlugin.allowedHost(new URL("https://release-assets.githubusercontent.com/x")));
    }

    @Test
    public void rejectsOtherHostsAndPlainHttp() throws Exception {
        assertFalse(SakinaUpdaterPlugin.allowedHost(new URL("http://github.com/x")));
        assertFalse(SakinaUpdaterPlugin.allowedHost(new URL("https://evil.example.com/x")));
        assertFalse(SakinaUpdaterPlugin.allowedHost(new URL("https://githubusercontent.com.evil.com/x")));
        assertFalse(SakinaUpdaterPlugin.allowedHost(new URL("https://notgithub.com/x")));
        assertFalse(SakinaUpdaterPlugin.allowedHost(null));
    }
}
