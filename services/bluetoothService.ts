import { BleManager, Device, Characteristic, Service } from 'react-native-ble-plx';
import { Platform } from 'react-native';

// HM-10 BLE Module Configuration
// HM-10 typically uses these UUIDs (may vary by firmware version)
const HM10_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb'; // HM-10 Service UUID
const HM10_CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb'; // HM-10 Characteristic UUID

// Alternative UUIDs (some HM-10 modules use these)
const ALTERNATIVE_SERVICE_UUID = '0000ff00-0000-1000-8000-00805f9b34fb';
const ALTERNATIVE_CHARACTERISTIC_UUID = '0000ff01-0000-1000-8000-00805f9b34fb';

export interface BluetoothDevice {
  id: string;
  name: string | null;
  isConnectable: boolean | null;
}


class BluetoothService {
  private manager: BleManager | null = null;
  private connectedDevice: Device | null = null;
  private characteristic: Characteristic | null = null;
  private characteristicUUID: string | null = null;
  private serviceUUID: string | null = null;
  private isScanning: boolean = false;
  private isSimulator: boolean = false;

  constructor() {
    // Don't initialize BleManager in constructor to avoid errors in simulator
    // Use lazy initialization instead
    // Simulator detection will happen when methods are called
  }

  // Lazy initialization of BleManager
  private getManager(): BleManager {
    if (!this.manager) {
      try {
        this.manager = new BleManager();
      } catch (error: any) {
        // If initialization fails, likely running on simulator
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('NativeEventEmitter') || 
            errorMessage.includes('null') ||
            errorMessage.includes('undefined')) {
          this.isSimulator = true;
          throw new Error('Bluetooth is not available on iOS Simulator. Please use a physical device.');
        }
        console.error('Failed to initialize BleManager:', error);
        throw new Error('Bluetooth is not available on this device.');
      }
    }
    
