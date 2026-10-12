import { raw, Router, type IRouter } from "express";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db, inquiriesTable, listingsTable, reviewsTable, subscriptionsTable, usersTable } from "@workspace/db";
import {
  CreateInquiryBody,
  CreateListingBody,
  CreateSubscriptionBody,
  GetAdminListingsQueryParams,
  GetAdminListingsResponse,
  GetDashboardSummaryQueryParams,
  GetFeaturedListingsResponse,
  GetListingParams,
  GetListingResponse,
  ListInquiriesQueryParams,
  ListInquiriesResponse,
  ListListingsQueryParams,
  ListListingsResponse,
  ReviewListingBody,
  ReviewListingParams,
  UpdateListingBody,
  UpdateListingParams,
} from "@workspace/api-zod";
import { getCurrentProfile, getSupabaseUser, isRentFasterAdminEmail, requireRentFasterAdmin, requireSupabaseUser, syncUserProfile, type ProfileRole } from "../lib/supabase-auth";
import { ensureListingMediaBucket, uploadListingMedia } from "../lib/supabase-storage";

const router: IRouter = Router();
const GHANA_LISTING_PHOTOS = [
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85",
];

function roleFromBody(value: unknown): ProfileRole | undefined {
  return value === "tenant" || value === "landlord" || value === "admin" ? value : undefined;
}

router.post("/auth/profile", async (req, res): Promise<void> => {
  const user = await requireSupabaseUser(req, res);
  if (!user) return;

  const requestedRole = roleFromBody(req.body?.role);
  if (req.body?.role && !requestedRole) {
    res.status(400).json({ error: "Role must be tenant or landlord" });
    return;
  }

  const profile = await syncUserProfile(user, requestedRole === "admin" ? undefined : requestedRole, req.body?.name);
  await ensureListingMediaBucket();
  res.json({
    id: profile.id,
    role: profile.role,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    city: profile.city,
    verified: profile.verified,
  });
});

router.post("/listing-media", raw({ type: ["image/*", "video/*"], limit: "150mb" }), async (req, res): Promise<void> => {
  const user = await requireSupabaseUser(req, res);
  if (!user) return;
  const contentType = req.header("content-type") ?? "";
  if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
    res.status(415).json({ error: "Only image and video uploads are supported" });
    return;
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    res.status(400).json({ error: "Upload body is empty" });
    return;
  }
  const path = await uploadListingMedia(user.id, req.header("x-file-name") ?? "upload", contentType, req.body);
  res.status(201).json({ path, url: path });
});

