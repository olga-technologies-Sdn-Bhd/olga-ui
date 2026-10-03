import type { NavigatorScreenParams } from '@react-navigation/native';
import type { CommitWhen } from '../api/types';


export type AuthStackParamList = {
  SignUp: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  Profile: undefined;
};

export type GoLiveStackParamList = {
  GoLive: undefined;
  Filters: undefined;
  LiveMatches: undefined;
  EmptyRoom: undefined;
  GoLiveColour: undefined;
  Commit: { memberId: string };
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

// The Chat tab (board 10): Commits for you, sent Commits and meetings. The
// chat itself isn't Phase 1.
export type CommitsStackParamList = {
  Commits: undefined;
  // picker: who chooses the spot when the plan is "Their choice" (the
  // receiver); unknown for meetings opened from the list.
  Meetup: { name?: string; headline?: string; where: string; when: CommitWhen; eventName?: string; picker?: 'you' | 'them' };
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  GoLiveTab: NavigatorScreenParams<GoLiveStackParamList> | undefined;
  EventsTab: NavigatorScreenParams<EventsStackParamList> | undefined;
  ChatTab: NavigatorScreenParams<CommitsStackParamList> | undefined;
};
