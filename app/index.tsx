import React, { useState } from 'react';
import {
  Alert,
  Button,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Location from 'expo-location';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { supabase } from '../utils/supabase';

const { height } = Dimensions.get('window');

type Coordinates = {
  latitude: number;
  longitude: number;
};

export default function Index() {
  const [image, setImage] = useState<string | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [markerPos, setMarkerPos] = useState<Coordinates | null>(null);

  const openCamera = async () => {
    const permission = await Camera.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission is required!');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const openGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Gallery permission is required!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const saveImage = async () => {
    if (!image) {
      Alert.alert('No image to save!');
      return;
    }
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Media library permission is required!');
      return;
    }
    const filename = `photo-${Date.now()}.jpg`;
    const dest = FileSystem.documentDirectory + filename;
    await FileSystem.copyAsync({ from: image, to: dest });
    await MediaLibrary.saveToLibraryAsync(dest);
    Alert.alert('Success', 'Image saved to gallery!');
  };

  const uploadToSupabase = async () => {
    if (!image) {
      Alert.alert('No image!', 'Ambil foto dulu sebelum upload.');
      return;
    }
    if (!markerPos && !location) {
      Alert.alert('No location!', 'Ambil lokasi dulu sebelum upload.');
      return;
    }

    try {
      const lat = markerPos?.latitude ?? location!.latitude;
      const lng = markerPos?.longitude ?? location!.longitude;
      const filename = `photo-${Date.now()}.jpeg`;

      const fileBase64 = await FileSystem.readAsStringAsync(image, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const fileData = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));

      const { error: storageError } = await supabase.storage
        .from('images')
        .upload(`camera/${filename}`, fileData, {
          contentType: 'image/jpeg',
          upsert: false,
        });
      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(`camera/${filename}`);
      const imageUrl = urlData.publicUrl;

      const { error: dbError } = await supabase.from('photo').insert([
        {
          latitude: String(lat),
          longitude: String(lng),
          image_url: imageUrl,
        },
      ]);
      if (dbError) throw dbError;

      Alert.alert('Success', 'Foto & lokasi berhasil disimpan ke Supabase!');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Gagal upload ke Supabase.');
    }
  };

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied! Please allow location access.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    const coords: Coordinates = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
    setLocation(coords);
    setMarkerPos(coords);
  };

  const region = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : undefined;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Week 9 – Camera & Storage</Text>
      <View style={styles.buttonRow}>
        <View style={styles.btn}><Button title="OPEN CAMERA" onPress={openCamera} /></View>
        <View style={styles.btn}><Button title="OPEN GALLERY" onPress={openGallery} /></View>
      </View>

      {image && (
        <>
          <Image source={{ uri: image }} style={styles.image} />
          <View style={styles.btn}>
            <Button title="SAVE IMAGE" onPress={saveImage} color="#2ecc71" />
          </View>
        </>
      )}

      <Text style={styles.label}>Week 10 – Maps & Geolocation</Text>
      <View style={styles.btn}>
        <Button title="GET GEO LOCATION" onPress={getLocation} color="#3498db" />
      </View>

      {location && (
        <>
          <MapView
            style={styles.map}
            initialRegion={region}
            onPress={(e) => setMarkerPos(e.nativeEvent.coordinate)}
          >
            <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {markerPos && (
              <Marker
                coordinate={markerPos}
                title="My Location"
                draggable
                onDragEnd={(e) => setMarkerPos(e.nativeEvent.coordinate)}
              />
            )}
          </MapView>

          <View style={styles.infoBox}>
            <Text style={styles.coordText}>
              Latitude: {markerPos?.latitude.toFixed(6) ?? location.latitude.toFixed(6)}
            </Text>
            <Text style={styles.coordText}>
              Longitude: {markerPos?.longitude.toFixed(6) ?? location.longitude.toFixed(6)}
            </Text>
            <View style={styles.btn}>
              <Button title="Refresh Location" onPress={getLocation} />
            </View>
          </View>
        </>
      )}

      <Text style={styles.label}>Week 11 – Supabase</Text>
      <View style={styles.btn}>
        <Button
          title="UPLOAD PHOTO TO SUPABASE"
          color="#9b59b6"
          onPress={uploadToSupabase}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 16,
    paddingBottom: 40,
    backgroundColor: '#f5f5f5',
  },
  label: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    marginVertical: 4,
    width: 200,
  },
  image: {
    width: 280,
    height: 200,
    marginVertical: 12,
    borderRadius: 8,
  },
  map: {
    height: height * 0.4,
    width: '100%',
    marginTop: 8,
    borderRadius: 8,
  },
  infoBox: {
    width: '100%',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  coordText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#2c3e50',
  },
});
