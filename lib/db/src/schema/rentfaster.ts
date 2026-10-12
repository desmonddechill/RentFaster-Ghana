import { pgTable, text, uuid, numeric, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const usersTable = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  role: text("role").notNull().default("tenant"),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  verified: boolean("verified").notNull().default(false),
  paystackSubaccountCode: text("paystack_subaccount_code"),
  city: text("city"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const listingsTable = pgTable("listings", {
  id: uuid("id").defaultRandom().primaryKey(),
  landlordId: uuid("landlord_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  lat: numeric("lat"),
  lng: numeric("lng"),
  monthlyRentGhs: numeric("monthly_rent_ghs", { precision: 12, scale: 2 }).notNull(),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).notNull().default("10"),
  landlordPayoutMonthlyGhs: numeric("landlord_payout_monthly_ghs", { precision: 12, scale: 2 }).notNull(),
  yearlyRentTotalGhs: numeric("yearly_rent_total_ghs", { precision: 12, scale: 2 }).notNull(),
  yearlyCommissionTotalGhs: numeric("yearly_commission_total_ghs", { precision: 12, scale: 2 }).notNull(),
  yearlyLandlordTotalGhs: numeric("yearly_landlord_total_ghs", { precision: 12, scale: 2 }).notNull(),
  propertyType: text("property_type").notNull(),
  bedrooms: integer("bedrooms").notNull().default(0),
  bathrooms: integer("bathrooms").notNull().default(1),
  furnished: boolean("furnished").notNull().default(false),
  petFriendly: boolean("pet_friendly").notNull().default(false),
  billsIncluded: boolean("bills_included").notNull().default(false),
  photos: jsonb("photos").$type<string[]>().notNull().default([]),
  videoUrl: text("video_url").notNull(),
  amenities: jsonb("amenities").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("pending_approval"),
  featured: boolean("featured").notNull().default(false),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const inquiriesTable = pgTable("inquiries", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingId: uuid("listing_id").notNull().references(() => listingsTable.id),
  tenantId: uuid("tenant_id").notNull().references(() => usersTable.id),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const subscriptionsTable = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => usersTable.id),
  listingId: uuid("listing_id").notNull().references(() => listingsTable.id),
  paystackSubscriptionCode: text("paystack_subscription_code"),
  amountGhs: numeric("amount_ghs", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  nextChargeDate: timestamp("next_charge_date", { withTimezone: true }),
});

export const reviewsTable = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingId: uuid("listing_id").notNull().references(() => listingsTable.id),
  tenantId: uuid("tenant_id").notNull().references(() => usersTable.id),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable);
export const insertListingSchema = createInsertSchema(listingsTable);
export const insertInquirySchema = createInsertSchema(inquiriesTable);
export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable);
export const insertReviewSchema = createInsertSchema(reviewsTable);

export type Listing = typeof listingsTable.$inferSelect;