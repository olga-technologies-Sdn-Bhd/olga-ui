import { Linking, PermissionsAndroid, Platform } from 'react-native';
import Contacts from 'react-native-contacts';
import type { RawContact } from './contacts';

// The only place that talks to the phone's contacts. Asked when the member
// chooses to invite, never at start-up.
// Android asks through React Native: the library's request never settles
// after the system dialog the first time (new architecture).
export async function askForContactsAccess(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const answer = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
    return answer === PermissionsAndroid.RESULTS.GRANTED;
  }
  const answer = await Contacts.requestPermission();
  return answer === 'authorized' || answer === 'limited';
}

// Every contact on the phone (all accounts); the screen picks who can be invited.
export async function readDeviceContacts(): Promise<RawContact[]> {
  return Contacts.getAllWithoutPhotos();
}

export const openPhoneSettings = () => Linking.openSettings();
