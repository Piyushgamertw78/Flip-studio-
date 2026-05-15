package com.flipstudio.app;

  import com.getcapacitor.BridgeActivity;
  import android.webkit.WebView;
  import android.os.Bundle;

  public class MainActivity extends BridgeActivity {

      @Override
      protected void onCreate(Bundle savedInstanceState) {
          super.onCreate(savedInstanceState);
      }

      /**
       * Override back button behavior:
       *  - If WebView can go back (there is browser history): navigate back within the app
       *  - Otherwise: stay in app (do NOT call super.onBackPressed which would exit)
       */
      @Override
      public void onBackPressed() {
          WebView webView = getBridge().getWebView();
          if (webView != null && webView.canGoBack()) {
              webView.goBack();
          }
          // Intentionally omit super.onBackPressed() — prevents the app from being closed
      }
  }
  