import type { NavigatorScreenParams } from '@react-navigation/native';
import type { CommitWhen } from '../api/types';


export type AuthStackParamList = {
  SignUp: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  Profile: undefined;
  ProfileSetup: undefined;
  DeleteAccount: undefined;
  HowYouAppear: undefined;
  BlockedMembers: undefined;
  // The Olga agent (a preview); prompt: sent as the first message.
  OlgaAgent: { prompt?: string } | undefined;
};

export type GoLiveStackParamList = {
  GoLive: undefined;
  Filters: undefined;
  LiveMatches: undefined;
  EmptyRoom: undefined;
  Commit: { memberId: string };
  // Nearby: Go Live without an event (src/context/NearbyContext.tsx).
  NearbyPeople: undefined;
  NearbyCommit: { memberId: string };
  NearbyRequest: { requestId: string };
};

export type EventsStackParamList = {
  Events: undefined;
  // Olga.Core only exposes GET /v1/events (list) — no single-event detail
  // endpoint — so we carry the already-fetched event through navigation
  // instead of re-fetching by id.
  // Only the ID: screens read the latest event from EventsContext, since
  // admins can edit or cancel events at any time.
  EventDetail: { eventId: string };
  WhosGoing: { eventId: string };
};

// The Chat tab: two tabs, Commits (for you, sent, meetings) and Chats
// (conversations with connected members, online or over Bluetooth).
export type ChatTabKey = 'commits' | 'chats';
export type ChatStackParamList = {
  ChatHome: { tab?: ChatTabKey } | undefined;
  // conversationId once Ol-ga has it; memberId alone for a connection made
  // nearby that hasn't synced yet (Bluetooth only).
  Conversation: { conversationId?: string; memberId?: string };
  // picker: who chooses the spot when the plan is "Their choice" (the
  // receiver); unknown for meetings opened from the list.
  Meetup: { memberId?: string; name?: string; headline?: string; where: string; when: CommitWhen; eventName?: string; picker?: 'you' | 'them' };
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  GoLiveTab: NavigatorScreenParams<GoLiveStackParamList> | undefined;
  EventsTab: NavigatorScreenParams<EventsStackParamList> | undefined;
  ChatTab: NavigatorScreenParams<ChatStackParamList> | undefined;
};
