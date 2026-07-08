import CoreLocation
import Foundation

let outputPath = CommandLine.arguments.dropFirst().first

func emitSuccess(_ text: String) {
    if let outputPath {
        try? text.write(toFile: outputPath, atomically: true, encoding: .utf8)
    } else {
        print(text)
    }
}

func emitFailure(_ text: String, code: Int32) -> Never {
    if let outputPath {
        try? text.write(toFile: outputPath, atomically: true, encoding: .utf8)
    } else {
        fputs("\(text)\n", stderr)
    }
    exit(code)
}

final class LocationDelegate: NSObject, CLLocationManagerDelegate {
    private let manager: CLLocationManager
    private var finished = false

    init(manager: CLLocationManager) {
        self.manager = manager
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard !finished, let location = locations.last else {
            return
        }

        finish(with: location)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard !finished else {
            return
        }

        finished = true
        let nsError = error as NSError
        if nsError.domain == kCLErrorDomain && nsError.code == CLError.Code.denied.rawValue {
            emitFailure("Location permission denied. Enable Location Services for Star Skylight Location in System Settings > Privacy & Security > Location Services.", code: 3)
        }

        emitFailure("Location error: \(error.localizedDescription)", code: 2)
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            startLocationUpdates()
        case .denied, .restricted:
            emitFailure("Location permission denied or restricted.", code: 3)
        case .notDetermined:
            break
        @unknown default:
            emitFailure("Unknown location authorization state.", code: 4)
        }
    }

    func startLocationUpdates() {
        if let location = manager.location {
            finish(with: location)
            return
        }

        manager.startUpdatingLocation()
    }

    private func finish(with location: CLLocation) {
        guard !finished else {
            return
        }

        finished = true
        emitSuccess("\(location.coordinate.latitude) \(location.coordinate.longitude)")
        manager.stopUpdatingLocation()
        exit(0)
    }
}

let manager = CLLocationManager()
let delegate = LocationDelegate(manager: manager)
manager.delegate = delegate
manager.desiredAccuracy = kCLLocationAccuracyKilometer

if CLLocationManager.locationServicesEnabled() {
    switch manager.authorizationStatus {
    case .authorizedAlways, .authorizedWhenInUse:
        delegate.startLocationUpdates()
    case .notDetermined:
        if #available(macOS 10.15, *) {
            manager.requestWhenInUseAuthorization()
        }
        delegate.startLocationUpdates()
    case .denied, .restricted:
        emitFailure("Location permission denied or restricted.", code: 3)
    @unknown default:
        emitFailure("Unknown location authorization state.", code: 4)
    }
    RunLoop.current.run(until: Date().addingTimeInterval(60))
    emitFailure("Timed out waiting for current location.", code: 5)
} else {
    emitFailure("Location Services are disabled.", code: 6)
}