function money(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function mapListing(listing: typeof listingsTable.$inferSelect, landlord?: typeof usersTable.$inferSelect) {
  const rent = money(listing.monthlyRentGhs);
  const commission = rent * 0.1;
  const payout = rent - commission;
  return {
    id: listing.id,
    landlordId: listing.landlordId,
    title: listing.title,
    description: listing.description,
    address: listing.address,
    city: listing.city,
    lat: money(listing.lat),
    lng: money(listing.lng),
    monthlyRentGhs: rent,
    commissionRate: 10,
    landlordPayoutMonthlyGhs: payout,
    yearlyRentTotalGhs: rent * 12,
    yearlyCommissionTotalGhs: commission * 12,
    yearlyLandlordTotalGhs: payout * 12,
    propertyType: listing.propertyType,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    furnished: listing.furnished,
    petFriendly: listing.petFriendly,
    billsIncluded: listing.billsIncluded,
    photos: (listing.photos ?? []) as string[],
    videoUrl: listing.videoUrl,
    amenities: (listing.amenities ?? []) as string[],
    status: listing.status,
    featured: listing.featured,
    submittedAt: listing.submittedAt.toISOString(),
    approvedAt: listing.approvedAt?.toISOString() ?? null,
    rejectionReason: listing.rejectionReason,
    landlordName: landlord?.name ?? "RentFaster verified landlord",
    landlordVerified: landlord?.verified ?? true,
    landlordPhone: landlord?.phone ?? "",
    createdAt: listing.createdAt.toISOString(),
  };
}

async function ensureSeedData() {
  const existing = await db.select({ id: listingsTable.id }).from(listingsTable).limit(1);
  if (existing.length > 0) return;

  const [landlord] = await db.insert(usersTable).values({
    name: "Ama Owusu",
    email: "ama@rentfaster.gh",
    phone: "+233 24 555 0182",
    role: "landlord",
    verified: true,
    city: "Accra",
    paystackSubaccountCode: "ACCT_demo_rentfaster",
  }).returning();

  const seed = [
    ["Sunlit Osu apartment", "A bright, secure apartment close to Oxford Street with reliable water and power.", "Osu, Accra", "Accra", 2200, "Apartment", 2, 2, true, true],
    ["Quiet East Legon chamber & hall", "Spacious chamber and hall in a gated compound with a private compound garden.", "East Legon, Accra", "Accra", 1800, "Chamber & Hall", 1, 1, false, true],
    ["Cantonments garden home", "A leafy, furnished home with fast access to schools, offices, and the airport.", "Cantonments, Accra", "Accra", 4200, "House", 3, 3, true, false],
  ] as const;

  await db.insert(listingsTable).values(seed.map((item, index) => {
    const rent = item[4];
    return {
      landlordId: landlord.id,
      title: item[0],
      description: item[1],
      address: item[2],
      city: item[3],
      lat: index === 0 ? "5.5571" : index === 1 ? "5.6345" : "5.5782",
      lng: index === 0 ? "-0.1825" : index === 1 ? "-0.1683" : "-0.1720",
      monthlyRentGhs: String(rent),
      commissionRate: "10",
      landlordPayoutMonthlyGhs: String(rent * 0.9),
      yearlyRentTotalGhs: String(rent * 12),
      yearlyCommissionTotalGhs: String(rent * 0.1 * 12),
      yearlyLandlordTotalGhs: String(rent * 0.9 * 12),
      propertyType: item[5],
      bedrooms: item[6],
      bathrooms: item[7],
      furnished: item[8],
      petFriendly: item[9],
      billsIncluded: index === 1,
      photos: GHANA_LISTING_PHOTOS,
      videoUrl: "https://cdn.coverr.co/videos/coverr-a-woman-in-a-modern-apartment-1575/1080p.mp4",
      amenities: ["24/7 security", "Water reservoir", "Parking", "Backup power"],
      status: "approved",
      featured: index !== 1,
    };
  }));
}

router.get("/listings", async (req, res): Promise<void> => {
  await ensureSeedData();
  const query = ListListingsQueryParams.parse(req.query);
  const status = query.status ?? "approved";
  if (status !== "approved") {
    const admin = await requireRentFasterAdmin(req, res);
    if (!admin) return;
  }
  const rows = await db.select().from(listingsTable).where(eq(listingsTable.status, status)).orderBy(desc(listingsTable.createdAt));
  const filtered = rows.filter((listing) => {
    const rent = money(listing.monthlyRentGhs);
    return (!query.city || listing.city.toLowerCase() === query.city.toLowerCase())
      && (!query.propertyType || listing.propertyType === query.propertyType)
      && (!query.minPrice || rent >= query.minPrice)
      && (!query.maxPrice || rent <= query.maxPrice)
      && (query.bedrooms == null || listing.bedrooms >= query.bedrooms)
      && (query.furnished == null || listing.furnished === query.furnished)
      && (query.petFriendly == null || listing.petFriendly === query.petFriendly)
      && (query.billsIncluded == null || listing.billsIncluded === query.billsIncluded);
  });
  const landlords = await db.select().from(usersTable);
  res.json(ListListingsResponse.parse(filtered.map((listing) => mapListing(listing, landlords.find((user) => user.id === listing.landlordId)))));
});

router.get("/listings/featured", async (_req, res): Promise<void> => {
  await ensureSeedData();
  const rows = await db.select().from(listingsTable).where(and(eq(listingsTable.status, "approved"), eq(listingsTable.featured, true))).orderBy(desc(listingsTable.createdAt));
  const landlords = await db.select().from(usersTable);
  res.json(GetFeaturedListingsResponse.parse(rows.map((listing) => mapListing(listing, landlords.find((user) => user.id === listing.landlordId)))));
});

router.get("/listings/:listingId", async (req, res): Promise<void> => {
  await ensureSeedData();
  const params = GetListingParams.parse(req.params);
  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, params.listingId));
  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (listing.status !== "approved") {
    const user = await getSupabaseUser(req);
    if (!user || (user.id !== listing.landlordId && !isRentFasterAdminEmail(user.email))) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
  }
  const [landlord] = await db.select().from(usersTable).where(eq(usersTable.id, listing.landlordId));
  const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.listingId, listing.id));
  const base = mapListing(listing, landlord);
  const averageRating = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 4.8;
  res.json(GetListingResponse.parse({ ...base, reviews: reviews.map((review) => ({ ...review, createdAt: review.createdAt.toISOString() })), averageRating }));
});

router.post("/listings", async (req, res): Promise<void> => {
  const profile = await getCurrentProfile(req, res);
  if (!profile) return;
  if (profile.role !== "landlord") {
    res.status(403).json({ error: "Only landlord accounts can create listings" });
    return;
  }
  const parsed = CreateListingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rent = parsed.data.monthlyRentGhs;
  const [created] = await db.insert(listingsTable).values({
    landlordId: profile.id,
    ...parsed.data,
    lat: parsed.data.lat == null ? null : String(parsed.data.lat),
    lng: parsed.data.lng == null ? null : String(parsed.data.lng),
    monthlyRentGhs: String(rent),
    commissionRate: "10",
    landlordPayoutMonthlyGhs: String(rent * 0.9),
    yearlyRentTotalGhs: String(rent * 12),
    yearlyCommissionTotalGhs: String(rent * 0.1 * 12),
    yearlyLandlordTotalGhs: String(rent * 0.9 * 12),
    status: "pending_approval",
    submittedAt: new Date(),
    approvedAt: null,
    rejectionReason: null,
  }).returning();
  res.status(201).json(mapListing(created, profile));
});

