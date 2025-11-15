# Bluetooth Arduino Integration Setup

## Overview

The app now includes Bluetooth Low Energy (BLE) functionality to connect to an HM-10 module interfaced with an Arduino. When a user logs a recycled item, the data is automatically sent to the Arduino via Bluetooth.

## What Was Implemented

### 1. Bluetooth Service (`services/bluetoothService.ts`)
- BLE scanning and device discovery
- Connection management for HM-10 modules
- Data transmission in multiple formats (JSON, CSV, custom)
- Automatic characteristic discovery

### 2. UI Components
- Bluetooth connection button on home screen
- Connection modal with device scanning
- Connection status indicator
- Device list with tap-to-connect

### 3. Integration
- Automatic data transmission when items are logged
- Seamless fallback if Bluetooth is not connected
- Permission handling for iOS and Android

## Data Format Sent to Arduino

When an item is logged, the following data is sent:

**JSON Format (default):**
```json
{
  "item": "aluminum can",
  "category": "Metal",
  "co2Saved": 0.15,
  "timestamp": "2024-11-13T20:42:34.123Z"
}
```

**CSV Format:**
```
aluminum can,Metal,0.15,2024-11-13T20:42:34.123Z
```

**Custom Format:**
```
aluminum can|Metal|0.15|2024-11-13T20:42:34.123Z
```

You can change the format in `logRecycledItem()` function by modifying:
```typescript
await bluetoothService.sendData(dataToSend, 'json'); // Change to 'csv' or 'custom'
```

## Information Needed for Arduino Side

To complete the integration, please provide:

1. **HM-10 Configuration:**
   - Device name (if customized)
   - Service UUID (if different from default)
   - Characteristic UUID (if different from default)

2. **Data Format Preference:**
   - Which format should Arduino receive? (JSON/CSV/Custom)
   - Any specific delimiter or structure needed?

3. **Arduino Code Requirements:**
   - What should Arduino do with the received data?
   - Display on LCD/screen?
   - Trigger a mechanism?
   - Log to SD card?
   - Send to another system?

4. **Connection Behavior:**
   - Should the app auto-reconnect?
   - Any specific connection timeout needed?

## HM-10 Default Configuration

The app is configured for standard HM-10 modules:
- **Service UUID:** `0000ffe0-0000-1000-8000-00805f9b34fb`
- **Characteristic UUID:** `0000ffe1-0000-1000-8000-00805f9b34fb`

If your HM-10 uses different UUIDs, update them in `services/bluetoothService.ts`.

## Setup Steps

1. **Rebuild the app** (required for native Bluetooth module):
   ```bash
   npx expo run:ios --device
   ```

2. **On your iPhone:**
   - Open the app
   - Tap "Connect to Arduino" button
   - Tap "Scan for Devices"
   - Select your HM-10 device from the list
   - Wait for connection confirmation

3. **Test the connection:**
   - Scan an item with the camera
   - Log the item
   - Data should automatically send to Arduino

## Arduino Code Example

Here's a basic Arduino sketch to receive the data:

```cpp
#include <SoftwareSerial.h>

SoftwareSerial BTSerial(10, 11); // RX, TX pins for HM-10

void setup() {
  Serial.begin(9600);
  BTSerial.begin(9600); // HM-10 default baud rate
  Serial.println("Arduino ready for Bluetooth");
}

void loop() {
  if (BTSerial.available()) {
    String data = BTSerial.readString();
    Serial.print("Received: ");
    Serial.println(data);
    
    // Parse JSON or process data here
    // Example: Extract item name, category, etc.
  }
}
```

## Troubleshooting

1. **Device not found:**
   - Make sure HM-10 is powered on
   - Check that HM-10 is in pairing mode
   - Ensure devices are within range (typically 10-30 meters)

2. **Connection fails:**
   - Verify HM-10 is not already connected to another device
   - Check HM-10 firmware version (some use different UUIDs)
   - Try resetting the HM-10 module

3. **Data not received:**
   - Check Arduino serial monitor for incoming data
   - Verify baud rate matches (default 9600)
   - Check HM-10 TX/RX connections to Arduino

## Next Steps

1. Rebuild the app with the new Bluetooth functionality
2. Test connection with your HM-10
3. Share your Arduino code requirements so we can adjust the data format if needed
4. Test end-to-end: scan item → log → verify Arduino receives data


