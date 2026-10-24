package com.headshotairbattle.trainingtest;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.webkit.*;
import android.net.Uri;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;

public class TrainingActivity extends Activity {
    public WebView web;
    private WebResourceResponse denied() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", null, new ByteArrayInputStream(new byte[0]));
    }
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(12,22,32));
        web.setFitsSystemWindows(true);
        web.setOnApplyWindowInsetsListener((v,insets)->{
            v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false); s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        WebView.setWebContentsDebuggingEnabled(false);
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest req) {
                WebResourceResponse r=loader.shouldInterceptRequest(req.getUrl());
                return r!=null?r:denied();
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest req) {
                Uri u=req.getUrl();
                return !"https".equals(u.getScheme()) || !"appassets.androidplatform.net".equals(u.getHost());
            }
            @Override public boolean onRenderProcessGone(WebView v,RenderProcessGoneDetail d) {
                v.destroy(); recreate(); return true;
            }
        });
        ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest req) {
                WebResourceResponse r=loader.shouldInterceptRequest(req.getUrl()); return r!=null?r:denied();
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        setContentView(web);
        web.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }
    @Override protected void onPause() {
        web.evaluateJavascript("window.pauseForBackground && window.pauseForBackground()",null);
        getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        super.onPause();
    }
    @Override protected void onResume() { super.onResume(); }
    @Override protected void onDestroy() { if(web!=null)web.destroy(); super.onDestroy(); }
    @Override public void onBackPressed() {
        new android.app.AlertDialog.Builder(this).setTitle("离开训练测试？")
            .setMessage("已保存的完整批次会保留。当前未保存的计算可能中断，建议先点击暂停并等待保存。")
            .setPositiveButton("离开",(d,w)->finish()).setNegativeButton("继续查看",null).show();
    }
}
