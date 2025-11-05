import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView } from 'expo-camera'; // <-- Corrected import
import {
  Calendar,
  Camera as CameraIcon,
  Home,
  Info,
  Leaf,
  Recycle,
  ScanLine,
  Search,
  Trash2,
  TrendingUp,
  X
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// Mock data for Golden, CO recycling guidelines
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

export default function EcoVividApp() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [recyclingLog, setRecyclingLog] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    loadRecyclingLog();
  }, []);

  const loadRecyclingLog = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem('recycling-log');
      if (jsonValue != null) {
        setRecyclingLog(JSON.parse(jsonValue));
      }
    } catch (error) {
      console.log('No existing log found, starting fresh');
    }
  };

  const saveRecyclingLog = async (newLog) => {
    try {
      const jsonValue = JSON.stringify(newLog);
      await AsyncStorage.setItem('recycling-log', jsonValue);
      setRecyclingLog(newLog);
    } catch (error) {
      console.error('Failed to save log:', error);
    }
  };

  const startCamera = async () => {
    // <-- Corrected permission request
    const { status } = await CameraView.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
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

  const captureAndAnalyze = async () => {
    setIsScanning(true);

    // Simulate AI recognition
    setTimeout(() => {
      const items = Object.keys(recyclingDatabase);
      const randomItem = items[Math.floor(Math.random() * items.length)];
      const result = recyclingDatabase[randomItem];
      
      setSearchResult({ item: randomItem, ...result });
      setSearchQuery(randomItem);
      
      if (result.recyclable) {
        setSelectedItem({ item: randomItem, ...result });
        setShowAddModal(true);
      }
      
      setIsScanning(false);
      stopCamera();
      setCurrentScreen('home');
    }, 2000);
  };

  const handleSearch = () => {
    const query = searchQuery.toLowerCase().trim();
    const result = recyclingDatabase[query];
    
    if (result) {
      setSearchResult({ item: searchQuery, ...result });
      if (result.recyclable) {
        setSelectedItem({ item: searchQuery, ...result });
        setShowAddModal(true);
      }
    } else {
      setSearchResult({ item: searchQuery, recyclable: null });
    }
  };

  const logRecycledItem = () => {
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
      setShowAddModal(false);
      setSelectedItem(null);
      setCurrentScreen('impact');
    }
  };

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

  // Camera Screen
  const CameraScreen = () => (
    <Modal visible={showCamera} animationType="slide">
      <View style={styles.cameraContainer}>
        {hasPermission && (
          <CameraView 
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
                <ScanLine color="white" size={48} style={styles.scanIcon} />
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

  // Home Screen
  const HomeScreen = () => (
    <ScrollView style={styles.screen}>
      <View style={styles.header}>
        <Recycle color="#16a34a" size={64} />
        <Text style={styles.title}>EcoVivid</Text>
        <Text style={styles.subtitle}>Your guide to recycling in Golden, Colorado</Text>
      </View>

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
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            placeholder="e.g., aluminum can, pizza box"
            placeholderTextColor="#9ca3af"
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
  const ImpactScreen = () => {
    const impact = calculateTotalImpact();
    const weeklyItems = getWeeklyData();
    const monthlyItems = getMonthlyData();

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
  const AddItemModal = () => (
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

  // Navigation
  const Navigation = () => (
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

  return (
    <SafeAreaView style={styles.container}>
      {currentScreen === 'home' && <HomeScreen />}
      {currentScreen === 'guidelines' && <GuidelinesScreen />}
      {currentScreen === 'tips' && <TipsScreen />}
      {currentScreen === 'impact' && <ImpactScreen />}
      <AddItemModal />
      <CameraScreen />
      <Navigation />
    </SafeAreaView>
  );
}

// vvv STYLESHEET WAS INCOMPLETE - ALL STYLES BELOW THIS LINE WERE ADDED vvv
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
    marginTop: 32, // for safe area
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
  scanIcon: {
    marginBottom: 16,
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
});