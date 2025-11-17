import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  Calendar,
  Camera as CameraIcon,
  Home,
  Info,
  Leaf,
  Recycle,
  Search,
  Trash2,
  TrendingUp,
  X,
  Bluetooth
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  PermissionsAndroid
} from 'react-native';
import { bluetoothService, BluetoothDevice } from '@/services/bluetoothService';

// Type definitions
type RecyclingLogEntry = {
  id: number;
  item: string;
  category: string;
  co2Saved: number;
  date: string;
};

type SearchResult = {
  item: string;
  recyclable: boolean | null;
  category?: string;
  co2Saved?: number;
  tips?: string;
};

type SelectedItem = {
  item: string;
  recyclable: boolean;
  category: string;
  co2Saved: number;
  tips: string;
};

type RecycledItemData = {
  item: string;
  category: string;
  co2Saved: number;
  timestamp: string;
};

// Recycling database - location-aware
// Currently uses a general database, but structure supports location-specific guidelines
const recyclingDatabase = {
  'aluminum can': { recyclable: true, category: 'Metal', co2Saved: 0.15, tips: 'Rinse before recycling' },
  'can': { recyclable: true, category: 'Metal', co2Saved: 0.15, tips: 'Rinse before recycling' },
  'plastic bottle': { recyclable: true, category: 'Plastic', co2Saved: 0.1, tips: 'Remove cap and rinse' },
  'bottle': { recyclable: true, category: 'Plastic', co2Saved: 0.1, tips: 'Remove cap and rinse' },
  'glass bottle': { recyclable: true, category: 'Glass', co2Saved: 0.05, tips: 'Remove metal lids' },
  'glass': { recyclable: true, category: 'Glass', co2Saved: 0.05, tips: 'Remove metal lids' },
  'cardboard': { recyclable: true, category: 'Paper', co2Saved: 0.08, tips: 'Flatten boxes' },
  'box': { recyclable: true, category: 'Paper', co2Saved: 0.08, tips: 'Flatten boxes' },
  'paper': { recyclable: true, category: 'Paper', co2Saved: 0.06, tips: 'Keep dry and clean' },
  'newspaper': { recyclable: true, category: 'Paper', co2Saved: 0.06, tips: 'Keep dry and clean' },
  'magazine': { recyclable: true, category: 'Paper', co2Saved: 0.06, tips: 'Keep dry and clean' },
  'pizza box': { recyclable: false, category: 'Contaminated', co2Saved: 0, tips: 'Compost if not greasy' },
  'plastic bag': { recyclable: false, category: 'Plastic', co2Saved: 0, tips: 'Return to grocery store bins' },
  'bag': { recyclable: false, category: 'Plastic', co2Saved: 0, tips: 'Return to grocery store bins' },
  'styrofoam': { recyclable: false, category: 'Special', co2Saved: 0, tips: 'Check special drop-off locations' },
  'cup': { recyclable: true, category: 'Plastic', co2Saved: 0.08, tips: 'Remove lid and rinse' }
};

const specialDisposalInfo = [
  { item: 'Electronics', info: 'Drop off at Golden Recycling Center, 1717 10th St' },
  { item: 'Batteries', info: 'Available at City Hall and various retailers' },
  { item: 'Paint & Chemicals', info: 'Hazardous Waste Collection Events quarterly' },
  { item: 'Mattresses', info: 'Special pickup - call 303-384-8181' }
];

const recyclingTips = [
  'Rinse containers to avoid contamination',
  'Keep recyclables dry - wet paper cannot be recycled',
  'Flatten cardboard boxes to save space',
  'Remove plastic film and bags from bins',
  'When in doubt, throw it out - contamination ruins batches'
];

// ----------------------------------------------------------------
// --- SUB-COMPONENTS (Moved outside main app to fix bugs) ---
// ----------------------------------------------------------------

// Camera Screen
const CameraScreen = ({ showCamera, stopCamera, permission, cameraRef, isScanning, captureAndAnalyze }) => (
  <Modal visible={showCamera} animationType="slide">
    <View style={styles.cameraContainer}>
      {permission?.granted && (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
        >
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.closeButton} onPress={stopCamera}>
              <X color="white" size={32} />
            </TouchableOpacity>

            {isScanning && (
              <View style={styles.scanningOverlay}>
                <Text style={styles.scanningText}>Analyzing item...</Text>
              </View>
            )}

            <View style={styles.cameraBottom}>
              <View style={styles.scanFrame} />
              <Text style={styles.cameraInstructions}>
                Point camera at recyclable item
              </Text>
              <TouchableOpacity
                style={[styles.captureButton, isScanning && styles.captureButtonDisabled]}
                onPress={captureAndAnalyze}
                disabled={isScanning}
              >
                <Text style={styles.captureButtonText}>
                  {isScanning ? 'Scanning...' : 'Capture & Scan'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
      )}
    </View>
  </Modal>
);

