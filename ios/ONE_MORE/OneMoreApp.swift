import SwiftUI

// ONE MORE's existing HTML/Canvas2D game is the only game engine.
@main struct OneMoreApp: App {
    var body: some Scene {
        WindowGroup {
            InkGameHost().ignoresSafeArea(.all).statusBarHidden()
        }
    }
}
struct InkGameHost: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> InkGameViewController {
        InkGameViewController()
    }
    func updateUIViewController(_ controller: InkGameViewController, context: Context) {}
}
