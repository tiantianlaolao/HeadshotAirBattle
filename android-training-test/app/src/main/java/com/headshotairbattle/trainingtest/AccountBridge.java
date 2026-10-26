package com.headshotairbattle.trainingtest;

import android.app.Activity;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.webkit.WebView;
import androidx.credentials.*;
import androidx.credentials.exceptions.*;
import com.google.android.libraries.identity.googleid.*;
import org.json.JSONObject;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import java.security.KeyStore;
import java.nio.charset.StandardCharsets;

final class AccountBridge {
    private final Activity activity;
    private final WebView web;
    private final CredentialManager manager;
    private boolean signingIn;
    private static final String KEY="yijiang.account.session.v1";
    AccountBridge(Activity a,WebView w){activity=a;web=w;manager=CredentialManager.create(a);}
    private void reply(String id,JSONObject result){if(!activity.isDestroyed())web.evaluateJavascript("window.__nativeAccountResult&&window.__nativeAccountResult("+JSONObject.quote(id)+","+result+")",null);}
    private JSONObject value(String k,Object v){try{return new JSONObject().put(k,v);}catch(Exception e){return new JSONObject();}}
    private SecretKey key()throws Exception{
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        if(!store.containsAlias(KEY)){KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");generator.init(new KeyGenParameterSpec.Builder(KEY,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());generator.generateKey();}
        return (SecretKey)store.getKey(KEY,null);
    }
    void receive(String text){
        String id="";
        try{
            if(text==null||text.length()>10000)return;
            JSONObject m=new JSONObject(text);id=m.getString("id");if(id.length()>100)return;final String requestId=id;
            SharedPreferences prefs=activity.getSharedPreferences(KEY,Activity.MODE_PRIVATE);
            switch(m.getString("op")){
            case "capabilities":reply(id,value("providers",new org.json.JSONArray().put("google")));break;
            case "read":{
                String data=prefs.getString("data",null);if(data==null){reply(id,new JSONObject());break;}
                Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(prefs.getString("iv",""),Base64.NO_WRAP)));
                reply(id,value("session",new String(cipher.doFinal(Base64.decode(data,Base64.NO_WRAP)),StandardCharsets.UTF_8)));break;
            }
            case "write":{
                String data=m.getString("session");if(data.length()>8192)throw new IllegalArgumentException();
                Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
                if(!prefs.edit().putString("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)).putString("data",Base64.encodeToString(cipher.doFinal(data.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP)).commit())throw new IllegalStateException();
                reply(id,value("ok",true));break;
            }
            case "clear":
                if(!prefs.edit().clear().commit())throw new IllegalStateException();
                manager.clearCredentialStateAsync(new ClearCredentialStateRequest(),null,activity.getMainExecutor(),new CredentialManagerCallback<Void,ClearCredentialException>(){public void onResult(Void result){reply(requestId,value("ok",true));}public void onError(ClearCredentialException e){reply(requestId,value("ok",true));}});break;
            case "signin":{
                if(signingIn){reply(id,value("error","busy"));break;}
                String nonce=m.getString("nonce");if(!nonce.matches("[a-f0-9]{64}")||!m.getString("provider").equals("google"))throw new IllegalArgumentException();
                String client=activity.getString(R.string.account_google_client_id);if(client.isEmpty()){reply(id,value("error","not_configured"));break;}
                GetSignInWithGoogleOption option=new GetSignInWithGoogleOption.Builder(client).setNonce(nonce).build();
                GetCredentialRequest request=new GetCredentialRequest.Builder().addCredentialOption(option).build();signingIn=true;
                manager.getCredentialAsync(activity,request,null,activity.getMainExecutor(),new CredentialManagerCallback<GetCredentialResponse,GetCredentialException>(){
                    public void onResult(GetCredentialResponse result){signingIn=false;try{Credential c=result.getCredential();if(!(c instanceof CustomCredential)||!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(c.getType()))throw new IllegalArgumentException();reply(requestId,value("token",GoogleIdTokenCredential.createFrom(c.getData()).getIdToken()));}catch(Exception e){reply(requestId,value("error","invalid_identity"));}}
                    public void onError(GetCredentialException e){signingIn=false;reply(requestId,value("error",e instanceof GetCredentialCancellationException?"cancelled":"provider_error"));}
                });break;
            }
            default:reply(id,value("error","unsupported"));
            }
        }catch(Exception e){reply(id,value("error","storage_error"));}
    }
}
