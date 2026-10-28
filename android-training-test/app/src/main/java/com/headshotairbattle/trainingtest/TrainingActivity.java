package com.headshotairbattle.trainingtest;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.webkit.*;
import android.net.Uri;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;
import android.content.Intent;
import android.webkit.ValueCallback;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.JSONObject;
import java.util.Collections;
import java.nio.charset.StandardCharsets;

public class TrainingActivity extends Activity {
    public WebView web;
    private ValueCallback<Uri[]> fileChooser;
    private String exportId, exportText;
    private boolean exporting;
    private AccountBridge accountBridge;
    private boolean accountRequest(Uri u) {
        return "https".equals(u.getScheme()) && "stampday.tybbtech.com".equals(u.getHost()) && (u.getPort()==-1||u.getPort()==443) && u.getPath()!=null && u.getPath().startsWith("/yijiang/api/");
    }
    private static final int OPEN_FILE=41, SAVE_FILE=42;
    private void exportResult(String id,String result) {
        if(web!=null) web.evaluateJavascript("window.__nativeFileResult&&window.__nativeFileResult("+JSONObject.quote(id)+","+JSONObject.quote(result)+")",null);
    }
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
                return r!=null?r:accountRequest(req.getUrl())?null:denied();
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
                WebResourceResponse r=loader.shouldInterceptRequest(req.getUrl()); return r!=null?r:accountRequest(req.getUrl())?null:denied();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params) {
                if(fileChooser!=null)fileChooser.onReceiveValue(null);
                fileChooser=callback;
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/json","text/plain","application/octet-stream"});
                try { startActivityForResult(intent,OPEN_FILE); }
                catch(Exception e){fileChooser.onReceiveValue(null);fileChooser=null;}
                return true;
            }
        });
        if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web,"NativeFiles",Collections.singleton("https://appassets.androidplatform.net"),(v,message,origin,mainFrame,reply)->{
                if(!mainFrame)return;
                String id="";
                try {
                    JSONObject data=new JSONObject(message.getData());id=data.getString("id");
                    String name=data.getString("name"),body=data.getString("text");
                    if(exporting||id.length()>80||name.length()>160||!name.endsWith(".json")||name.matches(".*[\\\\/\\x00-\\x1f].*")||body.getBytes(StandardCharsets.UTF_8).length>64*1024*1024)throw new IllegalArgumentException();
                    exportId=id;exportText=body;exporting=true;
                    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE,name);
                    startActivityForResult(intent,SAVE_FILE);
                } catch(Exception e){exportResult(id,"error");if(id.equals(exportId)){exportText=null;exportId=null;exporting=false;}}
            });
        }
        accountBridge=new AccountBridge(this,web);
        if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web,"nativeAccount",Collections.singleton("https://appassets.androidplatform.net"),(v,message,origin,main,reply)->{
                if(main)accountBridge.receive(message.getData());
            });
        }
        setContentView(web);
        web.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }
    @Override protected void onPause() {
        web.evaluateJavascript("window.pauseForBackground && window.pauseForBackground()",null);
        getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        super.onPause();
    }
    @Override protected void onResume() { super.onResume(); }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if(request==OPEN_FILE&&fileChooser!=null){fileChooser.onReceiveValue(result==RESULT_OK&&data!=null&&data.getData()!=null?new Uri[]{data.getData()}:null);fileChooser=null;}
        if(request==SAVE_FILE&&exportId!=null){
            final String id=exportId,body=exportText;exportId=null;exportText=null;
            if(result!=RESULT_OK||data==null||data.getData()==null){exporting=false;exportResult(id,"cancelled");return;}
            final Uri destination=data.getData();
            new Thread(()->{
                String state="saved";
                try(java.io.OutputStream stream=getContentResolver().openOutputStream(destination,"wt")){
                    if(stream==null)throw new java.io.IOException();stream.write(body.getBytes(StandardCharsets.UTF_8));stream.flush();
                }catch(Exception e){state="error";}
                final String completed=state;runOnUiThread(()->{exporting=false;if(!isDestroyed())exportResult(id,completed);});
            },"document-export").start();
        }
    }
    @Override protected void onDestroy() { if(fileChooser!=null){fileChooser.onReceiveValue(null);fileChooser=null;}if(web!=null){web.destroy();web=null;}super.onDestroy(); }
    @Override public void onBackPressed() {
        new android.app.AlertDialog.Builder(this).setTitle("离开训练测试？")
            .setMessage("已保存的完整批次会保留。当前未保存的计算可能中断，建议先点击暂停并等待保存。")
            .setPositiveButton("离开",(d,w)->finish()).setNegativeButton("继续查看",null).show();
    }
}
