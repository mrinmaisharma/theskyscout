import { integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const voucherRedemptions = sqliteTable("voucher_redemptions", {
  id: text("id").primaryKey(),
  reference: text("reference").notNull(),
  voucherCode: text("voucher_code").notNull(),
  originCode: text("origin_code").notNull(),
  destinationCode: text("destination_code").notNull(),
  travelDate: text("travel_date").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  locationAccuracy: real("location_accuracy"),
  locationCapturedAt: text("location_captured_at"),
  locationConsent: integer("location_consent", { mode: "boolean" }).notNull(),
  privacyConsent: integer("privacy_consent", { mode: "boolean" }).notNull(),
  emailStatus: text("email_status").notNull().default("pending"),
  passportCiphertext: text("passport_ciphertext"),
  passportIv: text("passport_iv"),
  verifiedAt: text("verified_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("voucher_redemptions_reference_unique").on(table.reference),
  uniqueIndex("voucher_redemptions_voucher_code_unique").on(table.voucherCode),
]);

export const vouchers = sqliteTable("vouchers", {
  code: text("code").primaryKey(),
  originCity: text("origin_city").notNull(),
  originAirport: text("origin_airport").notNull(),
  originCode: text("origin_code").notNull(),
  destinationCity: text("destination_city").notNull(),
  destinationAirport: text("destination_airport").notNull(),
  destinationCode: text("destination_code").notNull(),
  flightType: text("flight_type").notNull().default("Direct"),
  durationMinutes: integer("duration_minutes").notNull().default(540),
  carryOnKg: integer("carry_on_kg").notNull().default(7),
  checkedBaggageKg: integer("checked_baggage_kg").notNull().default(25),
  defaultTravelDate: text("default_travel_date").notNull(),
  earliestTravelDate: text("earliest_travel_date").notNull(),
  latestTravelDate: text("latest_travel_date").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
  redeemedAt: text("redeemed_at"),
});

export const voucherOtpChallenges = sqliteTable("voucher_otp_challenges", {
  id: text("id").primaryKey(),
  voucherCode: text("voucher_code").notNull(),
  email: text("email").notNull(),
  purpose: text("purpose").notNull(),
  otpHash: text("otp_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  consumedAt: text("consumed_at"),
  createdAt: text("created_at").notNull(),
});

export const voucherTravelDates = sqliteTable("voucher_travel_dates", {
  voucherCode: text("voucher_code").notNull(),
  travelDate: text("travel_date").notNull(),
}, (table) => [primaryKey({ columns: [table.voucherCode, table.travelDate] })]);

export const voucherUsageEvents = sqliteTable("voucher_usage_events", {
  id: text("id").primaryKey(),
  voucherCode: text("voucher_code").notNull(),
  eventType: text("event_type").notNull(),
  visitorId: text("visitor_id").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  acceptLanguage: text("accept_language"),
  referrer: text("referrer"),
  country: text("country"),
  region: text("region"),
  city: text("city"),
  eventMetadata: text("event_metadata"),
  createdAt: text("created_at").notNull(),
});
