import UIKit
import WebKit

// The canvas fills the device. Only DOM controls use the safe-area inset.
final class InkGameViewController: UIViewController, WKNavigationDelegate {
    private let webView: WKWebView = {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.allowsInlineMediaPlayback = true
        config.websiteDataStore = .default()
        let browser = WKWebView(frame: .zero, configuration: config)
        browser.isOpaque = false
        browser.backgroundColor = UIColor(red: 237/255, green: 231/255, blue: 217/255, alpha: 1)
        browser.scrollView.backgroundColor = browser.backgroundColor
        browser.scrollView.contentInsetAdjustmentBehavior = .never
        browser.scrollView.isScrollEnabled = false
        browser.scrollView.bounces = false
        return browser
    }()
    private var loaded = false
    private var lastInsets = CGSize(width: -1, height: -1)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = webView.backgroundColor
        webView.navigationDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        // Physical display edges, never safeAreaLayoutGuide.
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        guard let index = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Web") else {
            assertionFailure("Web/index.html is missing. Check Copy Game Web Assets.")
            return
        }
        webView.loadFileURL(index, allowingReadAccessTo: index.deletingLastPathComponent())
    }

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        updateSafeControls()
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        updateSafeControls()
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loaded = true
        lastInsets = CGSize(width: -1, height: -1)
        updateSafeControls()
    }
    private func updateSafeControls() {
        guard loaded else { return }
        let top = max(0, Int(ceil(view.safeAreaInsets.top)))
        let bottom = max(0, Int(ceil(view.safeAreaInsets.bottom)))
        let current = CGSize(width: CGFloat(top), height: CGFloat(bottom))
        guard current != lastInsets else { return }
        lastInsets = current
        // Existing PWA code and game canvas are unchanged. Only the overlay
        // UI remains below the physical camera cutout / home indicator.
        let script = """
        (function(){
          document.documentElement.classList.add('om-native');
          var style=document.getElementById('om-native-safe-ui');
          if(!style){
            style=document.createElement('style');
            style.id='om-native-safe-ui';
            document.head.appendChild(style);
          }
          style.textContent =
            'html.om-native #hud { top: \(top)px !important; bottom: \(bottom)px !important; }' +
            'html.om-native #openingSkip { top: calc(16px + \(top)px) !important; }' +
            'html.om-native #stage > .screen:not(.screen-intro) {' +
              'top: \(top)px !important; bottom: \(bottom)px !important;' +
              'height: calc(100dvh - \(top + bottom)px) !important; }' +
            'html.om-native #screenTitle .home-top { padding-top: 17px !important; }' +
            'html.om-native #screenIntro {' +
              'top: 0 !important; bottom: 0 !important; height: 100dvh !important; }' +
            'html.om-native #screenIntro .intro-filmhead { top: \(top)px !important; }' +
            '@media(max-width:720px){html.om-native .screen-select {' +
              'padding-top: 8px !important; }}';
        })();
        """
        webView.evaluateJavaScript(script, completionHandler: nil)
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if action.navigationType == .linkActivated,
           let url = action.request.url, !url.isFileURL {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        } else {
            decisionHandler(.allow)
        }
    }
}
