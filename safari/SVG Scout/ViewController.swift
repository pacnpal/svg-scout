import Cocoa
import SafariServices

class ViewController: NSViewController {
    @IBOutlet weak var appNameLabel: NSTextField!
    @IBOutlet weak var statusLabel: NSTextField!

    override func viewDidLoad() {
        super.viewDidLoad()
        appNameLabel.stringValue = "SVG Scout"
        updateExtensionStatus()
    }

    override func viewWillAppear() {
        super.viewWillAppear()
        updateExtensionStatus()
    }

    func updateExtensionStatus() {
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: "com.svgscout.app.extension") { state, error in
            DispatchQueue.main.async {
                if let error = error {
                    self.statusLabel.stringValue = "Error: \(error.localizedDescription)"
                    return
                }

                if let state = state {
                    if state.isEnabled {
                        self.statusLabel.stringValue = "SVG Scout extension is enabled in Safari."
                    } else {
                        self.statusLabel.stringValue = "SVG Scout extension is disabled. Enable it in Safari > Settings > Extensions."
                    }
                } else {
                    self.statusLabel.stringValue = "Unable to determine extension status."
                }
            }
        }
    }

    @IBAction func openSafariPreferences(_ sender: Any) {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: "com.svgscout.app.extension") { error in
            if let error = error {
                print("Error opening Safari preferences: \(error.localizedDescription)")
            }
        }
    }
}
