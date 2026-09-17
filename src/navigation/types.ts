import { CoreEvent } from '../api/core';

export type AuthStackParamList = {
  SignUp: undefined;
  Login: undefined;
  LoginOtp: { phone: string };
};

export type GoLiveStackParamList = {
  GoLive: undefined;
  Filters: undefined;
  LiveMatches: undefined;
  EmptyRoom: undefined;
};

export type EventsStackParamList = {
  Events: undefined;
  // Olga.Core only exposes GET /v1/events (list) — no single-event detail
  // endpoint — so we carry the already-fetched event through navigation
  // instead of re-fetching by id.
  EventDetail: { event: CoreEvent };
  WhosGoing: { event: CoreEvent };
};

export type MainTabParamList = {
  HomeTab: undefined;
  GoLiveTab: undefined;
  EventsTab: undefined;
  ChatTab: undefined;
};
