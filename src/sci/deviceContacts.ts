import { Linking } from 'react-native';
import Contacts from 'react-native-contacts';
import { DeviceContact, deviceContactsFrom } from './contacts';

// The only place that talks to the phone's contacts. Asked when the member
// chooses to invite, never at start-up.
export async function askForContactsAccess(): Promise<boolean> {
  const answer = await Contacts.requestPermission();
  return answer === 'authorized' || answer === 'limited';
}

export async function readDeviceContacts(): Promise<DeviceContact[]> {
  return deviceContactsFrom(await Contacts.getAllWithoutPhotos());
}

export const openPhoneSettings = () => Linking.openSettings();
