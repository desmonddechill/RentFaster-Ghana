import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAdminListingsQueryKey,
  useGetAdminListings,
  useReviewListing,
} from '@workspace/api-client-react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  Home,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';

type ListingStatus = 'pending_approval' | 'approved' | 'rejected';

const statusOptions: Array<{ value: ListingStatus; label: string; countKey: 'pending' | 'approved' | 'rejected' }> = [
  { value: 'pending_approval', label: 'Pending', countKey: 'pending' },
  { value: 'approved', label: 'Approved', countKey: 'approved' },
  { value: 'rejected', label: 'Rejected', countKey: 'rejected' },
];

const statusParams: Record<ListingStatus, { status: ListingStatus }> = {
  pending_approval: { status: 'pending_approval' },
  approved: { status: 'approved' },
  rejected: { status: 'rejected' },
};

const formatRent = (amount: number) =>
  `₵${new Intl.NumberFormat('en-GH', { maximumFractionDigits: 0 }).format(amount)}`;

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export function AdminListingsPage() {
  const [activeStatus, setActiveStatus] = useState<ListingStatus>('pending_approval');
  const [rejectingListing, setRejectingListing] = useState<{ id: string; title: string } | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const queryClient = useQueryClient();
  const query = useGetAdminListings(statusParams[activeStatus], {
    query: { queryKey: getGetAdminListingsQueryKey(statusParams[activeStatus]) },
  });
  const reviewListing = useReviewListing();

  const refreshAdminLists = async () => {
    await Promise.all(
      statusOptions.map(({ value }) =>
        queryClient.invalidateQueries({ queryKey: getGetAdminListingsQueryKey(statusParams[value]) }),
      ),
    );
  };

  const review = async (listingId: string, status: 'approved' | 'rejected', rejectionReason?: string) => {
    setActionError('');
    try {
      await reviewListing.mutateAsync({
        listingId,
        data: status === 'rejected' ? { status, reason: rejectionReason } : { status },
      });
      setRejectingListing(null);
      setReason('');
      await refreshAdminLists();
    } catch {
      setActionError('That decision could not be saved. Please try again.');
    }
  };

  const counts = query.data?.counts;
  const listings = query.data?.listings ?? [];
  const isPendingView = activeStatus === 'pending_approval';

  return (
    <section className="mx-auto w-full max-w-6xl animate-rise-in">
      <header className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-secondary/20 bg-secondary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.13em] text-secondary">
            <ShieldCheck size={14} />
            Listing review
          </div>
          <h2 className="font-display text-3xl tracking-[-.045em] sm:text-4xl">A careful look, before they go live.</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Verify each home against its details, then make a clear decision for the landlord.
          </p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-semibold text-muted-foreground">
          <Clock3 size={15} className="text-primary" />
          <span>Review queue</span>
          <span className="h-4 w-px bg-border" />
          <span className="font-mono-brand text-foreground">
            {counts ? String(counts.pending).padStart(2, '0') : '—'}
          </span>
        </div>
      </header>

      <div className="mb-5 border-b border-border">
        <div className="-mb-px flex gap-1 overflow-x-auto" role="tablist" aria-label="Listing status">
          {statusOptions.map((tab) => {
            const selected = activeStatus === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setActiveStatus(tab.value);
                  setActionError('');
                }}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors sm:px-4 ${
                  selected
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                <span
                  className={`min-w-6 rounded-full px-1.5 py-0.5 text-center font-mono-brand text-[10px] ${
                    selected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {counts ? counts[tab.countKey] : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {actionError && !rejectingListing && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button type="button" onClick={() => setActionError('')} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}

      {query.isLoading ? (
        <div className="grid gap-3" aria-label="Loading listings">
          {[0, 1, 2].map((item) => (
            <div key={item} className="animate-pulse rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex gap-4">
                <div className="h-28 w-32 shrink-0 rounded-xl bg-muted sm:h-32 sm:w-44" />
                <div className="flex-1 py-1">
                  <div className="h-4 w-2/3 rounded bg-muted" />
                  <div className="mt-3 h-3 w-1/2 rounded bg-muted" />
                  <div className="mt-5 h-3 w-1/3 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <div className="rounded-2xl border border-destructive/20 bg-card px-6 py-12 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle size={22} />
          </div>
          <h3 className="mt-4 font-display text-2xl">Listings could not load</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            The review list is temporarily unavailable. Your decisions have not been changed.
          </p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:brightness-95"
          >
            <RefreshCw size={15} /> Try again
          </button>
        </div>
      ) : listings.length === 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="surface-dots flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="grid size-14 place-items-center rounded-2xl border border-secondary/15 bg-secondary/10 text-secondary">
              {activeStatus === 'pending_approval' ? <CheckCircle2 size={25} /> : <Home size={24} />}
            </div>
            <h3 className="mt-5 font-display text-2xl">
              {activeStatus === 'pending_approval'
                ? 'The queue is clear.'
                : activeStatus === 'approved'
                  ? 'No approved listings yet.'
                  : 'No rejected listings.'}
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              {activeStatus === 'pending_approval'
                ? 'New submissions will appear here when they are ready for review.'
                : 'Listings with this decision will be collected here.'}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] border-collapse text-left">
                <caption className="sr-only">
                  {activeStatus === 'pending_approval' ? 'Listings awaiting administrator review' : `${activeStatus} listings`}
                </caption>
                <thead className="bg-muted/65">
                  <tr className="border-b border-border">
                    <th scope="col" className="w-24 px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Photo</th>
                    <th scope="col" className="min-w-48 px-3 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Listing title</th>
                    <th scope="col" className="min-w-44 px-3 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Location</th>
                    <th scope="col" className="min-w-32 px-3 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Monthly rent</th>
                    <th scope="col" className="min-w-36 px-3 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Landlord phone</th>
                    <th scope="col" className="min-w-40 px-3 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Submitted</th>
                    <th scope="col" className="min-w-52 px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">
                      {isPendingView ? 'Review actions' : 'Decision'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {listings.map((listing) => (
                    <tr key={listing.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="h-14 w-20 overflow-hidden rounded-lg bg-muted">
                          {listing.photos?.[0] ? (
                            <img
                              src={listing.photos[0]}
                              alt={`Photo of ${listing.title}`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground">
                              <Home size={20} strokeWidth={1.5} />
                            </div>
                          )}
                        </div>
                      </td>
                      <th scope="row" className="max-w-64 px-3 py-3 align-middle">
                        <span className="block truncate text-sm font-bold text-foreground">{listing.title}</span>
                        {listing.photos?.length > 1 && (
                          <span className="mt-1 block text-[11px] text-muted-foreground">{listing.photos.length} photos</span>
                        )}
                        {activeStatus === 'rejected' && listing.rejectionReason && (
                          <span className="mt-1 block max-w-60 truncate text-[11px] font-medium text-destructive" title={listing.rejectionReason}>
                            Reason: {listing.rejectionReason}
                          </span>
                        )}
                      </th>
                      <td className="px-3 py-3 text-sm text-muted-foreground">
                        <span className="inline-flex max-w-52 items-start gap-1.5">
                          <MapPin size={14} className="mt-0.5 shrink-0 text-primary" />
                          <span>{[listing.address, listing.city].filter(Boolean).join(', ') || 'Location not provided'}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="font-display text-base text-primary">{formatRent(listing.monthlyRentGhs)}</span>
                        <span className="ml-1 text-[11px] text-muted-foreground">/ mo</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-muted-foreground">
                        {listing.landlordPhone ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone size={13} className="text-secondary" />
                            {listing.landlordPhone}
                          </span>
                        ) : 'Phone not provided'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs leading-5 text-muted-foreground">
                        {formatDate(listing.submittedAt)}
                      </td>
                      <td className="px-4 py-3">
                        {isPendingView ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={reviewListing.isPending}
                              onClick={() => {
                                setActionError('');
                                setReason('');
                                setRejectingListing({ id: listing.id, title: listing.title });
                              }}
                              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
                            >
                              <XCircle size={14} /> Reject
                            </button>
                            <button
                              type="button"
                              disabled={reviewListing.isPending}
                              onClick={() => void review(listing.id, 'approved')}
                              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground transition hover:brightness-95 disabled:opacity-50"
                            >
                              <Check size={14} /> Approve
                            </button>
                          </div>
                        ) : (
                          <span className={`ml-auto flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${activeStatus === 'approved' ? 'bg-secondary/10 text-secondary' : 'bg-destructive/10 text-destructive'}`}>
                            {activeStatus === 'approved' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                            {activeStatus}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border bg-muted/25 px-4 py-2.5 text-[11px] text-muted-foreground">
              Showing {listings.length} {listings.length === 1 ? 'listing' : 'listings'}
            </div>
          </div>

          <div className="grid gap-3 md:hidden">
            {listings.map((listing) => (
              <article key={listing.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex flex-col gap-4 p-3.5">
                  <div className="relative h-48 overflow-hidden rounded-xl bg-muted">
                    {listing.photos?.[0] ? (
                      <img
                        src={listing.photos[0]}
                        alt={`Exterior or interior photo for ${listing.title}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Home size={30} strokeWidth={1.5} />
                      </div>
                    )}
                    {listing.photos?.length > 1 && (
                      <span className="absolute bottom-2 left-2 rounded-md bg-foreground/75 px-2 py-1 text-[10px] font-semibold text-background">
                        {listing.photos.length} photos
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display text-xl leading-tight tracking-[-.025em]">{listing.title}</h3>
                        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin size={14} className="shrink-0 text-primary" />
                          <span>{[listing.address, listing.city].filter(Boolean).join(', ') || 'Location not provided'}</span>
                        </p>
                      </div>
                      <div className="shrink-0 text-left">
                        <p className="font-display text-xl text-primary">{formatRent(listing.monthlyRentGhs)}</p>
                        <p className="text-[11px] text-muted-foreground">per month</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
                      <div className="inline-flex items-center gap-1.5">
                        <Phone size={13} className="text-secondary" />
                        <span>{listing.landlordPhone || 'Phone not provided'}</span>
                      </div>
                      <div className="inline-flex items-center gap-1.5">
                        <Clock3 size={13} />
                        <span>Submitted {formatDate(listing.submittedAt)}</span>
                      </div>
                    </div>

                    {activeStatus === 'rejected' && listing.rejectionReason && (
                      <div className="mt-3 rounded-lg bg-destructive/5 px-3 py-2 text-xs leading-5 text-muted-foreground">
                        <span className="font-bold text-foreground">Reason given: </span>
                        {listing.rejectionReason}
                      </div>
                    )}

                    {isPendingView && (
                      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          disabled={reviewListing.isPending}
                          onClick={() => {
                            setActionError('');
                            setReason('');
                            setRejectingListing({ id: listing.id, title: listing.title });
                          }}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
                        >
                          <XCircle size={16} /> Reject
                        </button>
                        <button
                          type="button"
                          disabled={reviewListing.isPending}
                          onClick={() => void review(listing.id, 'approved')}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-bold text-secondary-foreground transition hover:brightness-95 disabled:opacity-50"
                        >
                          <Check size={16} />
                          {reviewListing.isPending ? 'Saving decision…' : 'Approve listing'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {rejectingListing && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !reviewListing.isPending) setRejectingListing(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-dialog-title"
            className="w-full max-w-lg rounded-t-2xl border border-border bg-background p-5 shadow-xl sm:rounded-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono-brand text-[10px] uppercase tracking-[.16em] text-destructive">Decision required</p>
                <h3 id="reject-dialog-title" className="mt-2 font-display text-2xl">Why are you rejecting this home?</h3>
                <p className="mt-1 text-sm text-muted-foreground">{rejectingListing.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setRejectingListing(null)}
                disabled={reviewListing.isPending}
                aria-label="Close rejection form"
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>
            <label htmlFor="rejection-reason" className="mt-5 block text-sm font-bold">
              Reason for the landlord <span className="font-normal text-muted-foreground">(required)</span>
            </label>
            <textarea
              id="rejection-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Explain what needs attention so the landlord can take a clear next step."
              className="mt-2 w-full resize-y rounded-xl border border-input bg-card px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              autoFocus
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Be specific, factual, and helpful.</span>
              <span>{reason.length}/1000</span>
            </div>
            {actionError && (
              <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle size={15} /> {actionError}
              </p>
            )}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={reviewListing.isPending}
                onClick={() => setRejectingListing(null)}
                className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-muted disabled:opacity-50"
              >
                Keep reviewing
              </button>
              <button
                type="button"
                disabled={reviewListing.isPending || !reason.trim()}
                onClick={() => void review(rejectingListing.id, 'rejected', reason.trim())}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <XCircle size={16} />
                {reviewListing.isPending ? 'Saving decision…' : 'Reject listing'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default AdminListingsPage;