    return this.manager;
  }

  // Initialize Bluetooth
  async initialize(): Promise<boolean> {
    if (this.isSimulator) {
      console.warn('Bluetooth is not available on iOS Simulator');
      return false;
    }

    try {
      const manager = this.getManager();
      const state = await manager.state();
      
      // Handle all possible Bluetooth states
      if (state === 'PoweredOn') {
        return true;
      }
      
      if (state === 'PoweredOff') {
        console.warn('Bluetooth is powered off');
        return false;
      }
      
      if (state === 'Unknown' || state === 'Resetting' || state === 'Unsupported') {
        // Wait for Bluetooth to transition to a known state
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            subscription.remove();
            resolve(false);
          }, 10000); // 10 second timeout
          
          const subscription = manager.onStateChange((newState) => {
            if (newState === 'PoweredOn') {
              clearTimeout(timeout);
              subscription.remove();
              resolve(true);
            } else if (newState === 'PoweredOff' || newState === 'Unsupported') {
              clearTimeout(timeout);
              subscription.remove();
              resolve(false);
            }
          });
        });
      }
      
      // For other states (Unauthorized, Unsupported), wait for transition
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          subscription.remove();
          resolve(false);
        }, 5000);
        
        const subscription = manager.onStateChange((newState) => {
          if (newState === 'PoweredOn') {
            clearTimeout(timeout);
            subscription.remove();
            resolve(true);
          } else if (newState === 'PoweredOff' || newState === 'Unsupported') {
            clearTimeout(timeout);
            subscription.remove();
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error('Bluetooth initialization error:', error);
      return false;
    }
  }

  // Scan for HM-10 devices
  async scanForDevices(
    onDeviceFound: (device: BluetoothDevice) => void,
    deviceName?: string
  ): Promise<void> {
    if (this.isSimulator) {
      throw new Error('Bluetooth is not available on iOS Simulator. Please use a physical device.');
    }

    if (this.isScanning) {
      return;
    }

    const manager = this.getManager();

    // Check Bluetooth state before scanning
    try {
      const state = await manager.state();
      if (state !== 'PoweredOn') {
        throw new Error(`Bluetooth is not ready. Current state: ${state}`);
      }
    } catch (error) {
      console.error('Bluetooth state check failed:', error);
      throw error;
    }

    this.isScanning = true;

    try {
      // Scan for the specific HM-10 device
      // Target device characteristics:
      // - Local Name: DSD TECH
      // - Service UUIDs: FFE0
      // - Manufacturer Data [0x4D48]: 0x685E1C3391A1
      // - Service Data B000: 0x00000000
      // 
      // We scan all devices first, then filter by name (most reliable identifier)
      await manager.startDeviceScan(
        null, // Scan all devices to ensure we catch it even if service UUID isn't advertised
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            console.error('Scan error:', error);
            // Don't stop scanning on individual errors, just log them
            if (error.message?.includes('Unknown') || error.message?.includes('state')) {
              console.warn('Bluetooth state issue during scan, continuing...');
            }
            return;
          }

          if (device) {
            // Filter for the specific DSD TECH HM-10 device
            const deviceName = device.name || '';
            const serviceUUIDs = device.serviceUUIDs || [];
            
            // Primary filter: Check if device name matches "DSD TECH" (most reliable)
            const isDSDTech = deviceName.trim() === 'DSD TECH' || 
                             deviceName.trim().includes('DSD TECH');
            
            // Secondary filter: Check if device has FFE0 service UUID (if available in scan)
            const hasFFE0Service = serviceUUIDs.length === 0 || // If no service UUIDs in scan, still consider
                                   serviceUUIDs.some(uuid => {
                                     const uuidLower = uuid.toLowerCase();
                                     return uuidLower.includes('ffe0') || 
                                            uuidLower === '0000ffe0-0000-1000-8000-00805f9b34fb' ||
                                            uuidLower === 'ffe0';
                                   });
            
            // Match device primarily by name "DSD TECH"
            // Service UUID check is secondary since it might not always be in scan results
            if (isDSDTech) {
              console.log('Found target HM-10 device (DSD TECH):', device.name, device.id, 'Service UUIDs:', serviceUUIDs);
              onDeviceFound({
                id: device.id,
                name: device.name || 'DSD TECH HM-10',
                isConnectable: device.isConnectable,
              });
            }
          }
        }
      );

      // Stop scanning after 10 seconds
      setTimeout(() => {
        this.stopScan();
      }, 10000);
    } catch (error) {
      console.error('Scan start error:', error);
      this.isScanning = false;
      throw error;
    }
  }

  // Stop scanning
  stopScan(): void {
    if (this.isScanning && this.manager) {
      try {
        this.manager.stopDeviceScan();
      } catch (error) {
        console.error('Error stopping scan:', error);
      }
      this.isScanning = false;
    }
  }

  // Connect to a device
  async connectToDevice(deviceId: string): Promise<boolean> {
    if (this.isSimulator) {
      throw new Error('Bluetooth is not available on iOS Simulator. Please use a physical device.');
    }

    try {
      const manager = this.getManager();
      
      // Check Bluetooth state before connecting
      const state = await manager.state();
      if (state !== 'PoweredOn') {
        throw new Error(`Cannot connect: Bluetooth is not ready. Current state: ${state}`);
      }

      // Disconnect existing connection
      if (this.connectedDevice) {
        await this.disconnect();
      }

      // Connect with timeout
      const device = await Promise.race([
        manager.connectToDevice(deviceId),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        )
      ]);

      // Discover services and characteristics
      await device.discoverAllServicesAndCharacteristics();

      // Try to find the characteristic
      const services = await device.services();
      
      for (const service of services) {
        const characteristics = await service.characteristics();
        
        for (const char of characteristics) {
          // HM-10 typically uses FFE1 characteristic for data
          if (char.uuid.toLowerCase().includes('ffe1') || 
              char.uuid.toLowerCase().includes('ff01') ||
              char.properties.write) {
            this.characteristic = char;
            this.characteristicUUID = char.uuid;
            this.serviceUUID = service.uuid;
            this.connectedDevice = device;
            console.log('Found characteristic:', char.uuid, 'in service:', service.uuid);
            return true;
          }
        }
      }

      // If no specific characteristic found, try to use first writable one
      for (const service of services) {
        const characteristics = await service.characteristics();
        const writableChar = characteristics.find(char => char.properties.write);
        if (writableChar) {
          this.characteristic = writableChar;
          this.characteristicUUID = writableChar.uuid;
          this.serviceUUID = service.uuid;
          this.connectedDevice = device;
          console.log('Found writable characteristic:', writableChar.uuid, 'in service:', service.uuid);
          return true;
        }
      }

      // If we connected but couldn't find a writable characteristic, still consider it connected
      // (HM-10 might have different characteristics)
      if (services.length > 0) {
        this.connectedDevice = device;
        // Try to find any characteristic as fallback
        const firstService = services[0];
        const firstChar = (await firstService.characteristics())[0];
        if (firstChar) {
          this.characteristic = firstChar;
          this.characteristicUUID = firstChar.uuid;
          this.serviceUUID = firstService.uuid;
          console.log('Using fallback characteristic:', firstChar.uuid, 'in service:', firstService.uuid);
        }
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('Connection error:', error);
      
      // Provide user-friendly error messages
      if (error.message?.includes('Unknown') || error.message?.includes('state')) {
        throw new Error('Bluetooth is not ready. Please ensure Bluetooth is enabled and try again.');
      } else if (error.message?.includes('timeout')) {
        throw new Error('Connection timed out. Make sure the device is powered on and in range.');
      } else if (error.message?.includes('not found')) {
        throw new Error('Device not found. Please scan again.');
      }
      
      throw error;
    }
  }

  // Disconnect from device
  async disconnect(): Promise<void> {
    try {
      if (this.connectedDevice) {
        await this.connectedDevice.cancelConnection();
        this.connectedDevice = null;
        this.characteristic = null;
        this.characteristicUUID = null;
        this.serviceUUID = null;
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }

  // Send hex code to Arduino
  async sendHexCode(hexCode: string): Promise<boolean> {
    if (!this.connectedDevice) {
      console.warn('No device connected');
      return false;
    }

    try {
      // Always re-fetch the characteristic to ensure it's still valid
      // Characteristic objects can become stale, so we re-fetch using stored UUIDs
      let characteristic: Characteristic | null = null;
      
      if (this.serviceUUID && this.characteristicUUID) {
        try {
          const services = await this.connectedDevice.services();
          for (const service of services) {
            if (service.uuid.toLowerCase() === this.serviceUUID!.toLowerCase()) {
              const characteristics = await service.characteristics();
              characteristic = characteristics.find(
                char => char.uuid.toLowerCase() === this.characteristicUUID!.toLowerCase()
              ) || null;
              if (characteristic) {
                // Update the stored characteristic reference
                this.characteristic = characteristic;
                break;
              }
            }
          }
        } catch (error) {
          console.warn('Error re-fetching characteristic:', error);
          // Fall back to stored characteristic if re-fetch fails
          characteristic = this.characteristic;
        }
      } else {
        // If we don't have UUIDs stored, use the stored characteristic
        characteristic = this.characteristic;
      }

      if (!characteristic) {
        console.error('Characteristic not found. Service UUID:', this.serviceUUID, 'Characteristic UUID:', this.characteristicUUID);
        return false;
      }

      // Convert hex string to byte array
      // Hex code format: "AAEE55ED" -> [0xAA, 0xEE, 0x55, 0xED]
      const bytes: number[] = [];
      const cleanHex = hexCode.replace(/\s/g, '').toUpperCase(); // Remove spaces and uppercase
      for (let i = 0; i < cleanHex.length; i += 2) {
        const byte = parseInt(cleanHex.substr(i, 2), 16);
        if (isNaN(byte)) {
          throw new Error(`Invalid hex code: ${hexCode}`);
        }
        bytes.push(byte);
      }

      // Convert byte array to base64 for BLE transmission
      // React Native BLE requires base64 encoded data
      const uint8Array = new Uint8Array(bytes);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      
      let base64Message: string;
      if (typeof btoa !== 'undefined') {
        base64Message = btoa(binary);
      } else {
        // Fallback: try to send raw bytes (may not work on all platforms)
        base64Message = binary;
      }

      await characteristic.writeWithoutResponse(base64Message);
      console.log(`✅ Bluetooth: Successfully wrote hex code ${hexCode} to characteristic: ${characteristic.uuid}`);
      return true;
    } catch (error: any) {
      console.error('Send hex code error:', error);
      console.error('Error details:', error?.message, error?.code);
      // Try to re-fetch characteristic on next attempt
      this.characteristic = null;
      return false;
    }
  }

  // Check if connected
  isConnected(): boolean {
    return this.connectedDevice !== null && (this.characteristic !== null || (this.serviceUUID !== null && this.characteristicUUID !== null));
  }

  // Get connected device info
  getConnectedDevice(): BluetoothDevice | null {
    if (this.connectedDevice) {
      return {
        id: this.connectedDevice.id,
        name: this.connectedDevice.name,
        isConnectable: this.connectedDevice.isConnectable,
      };
    }
    return null;
  }

  // Cleanup
  destroy(): void {
    this.stopScan();
    if (this.connectedDevice) {
      this.disconnect();
    }
    if (this.manager) {
      try {
        this.manager.destroy();
      } catch (error) {
        console.error('Error destroying BleManager:', error);
      }
    }
  }
}

// Export singleton instance
export const bluetoothService = new BluetoothService();

