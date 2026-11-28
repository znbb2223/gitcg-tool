package com.dsh.gitcg;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.net.Uri;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    /** 内置资源 origin：沿用原本地服务器地址，保住 localStorage */
    private static final String APP_ORIGIN = "http://127.0.0.1:8765";

    private static String mimeOf(String path) {
        if (path.endsWith(".html")) {
            return "text/html";
        }
        if (path.endsWith(".js") || path.endsWith(".mjs")) {
            return "application/javascript";
        }
        if (path.endsWith(".css")) {
            return "text/css";
        }
        if (path.endsWith(".json")) {
            return "application/json";
        }
        if (path.endsWith(".webp")) {
            return "image/webp";
        }
        if (path.endsWith(".png")) {
            return "image/png";
        }
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        if (path.endsWith(".svg")) {
            return "image/svg+xml";
        }
        if (path.endsWith(".woff2")) {
            return "font/woff2";
        }
        if (path.endsWith(".woff")) {
            return "font/woff";
        }
        if (path.endsWith(".ttf")) {
            return "font/ttf";
        }
        if (path.endsWith(".mp3")) {
            return "audio/mpeg";
        }
        return "application/octet-stream";
    }

    private static final int REQ_PICK_FILE = 1001;
    private WebView webView;
    private android.widget.FrameLayout rootView;
    private ValueCallback<Uri[]> filePathCallback;
    /** 主体方向：工具页面的横竖屏偏好（模拟器永远横屏），由网页桥写回并在冷启动时恢复 */
    private String mainOrientation = "portrait";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 冷启动恢复主体方向偏好（默认竖屏）
        {
            String saved = getSharedPreferences("gitcg-prefs", MODE_PRIVATE)
                    .getString("mainOrientation", "portrait");
            mainOrientation = "landscape".equals(saved) ? "landscape" : "portrait";
        }

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            // 编译用的 android.jar 是 23，刘海模式字段用反射设置（shortEdges = 1）
            try {
                WindowManager.LayoutParams attributes = getWindow().getAttributes();
                java.lang.reflect.Field field = WindowManager.LayoutParams.class
                        .getField("layoutInDisplayCutoutMode");
                field.setInt(attributes, 1);
                getWindow().setAttributes(attributes);
            } catch (Exception ignored) {
            }
        }
        applyImmersive();

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        // 去掉浏览器痕迹：不要缩放手势与缩放按钮、不要滚动条与过度滚动光晕
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setTextZoom(100);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        // 模拟器点「开始对局」时调用实现系统级横屏；工具页用它切换主体方向并持久化
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void setOrientation(String mode) {
                runOnUiThread(() -> {
                    String url = webView.getUrl() == null ? "" : webView.getUrl();
                    // 模拟器对局的横屏调用不改动主体方向偏好
                    if (!url.contains("/app.html")) {
                        mainOrientation = "landscape".equals(mode) ? "landscape" : "portrait";
                        getSharedPreferences("gitcg-prefs", MODE_PRIVATE)
                                .edit()
                                .putString("mainOrientation", mainOrientation)
                                .apply();
                    }
                    applyOrientation(mode);
                });
            }

            /** WebView 不支持 blob: 下载，导出经验库改走原生写文件 */
            @JavascriptInterface
            public void saveTextFile(String name, String text) {
                runOnUiThread(() -> saveToDownloads(name, text, "其他"));
            }

            /** 带分类目录的导出：下载/七圣召唤工具/<分类>/<文件名> */
            @JavascriptInterface
            public void saveTextFileIn(String category, String name, String text) {
                runOnUiThread(() -> saveToDownloads(name, text, category));
            }

            /** 分享图：base64 PNG 写入下载目录 */
            @JavascriptInterface
            public void saveImageFile(String name, String base64) {
                runOnUiThread(() -> saveImageToDownloads(name, base64, "其他"));
            }

            /** 带分类目录的图片导出：下载/七圣召唤工具/<分类>/<文件名> */
            @JavascriptInterface
            public void saveImageFileIn(String category, String name, String base64) {
                runOnUiThread(() -> saveImageToDownloads(name, base64, category));
            }

            /** 对局日志写应用缓存目录：系统「清除缓存」会一起清掉 */
            @JavascriptInterface
            public boolean writeCacheFile(String name, String text) {
                try {
                    File dir = cacheLogsDir();
                    if (dir == null) {
                        return false;
                    }
                    File file = new File(dir, safeName(name));
                    try (FileOutputStream out = new FileOutputStream(file)) {
                        out.write(text.getBytes(StandardCharsets.UTF_8));
                    }
                    trimCacheFiles(dir);
                    return true;
                } catch (Exception e) {
                    return false;
                }
            }

            /** 缓存日志列表：每行 name \\t size \\t mtime */
            @JavascriptInterface
            public String listCacheFiles() {
                try {
                    File dir = cacheLogsDir();
                    StringBuilder sb = new StringBuilder();
                    File[] files = dir == null ? null : dir.listFiles();
                    if (files != null) {
                        for (File file : files) {
                            if (!file.isFile()) {
                                continue;
                            }
                            sb.append(file.getName()).append('\t')
                                    .append(file.length()).append('\t')
                                    .append(file.lastModified()).append('\n');
                        }
                    }
                    return sb.toString();
                } catch (Exception e) {
                    return "";
                }
            }

            @JavascriptInterface
            public String readCacheFile(String name) {
                try {
                    File dir = cacheLogsDir();
                    File file = new File(dir, safeName(name));
                    return file.isFile() ? readText(file) : null;
                } catch (Exception e) {
                    return null;
                }
            }

            @JavascriptInterface
            public boolean deleteCacheFile(String name) {
                try {
                    File dir = cacheLogsDir();
                    return new File(dir, safeName(name)).delete();
                } catch (Exception e) {
                    return false;
                }
            }

            @JavascriptInterface
            public int clearCacheFiles() {
                int count = 0;
                try {
                    File dir = cacheLogsDir();
                    File[] files = dir == null ? null : dir.listFiles();
                    if (files != null) {
                        for (File file : files) {
                            if (file.isFile() && file.delete()) {
                                count += 1;
                            }
                        }
                    }
                } catch (Exception ignored) {
                }
                return count;
            }

            /** 把缓存日志复制到下载目录 */
            @JavascriptInterface
            public boolean exportCacheFile(String name) {
                try {
                    File dir = cacheLogsDir();
                    File file = new File(dir, safeName(name));
                    if (!file.isFile()) {
                        return false;
                    }
                    final String text = readText(file);
                    runOnUiThread(() -> saveToDownloads(file.getName(), text, "对局日志"));
                    return true;
                } catch (Exception e) {
                    return false;
                }
            }
        }, "AndroidHost");

        // 支持 <input type="file">：导入经验库
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(intent, "选择经验库文件"), REQ_PICK_FILE);
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
            }
        });

        // 资源拦截：全部页面/数据/图片从内置 assets 读出，不发任何真实网络请求。
        // origin 沿用 http://127.0.0.1:8765 是为了保住用户的 localStorage（按 origin 存）。
        // 唯一一个 WebViewClient：资源拦截 + 页面完成回调（两个客户端后者会覆盖前者）
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost() == null ? "" : uri.getHost();
                if (!("127.0.0.1".equals(host) || "localhost".equals(host))) {
                    // 非本机地址一律不放行（无 INTERNET 权限时也根本出不去）
                    return null;
                }
                String path = uri.getPath();
                if (path == null || path.isEmpty() || path.equals("/")) {
                    path = "/index.html";
                }
                String assetPath = "web" + path;
                try {
                    InputStream in = getAssets().open(assetPath);
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Cache-Control", "no-store");
                    return new WebResourceResponse(mimeOf(path), "UTF-8", 200, "OK", headers, in);
                } catch (IOException e) {
                    // 路径兜底：单页应用的任何路径都回首页
                    try {
                        InputStream in = getAssets().open("web/index.html");
                        Map<String, String> headers = new HashMap<>();
                        headers.put("Cache-Control", "no-store");
                        return new WebResourceResponse("text/html", "UTF-8", 200, "OK", headers, in);
                    } catch (IOException e2) {
                        return null;
                    }
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                applyOrientation(url.contains("/app.html") ? "landscape" : mainOrientation);
            }
        });

        // 升级后别再用旧缓存（旧 HTML 引用的 JS 文件在新包里不存在会直接白屏）
        webView.clearCache(true);

        // 壳层负责安全区：竖屏让开状态栏高度，横屏不留顶部区域；背景纯黑，和网页深色背景无缝衔接
        // 状态栏/导航栏露出的底色：取网页深色背景的中间调，避免出现明显分界线
        int shellColor = Color.parseColor("#17140f");
        rootView = new android.widget.FrameLayout(this);
        rootView.setBackgroundColor(shellColor);
        getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(shellColor));
        webView.setBackgroundColor(shellColor);
        rootView.addView(webView, new android.widget.FrameLayout.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                android.view.ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(rootView);
        updateSafeArea();

        try {
            webView.loadUrl(APP_ORIGIN + "/hub.html");
        } catch (Exception e) {
            webView.loadData("<h2>内置资源启动失败</h2><pre>" + e + "</pre>", "text/html", "utf-8");
        }
    }

    /** 统一处理横竖屏请求 */
    private void applyOrientation(String mode) {
        setRequestedOrientation(
                "landscape".equals(mode)
                        ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                        : ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT);
        webView.post(() -> {
            applyImmersive();
            updateSafeArea();
        });
    }

    private File cacheLogsDir() {
        File dir = new File(getCacheDir(), "logs");
        if (!dir.exists() && !dir.mkdirs()) {
            return null;
        }
        return dir;
    }

    private static String safeName(String name) {
        String base = new File(name == null ? "" : name).getName();
        return base.isEmpty() ? "log.json" : base;
    }

    private static String readText(File file) throws Exception {
        try (java.io.FileInputStream in = new java.io.FileInputStream(file);
             java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            return out.toString("UTF-8");
        }
    }

    /** 缓存日志最多留 20 份，避免日志堆太多 */
    private static void trimCacheFiles(File dir) {
        File[] files = dir.listFiles();
        if (files == null || files.length <= 20) {
            return;
        }
        java.util.Arrays.sort(files, (a, b) -> Long.compare(a.lastModified(), b.lastModified()));
        for (int i = 0; i < files.length - 20; i++) {
            if (files[i].isFile()) {
                files[i].delete();
            }
        }
    }

    /** 按扩展名给图片挑 MIME（牌组图现在是 webp） */
    private static String imageMimeOf(String name) {
        String lower = name == null ? "" : name.toLowerCase();
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        return "image/png";
    }

    private void saveImageToDownloads(String name, String base64, String category) {
        try {
            byte[] data = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
            String folder = exportFolder(category);
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues values = new ContentValues();
                values.put("_display_name", name);
                values.put("mime_type", imageMimeOf(name));
                values.put("relative_path", folder);
                Uri uri = getContentResolver().insert(Uri.parse("content://media/external/downloads"), values);
                if (uri == null) throw new IllegalStateException("无法创建文件");
                try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                    if (out == null) throw new IllegalStateException("无法写入文件");
                    out.write(data);
                }
                Toast.makeText(this, "已保存到 " + folder + "/" + name, Toast.LENGTH_LONG).show();
            } else {
                File file = legacyExportFile(category, name);
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(data);
                }
                Toast.makeText(this, "已保存到 " + file.getAbsolutePath(), Toast.LENGTH_LONG).show();
            }
        } catch (Exception e) {
            Toast.makeText(this, "保存失败：" + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void saveToDownloads(String name, String text, String category) {
        try {
            byte[] data = text.getBytes(StandardCharsets.UTF_8);
            String folder = exportFolder(category);
            if (Build.VERSION.SDK_INT >= 29) {
                // 用字符串字段名而不是 MediaStore.* 常量：本机只有 android-23 的 android.jar，
                // 那些常量（API 29）编译期不存在
                ContentValues values = new ContentValues();
                values.put("_display_name", name);
                values.put("mime_type", "application/json");
                values.put("relative_path", folder);
                Uri uri = getContentResolver().insert(
                        Uri.parse("content://media/external/downloads"), values);
                if (uri == null) throw new IllegalStateException("无法创建文件");
                try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                    if (out == null) throw new IllegalStateException("无法写入文件");
                    out.write(data);
                }
                Toast.makeText(this, "已导出到 " + folder + "/" + name, Toast.LENGTH_LONG).show();
            } else {
                File file = legacyExportFile(category, name);
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(data);
                }
                Toast.makeText(this, "已导出到 " + file.getAbsolutePath(), Toast.LENGTH_LONG).show();
            }
        } catch (Exception e) {
            Toast.makeText(this, "导出失败：" + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    /** 导出根目录：下载/七圣召唤工具/<分类> */
    private static final String EXPORT_ROOT = "七圣召唤工具";

    private static String safeCategory(String category) {
        String value = category == null ? "" : category.replaceAll("[\\\\/:*?\"<>|]", "").trim();
        return value.isEmpty() ? "其他" : value;
    }

    private static String exportFolder(String category) {
        return Environment.DIRECTORY_DOWNLOADS + "/" + EXPORT_ROOT + "/" + safeCategory(category);
    }

    /** Android 9 及以下：直接写公共下载目录下的分类文件夹（失败则退回应用私有目录） */
    private File legacyExportFile(String category, String name) throws Exception {
        File root = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                EXPORT_ROOT + "/" + safeCategory(category));
        if (!root.exists() && !root.mkdirs()) {
            File fallback = new File(getExternalFilesDir(null), EXPORT_ROOT + "/" + safeCategory(category));
            if (!fallback.exists()) fallback.mkdirs();
            root = fallback;
        }
        return new File(root, name);
    }

    private void applyImmersive() {
        boolean landscape = getResources().getConfiguration().orientation
                == android.content.res.Configuration.ORIENTATION_LANDSCAPE;
        int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN;
        if (landscape) {
            // 横屏（模拟器）：整个状态栏/导航栏都隐藏，不占任何顶部区域
            flags |= View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
        }
        getWindow().getDecorView().setSystemUiVisibility(flags);
        if (Build.VERSION.SDK_INT >= 21) {
            // 竖屏：状态栏透明画在内容之上，看到的是壳层底色，和网页背景衔接
            getWindow().setStatusBarColor(landscape ? Color.BLACK : Color.TRANSPARENT);
            getWindow().setNavigationBarColor(landscape ? Color.BLACK : Color.TRANSPARENT);
        }
    }

    /** 小窗/分屏判断：用反射，兼容编译用的 android-23 jar */
    private boolean inMultiWindowMode() {
        try {
            return (Boolean) android.app.Activity.class.getMethod("isInMultiWindowMode").invoke(this);
        } catch (Exception ignored) {
            return false;
        }
    }

    /** 竖屏给状态栏让位，横屏不留；导航栏高度始终预留 */
    private void updateSafeArea() {
        if (rootView == null) {
            return;
        }
        boolean landscape = getResources().getConfiguration().orientation
                == android.content.res.Configuration.ORIENTATION_LANDSCAPE;
        // 小窗/分屏：没有系统状态栏区域，不再预留顶部空间（否则会露出壳层底色分层）
        boolean multiWindow = Build.VERSION.SDK_INT >= 24 && inMultiWindowMode();
        int top = landscape || multiWindow ? 0 : dimenPx("status_bar_height");
        // 底部不再预留导航栏高度：网页直接铺到屏幕底部（和顶部状态栏区域的处理对称）
        int bottom = 0;
        rootView.setPadding(0, top, 0, bottom);
    }

    @Override
    public void onConfigurationChanged(android.content.res.Configuration config) {
        super.onConfigurationChanged(config);
        applyImmersive();
        updateSafeArea();
    }


    /** 状态栏/导航栏/挖孔高度，用来给 WebView 让出安全区 */
    private int dimenPx(String name) {
        int id = getResources().getIdentifier(name, "dimen", "android");
        return id > 0 ? getResources().getDimensionPixelSize(id) : 0;
    }

    private int cutoutPx() {
        if (Build.VERSION.SDK_INT >= 28) {
            try {
                android.view.WindowInsets insets = getWindow().getDecorView().getRootWindowInsets();
                if (insets != null) {
                    Object displayCutout = insets.getClass().getMethod("getDisplayCutout").invoke(insets);
                    if (displayCutout != null) {
                        java.lang.reflect.Method safeTop = displayCutout.getClass().getMethod("getSafeInsetTop");
                        return (Integer) safeTop.invoke(displayCutout);
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return 0;
    }


    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersive();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_PICK_FILE) {
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                results = new Uri[]{data.getData()};
            }
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript(
                "(function(){try{return window.__dshBack?window.__dshBack():'back';}catch(e){return 'back';}})()",
                value -> {
                    // 页面自己处理了（关弹层/详情/子页）就不动；否则按浏览历史回上一页，没有历史再回首页
                    if (value != null && value.contains("handled")) {
                        return;
                    }
                    if (value != null && value.contains("exit")) {
                        finish();
                        return;
                    }
                    if (webView.canGoBack()) {
                        webView.goBack();
                    } else {
                        webView.loadUrl(APP_ORIGIN + "/hub.html");
                    }
                });
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