// Location Input Modal
const LocationModal = ({
  showLocationModal,
  setShowLocationModal,
  locationCity,
  setLocationCity,
  locationProvince,
  setLocationProvince,
  saveUserLocation,
  userLocation,
}) => (
  <Modal
    visible={showLocationModal}
    transparent
    animationType="slide"
    onRequestClose={() => {
      setShowLocationModal(false);
    }}
  >
    <TouchableOpacity 
      style={styles.modalOverlay}
      activeOpacity={1}
      onPress={() => setShowLocationModal(false)}
    >
      <View 
        style={styles.modalContent}
        onStartShouldSetResponder={() => true}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Set Your Location</Text>
          <TouchableOpacity 
            onPress={() => setShowLocationModal(false)}
            style={styles.modalCloseButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <X color="#6b7280" size={24} />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.modalText}>
          Enter your city and province/state to get local recycling guidelines
        </Text>
        
        <TextInput
          style={styles.locationInput}
          placeholder="City (e.g., Golden)"
          value={locationCity}
          onChangeText={setLocationCity}
          placeholderTextColor="#9ca3af"
        />
        
        <TextInput
          style={styles.locationInput}
          placeholder="Province/State (e.g., Colorado or CO)"
          value={locationProvince}
          onChangeText={setLocationProvince}
          placeholderTextColor="#9ca3af"
        />
        
        <TouchableOpacity
          style={[styles.modalButtonConfirm, (!locationCity.trim() || !locationProvince.trim()) && styles.modalButtonDisabled]}
          onPress={() => {
            if (locationCity.trim() && locationProvince.trim()) {
              saveUserLocation(locationCity.trim(), locationProvince.trim());
            }
          }}
          disabled={!locationCity.trim() || !locationProvince.trim()}
        >
          <Text style={styles.modalButtonConfirmText}>Save Location</Text>
        </TouchableOpacity>
        
        {userLocation && (
          <TouchableOpacity
            style={styles.modalButtonCancel}
            onPress={() => setShowLocationModal(false)}
          >
            <Text style={styles.modalButtonCancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  </Modal>
);

// Home Screen
const HomeScreen = ({ 
  searchQuery, 
  setSearchQuery, 
  handleSearch, 
  searchResult, 
  startCamera, 
  setCurrentScreen,
  bluetoothConnected,
  setShowBluetoothModal,
  userLocation,
  setShowLocationModal
}) => (
  <ScrollView style={styles.screen}>
    <View style={styles.header}>
      <Recycle color="#16a34a" size={64} />
      <Text style={styles.title}>EcoVivid</Text>
      <Text style={styles.subtitle}>
        Your guide to recycling
      </Text>
      <TouchableOpacity 
        style={styles.locationButton}
        onPress={() => setShowLocationModal(true)}
      >
        <Text style={styles.locationButtonText}>
          {userLocation ? `📍 ${userLocation.city}, ${userLocation.province}` : '📍 Set Location'}
        </Text>
      </TouchableOpacity>
    </View>

    {/* Bluetooth Status Button */}
    <TouchableOpacity 
      style={[styles.bluetoothButton, bluetoothConnected && styles.bluetoothButtonConnected]}
      onPress={() => setShowBluetoothModal(true)}
      activeOpacity={0.7}
    >
      <Bluetooth color={bluetoothConnected ? "white" : "#16a34a"} size={24} />
      <Text style={[styles.bluetoothButtonText, bluetoothConnected && styles.bluetoothButtonTextConnected]}>
        {bluetoothConnected ? 'Connected to Arduino' : 'Connect to Arduino'}
      </Text>
    </TouchableOpacity>

    <TouchableOpacity style={styles.cameraButton} onPress={startCamera}>
      <CameraIcon color="white" size={48} />
      <Text style={styles.cameraButtonTitle}>Scan Item with Camera</Text>
      <Text style={styles.cameraButtonSubtitle}>Point at item to check recyclability</Text>
    </TouchableOpacity>

    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or search manually</Text>
      <View style={styles.dividerLine} />
    </View>

    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Search color="#16a34a" size={20} />
        <Text style={styles.cardTitle}>Search Item</Text>
      </View>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery} // This will no longer cause a full re-render
          onSubmitEditing={handleSearch}
          placeholder="e.g., aluminum can, pizza box"
          placeholderTextColor="#9ca3af"
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {searchResult && (
        <View style={[
          styles.resultCard,
          searchResult.recyclable === true && styles.resultCardGreen,
          searchResult.recyclable === false && styles.resultCardRed,
          searchResult.recyclable === null && styles.resultCardGray
        ]}>
          <Text style={styles.resultItemName}>{searchResult.item}</Text>
          {searchResult.recyclable === true && (
            <>
              <Text style={styles.resultRecyclable}>✓ Recyclable in Golden, CO</Text>
              <Text style={styles.resultDetail}>Category: {searchResult.category}</Text>
              <Text style={styles.resultDetail}>Tip: {searchResult.tips}</Text>
              <Text style={styles.resultImpact}>Impact: ~{searchResult.co2Saved} kg CO₂ saved</Text>
            </>
          )}
          {searchResult.recyclable === false && (
            <>
              <Text style={styles.resultNotRecyclable}>✗ Not recyclable in curbside bins</Text>
              <Text style={styles.resultDetail}>Category: {searchResult.category}</Text>
              <Text style={styles.resultDetail}>Alternative: {searchResult.tips}</Text>
            </>
          )}
          {searchResult.recyclable === null && (
            <Text style={styles.resultDetail}>
              Item not found in database. Contact Golden Recycling at 303-384-8181 for guidance.
            </Text>
          )}
        </View>
      )}
    </View>

    <View style={styles.buttonGrid}>
      <TouchableOpacity
        style={[styles.gridButton, styles.gridButtonBlue]}
        onPress={() => setCurrentScreen('guidelines')}
      >
        <Info color="white" size={20} />
        <Text style={styles.gridButtonText}>Guidelines</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.gridButton, styles.gridButtonPurple]}
        onPress={() => setCurrentScreen('tips')}
      >
        <Leaf color="white" size={20} />
        <Text style={styles.gridButtonText}>Tips</Text>
      </TouchableOpacity>
    </View>
  </ScrollView>
);

