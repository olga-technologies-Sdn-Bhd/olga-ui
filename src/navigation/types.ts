
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

export type MainTabParamList = {
  HomeTab: undefined;
  GoLiveTab: undefined;
  EventsTab: undefined;
  ChatTab: undefined;
};