router.patch("/listings/:listingId", async (req, res): Promise<void> => {
  const profile = await getCurrentProfile(req, res);
  if (!profile) return;
  if (profile.role !== "landlord") {
    res.status(403).json({ error: "Only landlord accounts can update listings" });
    return;
  }
  const params = UpdateListingParams.parse(req.params);
  const parsed = UpdateListingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rent = parsed.data.monthlyRentGhs;
  const [updated] = await db.update(listingsTable).set({
    ...parsed.data,
    lat: parsed.data.lat == null ? null : String(parsed.data.lat),
    lng: parsed.data.lng == null ? null : String(parsed.data.lng),
    monthlyRentGhs: String(rent),
    landlordPayoutMonthlyGhs: String(rent * 0.9),
    yearlyRentTotalGhs: String(rent * 12),
    yearlyCommissionTotalGhs: String(rent * 0.1 * 12),
    yearlyLandlordTotalGhs: String(rent * 0.9 * 12),
    status: "pending_approval",
    submittedAt: new Date(),
    approvedAt: null,
    rejectionReason: null,
  }).where(and(eq(listingsTable.id, params.listingId), eq(listingsTable.landlordId, profile.id))).returning();
  if (!updated) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  res.json(mapListing(updated, profile));
});

router.get("/inquiries", async (req, res): Promise<void> => {
  const profile = await getCurrentProfile(req, res);
  if (!profile) return;
  const query = ListInquiriesQueryParams.parse(req.query);
  const rows = await db.select({
    id: inquiriesTable.id,
    listingId: inquiriesTable.listingId,
    tenantId: inquiriesTable.tenantId,
    message: inquiriesTable.message,
    status: inquiriesTable.status,
    createdAt: inquiriesTable.createdAt,
    listingTitle: listingsTable.title,
    tenantName: usersTable.name,
  }).from(inquiriesTable)
    .innerJoin(listingsTable, eq(inquiriesTable.listingId, listingsTable.id))
    .innerJoin(usersTable, eq(inquiriesTable.tenantId, usersTable.id))
    .where(profile.role === "admin"
      ? undefined
      : profile.role === "landlord"
        ? eq(listingsTable.landlordId, profile.id)
        : eq(inquiriesTable.tenantId, profile.id))
    .orderBy(desc(inquiriesTable.createdAt));
  res.json(ListInquiriesResponse.parse(rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))));
});

router.post("/inquiries", async (req, res): Promise<void> => {
  const profile = await getCurrentProfile(req, res);
  if (!profile) return;
  if (profile.role !== "tenant") {
    res.status(403).json({ error: "Only tenant accounts can send inquiries" });
    return;
  }
  const parsed = CreateInquiryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [created] = await db.insert(inquiriesTable).values({ ...parsed.data, tenantId: profile.id }).returning();
  res.status(201).json({ ...created, createdAt: created.createdAt.toISOString() });
});

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const profile = await getCurrentProfile(req, res);
  if (!profile) return;
  await ensureSeedData();
  const query = GetDashboardSummaryQueryParams.parse(req.query);
  if (query.role !== profile.role) {
    res.status(403).json({ error: "Dashboard role does not match the authenticated profile" });
    return;
  }
  const listings = await db.select().from(listingsTable);
  const subscriptions = await db.select().from(subscriptionsTable);
  const visibleListings = profile.role === "admin"
    ? listings
    : listings.filter((listing) => listing.landlordId === profile.id);
  const approved = visibleListings.filter((listing) => listing.status === "approved");
  const monthlyRent = approved.reduce((sum, listing) => sum + money(listing.monthlyRentGhs), 0);
  const commission = monthlyRent * 0.1;
  const summary = {
    role: query.role,
    monthlyRentGhs: query.role === "admin" ? monthlyRent : query.role === "landlord" ? monthlyRent : 0,
    monthlyCommissionGhs: commission,
    monthlyPayoutGhs: monthlyRent - commission,
    yearlyRentGhs: monthlyRent * 12,
    yearlyCommissionGhs: commission * 12,
    yearlyPayoutGhs: (monthlyRent - commission) * 12,
    activeListings: approved.length,
    pendingListings: visibleListings.filter((listing) => listing.status === "pending_approval" || listing.status === "pending").length,
    savedListings: 0,
    activeSubscriptions: subscriptions.filter((subscription) => subscription.status === "active").length,
  };
  res.json(summary);
});

