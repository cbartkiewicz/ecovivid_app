import { BleManager, Device, Characteristic, Service } from 'react-native-ble-plx';

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
  private manager: BleManager;
  private connectedDevice: Device | null = null;
  private characteristic: Characteristic | null = null;
  private isScanning: boolean = false;

  constructor() {
    this.manager = new BleManager();
  }

  // Initialize Bluetooth
  async initialize(): Promise<boolean> {
    try {
      const state = await this.manager.state();
      
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
          
          const subscription = this.manager.onStateChange((newState) => {
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
        
        const subscription = this.manager.onStateChange((newState) => {
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
    if (this.isScanning) {
      return;
    }

    // Check Bluetooth state before scanning
    try {
      const state = await this.manager.state();
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
      await this.manager.startDeviceScan(
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
    if (this.isScanning) {
      this.manager.stopDeviceScan();
      this.isScanning = false;
    }
  }

  // Connect to a device
  async connectToDevice(deviceId: string): Promise<boolean> {
    try {
      // Check Bluetooth state before connecting
      const state = await this.manager.state();
      if (state !== 'PoweredOn') {
        throw new Error(`Cannot connect: Bluetooth is not ready. Current state: ${state}`);
      }

      // Disconnect existing connection
      if (this.connectedDevice) {
        await this.disconnect();
      }

      // Connect with timeout
      const device = await Promise.race([
        this.manager.connectToDevice(deviceId),
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
            this.connectedDevice = device;
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
          this.connectedDevice = device;
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
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }

  // Send hex code to Arduino
  async sendHexCode(hexCode: string): Promise<boolean> {
    if (!this.connectedDevice || !this.characteristic) {
      console.warn('No device connected');
      return false;
    }

    try {
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

      await this.characteristic.writeWithoutResponse(base64Message);
      console.log(`Sent hex code: ${hexCode}`);
      return true;
    } catch (error) {
      console.error('Send hex code error:', error);
      return false;
    }
  }

  // Check if connected
  isConnected(): boolean {
    return this.connectedDevice !== null && this.characteristic !== null;
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
    this.manager.destroy();
  }
}

// Export singleton instance
export const bluetoothService = new BluetoothService();