// Guidelines Screen
const GuidelinesScreen = () => (
  <ScrollView style={styles.screen}>
    <Text style={styles.screenTitle}>Recycling Guidelines</Text>

    <View style={[styles.card, styles.acceptedCard]}>
      <Text style={styles.guidelineTitle}>✓ Accepted Items</Text>
      <Text style={styles.guidelineItem}>• Aluminum & steel cans</Text>
      <Text style={styles.guidelineItem}>• Glass bottles & jars</Text>
      <Text style={styles.guidelineItem}>• Plastic bottles & containers (#1-7)</Text>
      <Text style={styles.guidelineItem}>• Paper & cardboard</Text>
      <Text style={styles.guidelineItem}>• Newspaper & magazines</Text>
    </View>

    <View style={[styles.card, styles.rejectedCard]}>
      <Text style={styles.guidelineTitleRed}>✗ Not Accepted</Text>
      <Text style={styles.guidelineItem}>• Plastic bags & film</Text>
      <Text style={styles.guidelineItem}>• Styrofoam</Text>
      <Text style={styles.guidelineItem}>• Food-contaminated items</Text>
      <Text style={styles.guidelineItem}>• Electronics</Text>
      <Text style={styles.guidelineItem}>• Hazardous materials</Text>
    </View>

    <View style={styles.card}>
      <Text style={styles.cardTitle}>Special Disposal Options</Text>
      {specialDisposalInfo.map((disposal, idx) => (
        <View key={idx} style={styles.disposalItem}>
          <Text style={styles.disposalItemTitle}>{disposal.item}</Text>
          <Text style={styles.disposalItemInfo}>{disposal.info}</Text>
        </View>
      ))}
    </View>
  </ScrollView>
);

// Tips Screen
const TipsScreen = () => (
  <ScrollView style={styles.screen}>
    <Text style={styles.screenTitle}>Recycling Tips</Text>
    <View style={styles.card}>
      {recyclingTips.map((tip, idx) => (
        <View key={idx} style={styles.tipItem}>
          <View style={styles.tipNumber}>
            <Text style={styles.tipNumberText}>{idx + 1}</Text>
          </View>
          <Text style={styles.tipText}>{tip}</Text>
        </View>
      ))}
    </View>
  </ScrollView>
);

// Impact Screen
const ImpactScreen = ({impact, weeklyItems, monthlyItems, recyclingLog, resetData }) => {
  return (
    <ScrollView style={styles.screen}>
      <View style={styles.impactHeader}>
        <TrendingUp color="#16a34a" size={24} />
        <Text style={styles.screenTitle}>Your Impact</Text>
      </View>

      <View style={styles.impactGrid}>
        <View style={[styles.impactCard, styles.impactCardGreen]}>
          <Recycle color="white" size={32} />
          <Text style={styles.impactNumber}>{impact.totalItems}</Text>
          <Text style={styles.impactLabel}>Items Recycled</Text>
        </View>

        <View style={[styles.impactCard, styles.impactCardBlue]}>
          <Leaf color="white" size={32} />
          <Text style={styles.impactNumber}>{impact.totalCO2}</Text>
          <Text style={styles.impactLabel}>kg CO₂ Saved</Text>
        </View>

        <View style={[styles.impactCard, styles.impactCardPurple]}>
          <Trash2 color="white" size={32} />
          <Text style={styles.impactNumber}>{impact.landfillSaved}</Text>
          <Text style={styles.impactLabel}>kg Diverted</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Calendar color="#16a34a" size={20} />
          <Text style={styles.cardTitle}>Recent Activity</Text>
        </View>
        <View style={styles.activityGrid}>
          <View style={styles.activityCard}>
            <Text style={styles.activityNumber}>{weeklyItems}</Text>
            <Text style={styles.activityLabel}>This Week</Text>
          </View>
          <View style={styles.activityCard}>
            <Text style={styles.activityNumber}>{monthlyItems}</Text>
            <Text style={styles.activityLabel}>This Month</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Items</Text>
        {recyclingLog.length === 0 ? (
          <Text style={styles.emptyText}>No items logged yet. Start recycling!</Text>
        ) : (
          recyclingLog.slice(-10).reverse().map((item) => (
            <View key={item.id} style={styles.logItem}>
              <View>
                <Text style={styles.logItemName}>{item.item}</Text>
                <Text style={styles.logItemDate}>
                  {new Date(item.date).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.logItemRight}>
                <Text style={styles.logItemCO2}>{item.co2Saved} kg CO₂</Text>
                <Text style={styles.logItemCategory}>{item.category}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {recyclingLog.length > 0 && (
        <TouchableOpacity style={styles.resetButton} onPress={resetData}>
          <Text style={styles.resetButtonText}>Reset All Data</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

// Add Item Modal
const AddItemModal = ({ showAddModal, setShowAddModal, selectedItem, logRecycledItem }) => (
  <Modal
    visible={showAddModal}
    transparent
    animationType="fade"
    onRequestClose={() => setShowAddModal(false)}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Log Recycled Item?</Text>
        {selectedItem && (
          <>
            <Text style={styles.modalText}>Item: {selectedItem.item}</Text>
            <Text style={styles.modalText}>Category: {selectedItem.category}</Text>
            <Text style={styles.modalImpact}>
              Impact: ~{selectedItem.co2Saved} kg CO₂ saved
            </Text>
          </>
        )}
        <View style={styles.modalButtons}>
          <TouchableOpacity
            style={styles.modalButtonCancel}
            onPress={() => setShowAddModal(false)}
          >
            <Text style={styles.modalButtonCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalButtonConfirm}
            onPress={logRecycledItem}
          >
            <Text style={styles.modalButtonConfirmText}>Log It!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// Bluetooth Connection Modal
const BluetoothModal = ({
  showBluetoothModal,
  setShowBluetoothModal,
  bluetoothDevices,
  isScanningBluetooth,
  scanForBluetoothDevices,
  connectToBluetoothDevice,
  bluetoothConnected,
  bluetoothDevice,
  disconnectBluetooth,
  setIsScanningBluetooth,
}) => {
  const handleClose = () => {
    // Stop scanning if active
    if (isScanningBluetooth) {
      bluetoothService.stopScan();
      if (setIsScanningBluetooth) {
        setIsScanningBluetooth(false);
      }
    }
    setShowBluetoothModal(false);
  };

  return (
    <Modal
      visible={showBluetoothModal}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <View 
          style={styles.modalContent}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bluetooth Connection</Text>
            <TouchableOpacity 
              onPress={handleClose}
              style={styles.modalCloseButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <X color="#6b7280" size={24} />
            </TouchableOpacity>
          </View>

        {bluetoothConnected ? (
          <View style={styles.bluetoothConnectedView}>
            <Bluetooth color="#16a34a" size={48} />
            <Text style={styles.bluetoothStatusText}>Connected</Text>
            <Text style={styles.bluetoothDeviceName}>
              {bluetoothDevice?.name || 'HM-10 Device'}
            </Text>
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={disconnectBluetooth}
            >
              <Text style={styles.disconnectButtonText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.modalText}>
              Scan for HM-10 Bluetooth devices
            </Text>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={scanForBluetoothDevices}
              disabled={isScanningBluetooth}
            >
              <Text style={styles.scanButtonText}>
                {isScanningBluetooth ? 'Scanning...' : 'Scan for Devices'}
              </Text>
            </TouchableOpacity>

            <ScrollView style={styles.deviceList}>
              {bluetoothDevices.length === 0 && !isScanningBluetooth && (
                <Text style={styles.noDevicesText}>
                  No devices found. Make sure your HM-10 is powered on and in range.
                </Text>
              )}
              {bluetoothDevices.map((device) => (
                <TouchableOpacity
                  key={device.id}
                  style={styles.deviceItem}
                  onPress={() => connectToBluetoothDevice(device.id)}
                >
                  <Bluetooth color="#16a34a" size={20} />
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>
                      {device.name || 'Unknown Device'}
                    </Text>
                    <Text style={styles.deviceId}>{device.id}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// Navigation
const Navigation = ({ currentScreen, setCurrentScreen }) => (
  <View style={styles.navigation}>
    <TouchableOpacity
      style={styles.navButton}
      onPress={() => setCurrentScreen('home')}
    >
      <Home color={currentScreen === 'home' ? '#16a34a' : '#6b7280'} size={24} />
      <Text style={[styles.navText, currentScreen === 'home' && styles.navTextActive]}>
        Home
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.navButton}
      onPress={() => setCurrentScreen('guidelines')}
    >
      <Info color={currentScreen === 'guidelines' ? '#16a34a' : '#6b7280'} size={24} />
      <Text style={[styles.navText, currentScreen === 'guidelines' && styles.navTextActive]}>
        Guidelines
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.navButton}
      onPress={() => setCurrentScreen('tips')}
    >
      <Leaf color={currentScreen === 'tips' ? '#16a34a' : '#6b7280'} size={24} />
      <Text style={[styles.navText, currentScreen === 'tips' && styles.navTextActive]}>
        Tips
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.navButton}
      onPress={() => setCurrentScreen('impact')}
    >
      <TrendingUp color={currentScreen === 'impact' ? '#16a34a' : '#6b7280'} size={24} />
      <Text style={[styles.navText, currentScreen === 'impact' && styles.navTextActive]}>
        Impact
      </Text>
    </TouchableOpacity>
  </View>
);

// -------------------------------------------
// --- MAIN APP COMPONENT ---
// -------------------------------------------

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [recyclingLog, setRecyclingLog] = useState<RecyclingLogEntry[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Bluetooth state
  const [bluetoothConnected, setBluetoothConnected] = useState(false);
  const [bluetoothDevice, setBluetoothDevice] = useState<BluetoothDevice | null>(null);
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothDevice[]>([]);
  const [showBluetoothModal, setShowBluetoothModal] = useState(false);
  const [isScanningBluetooth, setIsScanningBluetooth] = useState(false);

  // Location state
  const [userLocation, setUserLocation] = useState<{ city: string; province: string } | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationCity, setLocationCity] = useState('');
  const [locationProvince, setLocationProvince] = useState('');

  useEffect(() => {
    loadRecyclingLog();
    loadUserLocation();
    // Initialize Bluetooth with error handling to prevent crashes
    initializeBluetooth().catch((error) => {
      console.warn('Bluetooth initialization failed, continuing without Bluetooth:', error);
    });
    
    return () => {
      // Cleanup on unmount
      try {
        bluetoothService.destroy();
      } catch (error) {
        console.warn('Error during Bluetooth cleanup:', error);
      }
    };
  }, []);

  // Check if location is set, if not show modal on first launch
  useEffect(() => {
    if (userLocation === null) {
      // Small delay to let app load first
      setTimeout(() => {
        setShowLocationModal(true);
      }, 500);
    }
  }, [userLocation]);

  const loadRecyclingLog = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem('recycling-log');
      if (jsonValue != null) {
        setRecyclingLog(JSON.parse(jsonValue) as RecyclingLogEntry[]);
      }
    } catch (error) {
      console.log('No existing log found, starting fresh');
      // Ensure we have an empty array if loading fails
      setRecyclingLog([]);
    }
  };

  const loadUserLocation = async () => {
    try {
      const locationJson = await AsyncStorage.getItem('user-location');
      if (locationJson != null) {
        const location = JSON.parse(locationJson);
        setUserLocation(location);
        setLocationCity(location.city);
        setLocationProvince(location.province);
      }
    } catch (error) {
      console.log('No location found');
    }
  };

  const saveUserLocation = async (city: string, province: string) => {
    try {
      const location = { city, province };
      await AsyncStorage.setItem('user-location', JSON.stringify(location));
      setUserLocation(location);
      setShowLocationModal(false);
    } catch (error) {
      console.error('Failed to save location:', error);
    }
  };

  const saveRecyclingLog = async (newLog: RecyclingLogEntry[]) => {
    try {
      const jsonValue = JSON.stringify(newLog);
      await AsyncStorage.setItem('recycling-log', jsonValue);
      setRecyclingLog(newLog);
    } catch (error) {
      console.error('Failed to save log:', error);
    }
  };

  // --- CAMERA LOGIC (FIXED) ---
  const startCamera = async () => {
    // Check if permission is already granted
    if (permission && permission.granted) {
      setShowCamera(true);
      return;
    }

    // If not granted, or status is unknown, request it
    const { status } = await requestPermission();
    if (status === 'granted') {
      setShowCamera(true);
    } else {
      Alert.alert('Permission Required', 'Please allow camera access to scan items');
    }
  };

  const stopCamera = () => {
    setShowCamera(false);
    setIsScanning(false);
  };

  // AI Image Recognition using OpenAI Vision API
  const identifyItemWithAI = async (imageBase64: string): Promise<string | null> => {
    try {
      // Get API key from environment or use a placeholder
      // In production, store this securely (e.g., in Expo Constants or a backend)
      const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
      
      if (!apiKey) {
        console.warn('OpenAI API key not found. Using fallback identification.');
        return null;
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Identify this item in a single word or short phrase (2-3 words max). Focus on the material type and item category. Examples: "aluminum can", "plastic bottle", "cardboard box", "glass bottle", "pizza box", "plastic bag", "newspaper", "magazine". Return ONLY the item name, nothing else.`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 20,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API error:', errorData);
        return null;
      }

      const data = await response.json();
      const identifiedItem = data.choices[0]?.message?.content?.trim().toLowerCase();
      
      return identifiedItem || null;
    } catch (error) {
      console.error('Error calling AI service:', error);
      return null;
    }
  };

  // Fallback: Simple keyword matching for common items
  const identifyItemFallback = (description: string): string | null => {
    const lowerDesc = description.toLowerCase();
    const keywords = [
      { key: 'aluminum can', matches: ['can', 'aluminum', 'soda can', 'beer can'] },
      { key: 'plastic bottle', matches: ['bottle', 'plastic bottle', 'water bottle', 'soda bottle'] },
      { key: 'glass bottle', matches: ['glass bottle', 'wine bottle', 'beer bottle'] },
      { key: 'cardboard', matches: ['cardboard', 'box', 'carton'] },
      { key: 'paper', matches: ['paper', 'newspaper', 'magazine'] },
      { key: 'pizza box', matches: ['pizza box', 'pizza'] },
      { key: 'plastic bag', matches: ['bag', 'plastic bag'] },
    ];

    for (const { key, matches } of keywords) {
      if (matches.some(match => lowerDesc.includes(match))) {
        return key;
      }
    }
    return null;
  };

  const captureAndAnalyze = async () => {
    if (!cameraRef.current) return;

    setIsScanning(true);

    try {
      // Take photo with base64 encoding for AI analysis
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true, // Enable base64 for AI processing
      });

      if (!photo?.base64) {
        throw new Error('Failed to capture image');
      }

      // Use AI to identify the item
      let identifiedItem: string | null = null;
      
      try {
        identifiedItem = await identifyItemWithAI(photo.base64);
      } catch (aiError) {
        console.error('AI identification failed:', aiError);
      }

      // If AI didn't work, try fallback or show error
      if (!identifiedItem) {
        // Fallback: Try to extract from photo metadata or use a simple heuristic
        // For now, we'll show a message asking user to search manually
        Alert.alert(
          'Unable to Identify',
          'Could not automatically identify this item. Please try searching manually or take another photo with better lighting.',
          [
            {
              text: 'OK',
              onPress: () => {
                setIsScanning(false);
                stopCamera();
              },
            },
          ]
        );
        return;
      }

      // Clean up the identified item name
      identifiedItem = identifiedItem.replace(/[^\w\s]/g, '').trim();
      
      // Try to find a match in our database
      let matchedItem = identifiedItem;
      let result = recyclingDatabase[identifiedItem];

      // If exact match not found, try partial matches
      if (!result) {
        const databaseKeys = Object.keys(recyclingDatabase);
        const partialMatch = databaseKeys.find(key => 
          identifiedItem.includes(key) || key.includes(identifiedItem)
        );
        
        if (partialMatch) {
          matchedItem = partialMatch;
          result = recyclingDatabase[partialMatch];
        }
      }

      // If still no match, try fallback identification
      if (!result) {
        const fallbackMatch = identifyItemFallback(identifiedItem);
        if (fallbackMatch && recyclingDatabase[fallbackMatch]) {
          matchedItem = fallbackMatch;
          result = recyclingDatabase[fallbackMatch];
        }
      }

      // Update UI with results
      if (result) {
        setSearchResult({ item: matchedItem, ...result });
        setSearchQuery(matchedItem);

        // Send hex code to Arduino for both recyclable and non-recyclable items
        if (bluetoothConnected) {
          await sendToArduino(result.recyclable);
        }

        if (result.recyclable) {
          setSelectedItem({ item: matchedItem, ...result });
          setShowAddModal(true);
        } else {
          // Show result even if not recyclable
          setSearchResult({ item: matchedItem, ...result });
        }
      } else {
        // Item not in database - default to non-recyclable
        const defaultResult = {
          item: matchedItem,
          recyclable: false,
          category: 'Waste',
          co2Saved: 0,
          tips: 'This item cannot be recycled in your area. Please dispose of it in regular waste.'
        };
        
        setSearchResult(defaultResult);
        setSearchQuery(matchedItem);
        
        // Send non-recyclable hex code to Arduino
        if (bluetoothConnected) {
          await sendToArduino(false); // Send AA115510
        }
        
        Alert.alert(
          'Cannot Be Recycled',
          `"${matchedItem}" cannot be recycled in ${userLocation ? `${userLocation.city}, ${userLocation.province}` : 'your area'}. Please dispose of it in regular waste.`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Result already set above
              },
            },
          ]
        );
      }

      setIsScanning(false);
      stopCamera();
      setCurrentScreen('home');
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert(
        'Error',
        'Failed to capture or analyze image. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => {
              setIsScanning(false);
            },
          },
        ]
      );
    }
  };

  // --- SEARCH & LOGIC ---
  const handleSearch = async () => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return; // Don't search empty strings

    const result = recyclingDatabase[query];

    if (result) {
      setSearchResult({ item: searchQuery, ...result });
      
      // Send hex code to Arduino for both recyclable and non-recyclable items
      if (bluetoothConnected) {
        await sendToArduino(result.recyclable);
      }
      
      if (result.recyclable) {
        setSelectedItem({ item: searchQuery, ...result });
        setShowAddModal(true);
      }
    } else {
      // Item not found - default to non-recyclable
      const defaultResult = {
        item: searchQuery,
        recyclable: false,
        category: 'Waste',
        co2Saved: 0,
        tips: 'This item cannot be recycled in your area. Please dispose of it in regular waste.'
      };
      
      setSearchResult(defaultResult);
      
      // Send non-recyclable hex code to Arduino
      if (bluetoothConnected) {
        await sendToArduino(false); // Send AA115510
      }
      
      Alert.alert(
        'Cannot Be Recycled',
        `"${searchQuery}" cannot be recycled in ${userLocation ? `${userLocation.city}, ${userLocation.province}` : 'your area'}. Please dispose of it in regular waste.`,
        [{ text: 'OK' }]
      );
    }
  };
  // Bluetooth functions
  const initializeBluetooth = async () => {
    try {
      // Request Bluetooth permissions on Android
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Bluetooth Permission',
            message: 'This app needs location permission to scan for Bluetooth devices',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.warn('Bluetooth permission denied');
          return;
        }
      }

      // Try to initialize Bluetooth, but don't crash if it fails
      try {
        const initialized = await bluetoothService.initialize();
        if (initialized) {
          // Check if already connected
          if (bluetoothService.isConnected()) {
            setBluetoothConnected(true);
            setBluetoothDevice(bluetoothService.getConnectedDevice());
          }
        }
      } catch (bluetoothError: any) {
        // If Bluetooth fails (e.g., not available, permissions denied), just log and continue
        console.warn('Bluetooth initialization failed:', bluetoothError?.message || bluetoothError);
        // Don't throw - allow app to continue without Bluetooth
      }
    } catch (error) {
      // Catch any other errors and log them without crashing
      console.error('Bluetooth setup error:', error);
    }
  };

  const scanForBluetoothDevices = async () => {
    setIsScanningBluetooth(true);
    setBluetoothDevices([]);

    try {
      // Check if Bluetooth is initialized
      const initialized = await bluetoothService.initialize();
      if (!initialized) {
        Alert.alert(
          'Bluetooth Not Ready',
          'Please ensure Bluetooth is enabled on your device and try again.',
          [{ text: 'OK' }]
        );
        setIsScanningBluetooth(false);
        return;
      }

      const foundDeviceIds = new Set<string>();
      
      bluetoothService.scanForDevices((device) => {
        setBluetoothDevices((prev) => {
          // Avoid duplicates - only add if device not already in list
          if (!prev.find(d => d.id === device.id)) {
            foundDeviceIds.add(device.id);
            return [...prev, device];
          }
          return prev;
        });
      });

      // Stop scanning after 10 seconds
      setTimeout(() => {
        bluetoothService.stopScan();
        setIsScanningBluetooth(false);
        if (foundDeviceIds.size === 0) {
          Alert.alert(
            'No Devices Found',
            'No HM-10 devices were found. Make sure your device is powered on, in range, and not connected to another device.',
            [{ text: 'OK' }]
          );
        }
      }, 10000);
    } catch (error: any) {
      console.error('Scan error:', error);
      setIsScanningBluetooth(false);
      bluetoothService.stopScan();
      
      let errorMessage = 'Failed to scan for devices. ';
      if (error.message?.includes('not ready') || error.message?.includes('state')) {
        errorMessage += 'Please ensure Bluetooth is enabled and try again.';
      } else if (error.message?.includes('Unknown')) {
        errorMessage += 'Bluetooth is initializing. Please wait a moment and try again.';
      } else {
        errorMessage += error.message || 'Please check your Bluetooth settings.';
      }
      
      Alert.alert('Scan Error', errorMessage, [{ text: 'OK' }]);
    }
  };

  const connectToBluetoothDevice = async (deviceId: string) => {
    try {
      // Check Bluetooth state before connecting
      const initialized = await bluetoothService.initialize();
      if (!initialized) {
        Alert.alert(
          'Bluetooth Not Ready',
          'Please ensure Bluetooth is enabled on your device and try again.',
          [{ text: 'OK' }]
        );
        return;
      }

      Alert.alert('Connecting', 'Connecting to HM-10 device...');
      const connected = await bluetoothService.connectToDevice(deviceId);
      
      if (connected) {
        setBluetoothConnected(true);
        setBluetoothDevice(bluetoothService.getConnectedDevice());
        setShowBluetoothModal(false);
        Alert.alert('Success', 'Successfully connected to HM-10 device!');
      } else {
        Alert.alert(
          'Connection Failed',
          'Failed to connect to the device. Make sure:\n• The device is powered on\n• The device is in range\n• The device is not connected to another device',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Connection error:', error);
      
      let errorMessage = 'Failed to connect to device. ';
      if (error.message?.includes('not ready') || error.message?.includes('state')) {
        errorMessage = 'Bluetooth is not ready. Please ensure Bluetooth is enabled and try again.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Connection timed out. Make sure the device is powered on and in range.';
      } else if (error.message?.includes('not found')) {
        errorMessage = 'Device not found. Please scan again.';
      } else if (error.message?.includes('Unknown')) {
        errorMessage = 'Bluetooth is initializing. Please wait a moment and try again.';
      } else {
        errorMessage += error.message || 'Please check your Bluetooth settings.';
      }
      
      Alert.alert('Connection Error', errorMessage, [{ text: 'OK' }]);
    }
  };

  const disconnectBluetooth = async () => {
    await bluetoothService.disconnect();
    setBluetoothConnected(false);
    setBluetoothDevice(null);
    Alert.alert('Disconnected', 'Bluetooth device disconnected.');
  };

  const sendToArduino = async (isRecyclable: boolean) => {
    if (!bluetoothService.isConnected()) {
      console.warn('⚠️  Bluetooth not connected, skipping Arduino transmission');
      return false;
    }

    try {
      // Send hex code based on recyclability
      // AAEE55ED = recyclable (opens recyclable bin)
      // AA115510 = not recyclable (opens non-recyclable bin)
      const hexCode = isRecyclable ? 'AAEE55ED' : 'AA115510';
      const status = isRecyclable ? 'RECYCLABLE' : 'NOT RECYCLABLE';
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📤 SENDING HEX CODE TO ARDUINO');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Hex Code: ${hexCode}`);
      console.log(`Status: ${status}`);
      console.log(`Item Type: ${isRecyclable ? 'Recyclable → Opens Recyclable Bin' : 'Non-Recyclable → Opens Waste Bin'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      const success = await bluetoothService.sendHexCode(hexCode);
      
      if (success) {
        console.log(`✅ Successfully sent hex code ${hexCode} to Arduino (${status})`);
        return true;
      } else {
        console.error(`❌ Failed to send hex code ${hexCode} to Arduino`);
        return false;
      }
    } catch (error) {
      console.error('❌ Error sending to Arduino:', error);
      return false;
    }
  };

  const logRecycledItem = async () => {
    if (selectedItem) {
      const newEntry = {
        id: Date.now(),
        item: selectedItem.item,
        category: selectedItem.category,
        co2Saved: selectedItem.co2Saved,
        date: new Date().toISOString()
      };

      const updatedLog = [...recyclingLog, newEntry];
      saveRecyclingLog(updatedLog);
      
      // Note: Hex code was already sent when item was detected (in captureAndAnalyze or handleSearch)
      // This is just for logging the item to the app's history

      setShowAddModal(false);
      setSelectedItem(null);
      setCurrentScreen('impact');
    }
  };

  // --- DATA CALCULATIONS ---
  const calculateTotalImpact = () => {
    const totalItems = recyclingLog.length;
    const totalCO2 = recyclingLog.reduce((sum, item) => sum + item.co2Saved, 0);
    const landfillSaved = totalItems * 0.5;

    return {
      totalItems,
      totalCO2: totalCO2.toFixed(2),
      landfillSaved: landfillSaved.toFixed(1)
    };
  };

  const getWeeklyData = () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return recyclingLog.filter(item => new Date(item.date) >= weekAgo).length;
  };

  const getMonthlyData = () => {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return recyclingLog.filter(item => new Date(item.date) >= monthAgo).length;
  };

  const resetData = async () => {
    Alert.alert(
      'Reset Data',
      'Are you sure you want to delete all recycling data?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('recycling-log');
              setRecyclingLog([]);
            } catch (error) {
              console.error('Failed to reset data:', error);
            }
          }
        }
      ]
    );
  };

  // --- RENDER ---

  // Calculate data to pass to ImpactScreen
  const impact = calculateTotalImpact();
  const weeklyItems = getWeeklyData();
  const monthlyItems = getMonthlyData();

  return (
    <SafeAreaView style={styles.container}>
      {currentScreen === 'home' && <HomeScreen
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleSearch={handleSearch}
        searchResult={searchResult}
        startCamera={startCamera}
        setCurrentScreen={setCurrentScreen}
        bluetoothConnected={bluetoothConnected}
        setShowBluetoothModal={setShowBluetoothModal}
        userLocation={userLocation}
        setShowLocationModal={setShowLocationModal}
      />}
      {currentScreen === 'guidelines' && <GuidelinesScreen />}
      {currentScreen === 'tips' && <TipsScreen />}
      {currentScreen === 'impact' && <ImpactScreen
        impact={impact}
        weeklyItems={weeklyItems}
        monthlyItems={monthlyItems}
        recyclingLog={recyclingLog}
        resetData={resetData}
      />}

      <LocationModal
        showLocationModal={showLocationModal}
        setShowLocationModal={setShowLocationModal}
        locationCity={locationCity}
        setLocationCity={setLocationCity}
        locationProvince={locationProvince}
        setLocationProvince={setLocationProvince}
        saveUserLocation={saveUserLocation}
        userLocation={userLocation}
      />
      <AddItemModal
        showAddModal={showAddModal}
        setShowAddModal={setShowAddModal}
        selectedItem={selectedItem}
        logRecycledItem={logRecycledItem}
      />
      <BluetoothModal
        showBluetoothModal={showBluetoothModal}
        setShowBluetoothModal={setShowBluetoothModal}
        bluetoothDevices={bluetoothDevices}
        isScanningBluetooth={isScanningBluetooth}
        scanForBluetoothDevices={scanForBluetoothDevices}
        connectToBluetoothDevice={connectToBluetoothDevice}
        bluetoothConnected={bluetoothConnected}
        bluetoothDevice={bluetoothDevice}
        disconnectBluetooth={disconnectBluetooth}
        setIsScanningBluetooth={setIsScanningBluetooth}
      />
      <CameraScreen
        showCamera={showCamera}
        stopCamera={stopCamera}
        permission={permission}
        cameraRef={cameraRef}
        isScanning={isScanning}
        captureAndAnalyze={captureAndAnalyze}
      />
      <Navigation
        currentScreen={currentScreen}
        setCurrentScreen={setCurrentScreen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  screen: {
    flex: 1,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 24,
  },
  cameraButton: {
    backgroundColor: '#16a34a',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cameraButtonTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 12,
  },
  cameraButtonSubtitle: {
    fontSize: 12,
    color: '#dcfce7',
    marginTop: 4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#d1d5db',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 12,
    color: '#6b7280',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1f2937',
  },
  searchButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  resultCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  resultCardGreen: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  resultCardRed: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  resultCardGray: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  resultItemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  resultRecyclable: {
    fontSize: 14,
    fontWeight: '500',
    color: '#15803d',
    marginBottom: 8,
  },
  resultNotRecyclable: {
    fontSize: 14,
    fontWeight: '500',
    color: '#dc2626',
    marginBottom: 8,
  },
  resultDetail: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 4,
  },
  resultImpact: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '500',
  },
  buttonGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  gridButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  gridButtonBlue: {
    backgroundColor: '#3b82f6',
  },
  gridButtonPurple: {
    backgroundColor: '#a855f7',
  },
  gridButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  acceptedCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  rejectedCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  guidelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#15803d',
    marginBottom: 8,
  },
  guidelineTitleRed: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 8,
  },
  guidelineItem: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 4,
  },
  disposalItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  disposalItemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  disposalItemInfo: {
    fontSize: 12,
    color: '#6b7280',
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'center',
  },
  tipNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tipNumberText: {
    color: '#16a34a',
    fontWeight: '600',
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: '#374151',
    lineHeight: 18,
  },
  impactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  impactGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  impactCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  impactCardGreen: {
    backgroundColor: '#16a34a',
  },
  impactCardBlue: {
    backgroundColor: '#3b82f6',
  },
  impactCardPurple: {
    backgroundColor: '#a855f7',
  },
  impactNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 8,
  },
  impactLabel: {
    fontSize: 12,
    color: '#e5e7eb',
    marginTop: 4,
  },
  activityGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  activityCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activityNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  activityLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 16,
  },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  logItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    textTransform: 'capitalize',
  },
  logItemDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  logItemRight: {
    alignItems: 'flex-end',
  },
  logItemCO2: {
    fontSize: 14,
    fontWeight: '500',
    color: '#16a34a',
  },
  logItemCategory: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  resetButton: {
    marginTop: 24,
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#dc2626',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  modalImpact: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
    marginTop: 12,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  modalButtonCancel: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  modalButtonCancelText: {
    color: '#374151',
    fontWeight: '600',
  },
  modalButtonConfirm: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#16a34a',
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    color: 'white',
    fontWeight: '600',
  },
  navigation: {
    flexDirection: 'row',
    height: 70,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: 'white',
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  navText: {
    fontSize: 12,
    color: '#6b7280',
  },
  navTextActive: {
    color: '#16a34a',
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
    backgroundColor: 'transparent',
  },
  closeButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginTop: 32,
  },
  scanningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  cameraBottom: {
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: 'white',
    borderRadius: 12,
    marginBottom: 24,
    opacity: 0.7,
  },
  cameraInstructions: {
    color: 'white',
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  captureButton: {
    backgroundColor: 'white',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 32,
  },
  captureButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  captureButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  // Bluetooth styles
  bluetoothButton: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 16,
    marginHorizontal: 20,
    borderWidth: 2,
    borderColor: '#16a34a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  bluetoothButtonConnected: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  bluetoothButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16a34a',
    marginLeft: 8,
  },
  bluetoothButtonTextConnected: {
    color: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalCloseButton: {
    padding: 4,
    zIndex: 10,
  },
  bluetoothConnectedView: {
    alignItems: 'center',
    padding: 24,
  },
  bluetoothStatusText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#16a34a',
    marginTop: 16,
  },
  bluetoothDeviceName: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  disconnectButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  disconnectButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  scanButton: {
    backgroundColor: '#16a34a',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  scanButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  deviceList: {
    maxHeight: 300,
    marginTop: 16,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginBottom: 8,
  },
  deviceInfo: {
    marginLeft: 12,
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  deviceId: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  noDevicesText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
    padding: 24,
  },
  // Location styles
  locationButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  locationButtonText: {
    fontSize: 14,
    color: '#16a34a',
    fontWeight: '500',
  },
  locationInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
});