router.get("/admin/listings", async (req, res): Promise<void> => {
  const admin = await requireRentFasterAdmin(req, res);
  if (!admin) return;
  await ensureSeedData();
  const query = GetAdminListingsQueryParams.parse(req.query);
  const allListings = await db.select().from(listingsTable);
  const landlords = await db.select().from(usersTable);
  const isPending = (status: string) => status === "pending_approval" || status === "pending";
  const selectedListings = allListings
    .filter((listing) => query.status === "pending_approval"
      ? isPending(listing.status)
      : listing.status === query.status)
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  res.json(GetAdminListingsResponse.parse({
    counts: {
      pending: allListings.filter((listing) => isPending(listing.status)).length,
      approved: allListings.filter((listing) => listing.status === "approved").length,
      rejected: allListings.filter((listing) => listing.status === "rejected").length,
    },
    listings: selectedListings.map((listing) => {
      const landlord = landlords.find((user) => user.id === listing.landlordId);
      return {
        id: listing.id,
        title: listing.title,
        address: listing.address,
        city: listing.city,
        monthlyRentGhs: money(listing.monthlyRentGhs),
        photos: (listing.photos ?? []) as string[],
        status: listing.status === "pending" ? "pending_approval" : listing.status,
        landlordPhone: landlord?.phone ?? null,
        submittedAt: listing.submittedAt.toISOString(),
        approvedAt: listing.approvedAt?.toISOString() ?? null,
        rejectionReason: listing.rejectionReason,
      };
    }),
  }));
});

router.post("/admin/listings/:listingId/review", async (req, res): Promise<void> => {
  const admin = await requireRentFasterAdmin(req, res);
  if (!admin) return;
  const params = ReviewListingParams.parse(req.params);
  const parsed = ReviewListingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rejectionReason = parsed.data.reason?.trim() ?? "";
  if (parsed.data.status === "rejected" && !rejectionReason) {
    res.status(400).json({ error: "A rejection reason is required" });
    return;
  }
  const [existing] = await db.select().from(listingsTable).where(eq(listingsTable.id, params.listingId));
  if (!existing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (existing.status !== "pending_approval" && existing.status !== "pending") {
    res.status(409).json({ error: "Only pending listings can be reviewed" });
    return;
  }
  const [listing] = await db.update(listingsTable).set({
    status: parsed.data.status,
    approvedAt: parsed.data.status === "approved" ? new Date() : null,
    rejectionReason: parsed.data.status === "rejected" ? rejectionReason : null,
  }).where(and(
    eq(listingsTable.id, params.listingId),
    inArray(listingsTable.status, ["pending_approval", "pending"]),
  )).returning();
  if (!listing) {
    res.status(409).json({ error: "This listing has already been reviewed" });
    return;
  }
  const [landlord] = await db.select().from(usersTable).where(eq(usersTable.id, listing.landlordId));
  res.json(mapListing(listing, landlord));
});

router.post("/payments/subscribe", async (req, res): Promise<void> => {
  const profile = await getCurrentProfile(req, res);
  if (!profile) return;
  if (profile.role !== "tenant") {
    res.status(403).json({ error: "Only tenant accounts can start a rent payment" });
    return;
  }
  const parsed = CreateSubscriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, parsed.data.listingId));
  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  const amountGhs = money(listing.monthlyRentGhs);
  const commissionGhs = amountGhs * 0.1;
  const landlordPayoutGhs = amountGhs - commissionGhs;
  const reference = `rentfaster_${Date.now()}`;
  let authorizationUrl = `/tenant?payment=started&reference=${reference}`;
  let subscriptionCode = `pending_${reference}`;
  if (process.env.PAYSTACK_SECRET_KEY) {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "tenant@rentfaster.gh",
        amount: Math.round(amountGhs * 100),
        currency: "GHS",
        reference,
        callback_url: `${process.env.APP_URL ?? "http://localhost"}/tenant?payment=success`,
        metadata: { listingId: listing.id, commissionGhs, landlordPayoutGhs, billing: "monthly" },
      }),
    });
    const payload = await response.json() as { data?: { authorization_url?: string; access_code?: string } };
    authorizationUrl = payload.data?.authorization_url ?? authorizationUrl;
    subscriptionCode = payload.data?.access_code ?? subscriptionCode;
  }
  await db.insert(subscriptionsTable).values({ tenantId: profile.id, listingId: listing.id, amountGhs: String(amountGhs), paystackSubscriptionCode: subscriptionCode, status: "pending" });
  res.status(201).json({ authorizationUrl, reference, subscriptionCode, amountGhs, commissionGhs, landlordPayoutGhs });
});

export default router;