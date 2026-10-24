package com.headshotairbattle.trainingtest;
import android.content.Intent;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.util.concurrent.*;
@RunWith(AndroidJUnit4.class)
public class DeviceTest {
  private String js(TrainingActivity a,String code)throws Exception {
    CountDownLatch latch=new CountDownLatch(1); String[] value={"null"};
    InstrumentationRegistry.getInstrumentation().runOnMainSync(()->a.web.evaluateJavascript(code,v->{value[0]=v;latch.countDown();}));
    if(!latch.await(30,TimeUnit.SECONDS))throw new Exception("WebView response timeout");return value[0];
  }
  @Test public void nativeTrainingLifecycle()throws Exception {
    var ins=InstrumentationRegistry.getInstrumentation();
    Intent intent=new Intent(ins.getTargetContext(),TrainingActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    TrainingActivity a=(TrainingActivity)ins.startActivitySync(intent);
    long deadline=System.currentTimeMillis()+120000;
    while(!"true".equals(js(a,"!!window.deviceQA"))&&System.currentTimeMillis()<deadline)Thread.sleep(500);
    assertEquals("true",js(a,"!!window.deviceQA"));
    js(a,"window.deviceQA.start(); true");
    deadline=System.currentTimeMillis()+720000;
    String result="null";
    while(System.currentTimeMillis()<deadline){result=js(a,"window.deviceQA.status");if(result.equals("\"pass\"")||result.equals("\"fail\""))break;Thread.sleep(1000);}
    assertEquals("Private device validation did not complete; inspect encrypted diagnostics", "\"pass\"",result);
    ins.runOnMainSync(()->a.web.reload());
    deadline=System.currentTimeMillis()+120000;
    while(!"true".equals(js(a,"!!window.deviceQA && window.deviceQA.restored"))&&System.currentTimeMillis()<deadline)Thread.sleep(500);
    assertEquals("true",js(a,"window.deviceQA.restored"));
    ins.runOnMainSync(a::finish);
  }
}
