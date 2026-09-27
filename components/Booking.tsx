"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Booking as BookingRecord } from "@/lib/bookings";
import { money, formatDate } from "@/lib/domain";
import { api, post, saveDownload } from "@/lib/client";
import { useCatalog } from "./Site";
import { PriceBreakdown } from "./Stay";
import { Arrow, TideMark } from "./Brand";
type RecordView = BookingRecord & {
  refundableAmount: number;
  refund: { amount: number; state: string } | null;
  emailDelivery: { kind: string; state: string }[];
};
export function Booking({ id }: { id: string }) {
  const { cabins } = useCatalog(),
    [token, setToken] = useState(""),
    [booking, setBooking] = useState<RecordView | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [cancelOpen, setCancelOpen] = useState(false),
    [acceptNoRefund, setAcceptNoRefund] = useState(false),
    [copied, setCopied] = useState(false),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const t =
      window.location.hash.slice(1) ||
      sessionStorage.getItem(`tidehouse:${id}`) ||
      "";
    if (t) {
      sessionStorage.setItem(`tidehouse:${id}`, t);
      setToken(t);
      window.history.replaceState(null, "", window.location.pathname);
    } else {
      setError(
        "Open the private link from your reservation to view this booking.",
      );
      setLoaded(true);
    }
  }, [id]);
  const load = useCallback(async () => {
    if (!token) return;
    try {
      setBooking(
        await api<RecordView>(`bookings/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your booking.");
    } finally {
      setLoaded(true);
    }
  }, [id, token]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (
      booking?.status !== "held" &&
      booking?.refund?.state !== "pending" &&
      booking?.refund?.state !== "processing"
    )
      return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [booking?.status, booking?.refund?.state, load]);
  async function action(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await post(`bookings/${id}/${path}`, body, token);
      await load();
      setCancelOpen(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "That action could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  const cabin = booking ? cabins.find((c) => c.id === booking.cabin_id) : null;
  const heading =
    booking?.status === "confirmed"
      ? "Your quieter days are booked."
      : booking?.status === "held"
        ? "A little quiet, on hold."
        : booking?.status === "cancelled"
          ? "Your stay has been cancelled."
          : booking?.status === "failed"
            ? "The payment wasn’t approved."
            : booking?.status === "expired"
              ? "This hold has come to an end."
              : booking?.status === "payment_review"
                ? "Payment received after the hold."
                : "Your little escape.";
  function receipt() {
    if (!booking || !cabin) return;
    saveDownload(
      `TIDEHOUSE-${id.slice(0, 8)}.txt`,
      `TIDEHOUSE — TEST BOOKING RECEIPT\nReference: ${id}\nStatus: ${booking.status}\nCabin: ${cabin.name}\nGuest: ${booking.guest_name}\nArrival: ${booking.arrival}, 15:00 America/Halifax\nDeparture: ${booking.departure}, 11:00 America/Halifax\nGuests: ${booking.guests}\n\n${booking.quote.nights.map((n) => `${n.date}: ${money(n.cents)} CAD`).join("\n")}\n${booking.quote.extras.map((a) => `${a.name}: ${money(a.total)} CAD`).join("\n")}\nIllustrative tax: ${money(booking.quote.tax)} CAD\nTotal: ${money(booking.total)} CAD\nRefund: ${booking.refund ? `${money(booking.refund.amount)} CAD, ${booking.refund.state}` : "None"}\n\nFictional portfolio property. No real accommodation or live payment.\n`,
    );
  }
  function calendar() {
    if (!booking || !cabin || booking.status !== "confirmed") return;
    const compact = (s: string) => s.replaceAll("-", "");
    saveDownload(
      "TIDEHOUSE-stay.ics",
      `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TIDEHOUSE//Test stay//EN\r\nBEGIN:VEVENT\r\nUID:${id}@tidehouse.example\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z\r\nDTSTART;VALUE=DATE:${compact(booking.arrival)}\r\nDTEND;VALUE=DATE:${compact(booking.departure)}\r\nSUMMARY:TIDEHOUSE - ${cabin.name} (fictional test booking)\r\nDESCRIPTION:Check-in 15:00 and check-out 11:00 America/Halifax. No real accommodation.\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`,
      "text/calendar",
    );
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/booking/${id}#${token}`,
      );
      setCopied(true);
    } catch {
      setError(
        "Clipboard access was unavailable. Download the receipt and keep your original private booking link.",
      );
    }
  }
  return (
    <main id="main" className="confirmation-page section-pad">
      <div className="confirmation-heading">
        <TideMark />
        <span className="eyebrow">
          {booking?.status === "confirmed"
            ? "A WARM WELCOME AWAITS"
            : "YOUR RESERVATION"}
        </span>
        <h1>{heading}</h1>
        {booking && (
          <span className={`status-tag status-${booking.status}`}>
            {booking.status.replaceAll("_", " ")} ·{" "}
            {booking.provider === "simulator"
              ? "local payment simulator"
              : "Stripe test mode"}
          </span>
        )}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {!loaded && (
        <p className="quote-loading">Opening your private reservation…</p>
      )}
      {booking && cabin && (
        <div className="confirmation-layout">
          <section>
            <img
              className="confirmation-photo"
              src={cabin.image}
              alt={`Representative architecture for ${cabin.name}`}
            />
            <span className="eyebrow">
              CABIN 0{cabin.id} / YOUR PLACE ON THE COAST
            </span>
            <h2>{cabin.name}</h2>
            <div className="confirmation-facts">
              <div>
                <small>ARRIVAL</small>
                <strong>{formatDate(booking.arrival)}</strong>
                <span>From 15:00</span>
              </div>
              <div>
                <small>DEPARTURE</small>
                <strong>{formatDate(booking.departure)}</strong>
                <span>By 11:00</span>
              </div>
              <div>
                <small>YOUR PEOPLE</small>
                <strong>{booking.guests} guests</strong>
                <span>{booking.guest_name}</span>
              </div>
            </div>
            {booking.status === "confirmed" && (
              <div className="welcome-note">
                <h3>
                  Nothing more to do.
                  <br />
                  <em>Except look forward to it.</em>
                </h3>
                <p>
                  Your cabin dates are now unavailable to other visitors. Your
                  on-screen confirmation is ready below.
                </p>
                <p>
                  {booking.emailDelivery.some(
                    (e) => e.kind === "confirmed" && e.state === "sent",
                  )
                    ? "A confirmation email has been sent."
                    : "An email confirmation is queued. Email delivery requires the owner to configure a sending service; no email is claimed to have been sent."}
                </p>
                <Link href="/field-notes/arrival" className="text-link">
                  A few notes for your arrival
                  <Arrow />
                </Link>
              </div>
            )}
            {booking.status === "held" && (
              <div className="payment-panel">
                <span className="eyebrow">PAYMENT IS NOT YET CONFIRMED</span>
                <h3>
                  {booking.provider === "simulator"
                    ? "Try the payment outcomes."
                    : "We’re awaiting the payment result."}
                </h3>
                <p>
                  {booking.provider === "simulator"
                    ? "This is an explicitly labelled local test harness, not a payment-provider sandbox. No card details or money are collected."
                    : "Only a signed, paid Stripe webhook can confirm this reservation. Returning from Checkout alone cannot confirm it. This page checks for updates."}
                </p>
                <p>
                  Hold ends:{" "}
                  {new Date(booking.hold_until!).toLocaleString("en-CA", {
                    timeZone: "America/Halifax",
                  })}{" "}
                  Atlantic time.
                </p>
                {booking.provider === "simulator" && (
                  <div className="payment-actions">
                    <button
                      className="button dark"
                      disabled={busy}
                      onClick={() => action("simulate", { outcome: "paid" })}
                    >
                      Simulate approved payment
                      <Arrow />
                    </button>
                    <button
                      className="button outline"
                      disabled={busy}
                      onClick={() => action("simulate", { outcome: "failed" })}
                    >
                      Simulate declined payment
                    </button>
                  </div>
                )}
              </div>
            )}
            {["failed", "expired", "payment_review"].includes(
              booking.status,
            ) && (
              <div className="notice">
                <p>
                  {booking.status === "failed"
                    ? "No booking was confirmed. Your dates have been released."
                    : booking.status === "expired"
                      ? "The temporary hold expired without confirmation. Please search again for current availability."
                      : "The payment arrived after this reservation stopped holding the dates. No stay was confirmed. A full refund has been queued for the owner to process."}
                </p>
                <Link href={`/stay?cabin=${cabin.id}`} className="text-link">
                  Find another stay
                  <Arrow />
                </Link>
              </div>
            )}
          </section>
          <aside className="booking-card confirmation-card">
            <span className="eyebrow">THE DETAILS, ALL TOGETHER</span>
            <PriceBreakdown quote={booking.quote} />
            <p className="reference">
              BOOKING REFERENCE
              <br />
              <strong>{id}</strong>
            </p>
            {booking.refund && (
              <div className="notice">
                <strong>Refund {booking.refund.state}</strong>
                <p>
                  {money(booking.refund.amount)} CAD{" "}
                  {booking.refund.state === "refunded"
                    ? "has been refunded in test mode."
                    : "is awaiting processing or a provider retry. A cancellation is not itself proof of a refund."}
                </p>
              </div>
            )}
            <div className="confirmation-actions">
              <button className="text-link" onClick={receipt}>
                Download your receipt
                <Arrow direction="down" />
              </button>
              {booking.status === "confirmed" && (
                <button className="text-link" onClick={calendar}>
                  Add dates to your calendar
                  <Arrow direction="down" />
                </button>
              )}
              <button className="text-link" onClick={copyLink}>
                {copied ? "Private link copied" : "Copy private booking link"}
                <Arrow />
              </button>
              <button className="text-link" onClick={load}>
                Refresh booking status
                <Arrow />
              </button>
            </div>
            {["held", "confirmed"].includes(booking.status) && (
              <div className="cancellation-panel">
                {!cancelOpen ? (
                  <button
                    className="subtle-button"
                    onClick={() => setCancelOpen(true)}
                  >
                    Cancel this reservation
                  </button>
                ) : (
                  <>
                    <h4>Cancel your stay?</h4>
                    <p>
                      {booking.status === "held"
                        ? "Your unpaid hold will be released. No payment will be taken."
                        : `Your refund will be ${money(booking.refundableAmount)} CAD. ${booking.refundableAmount === 0 ? "This booking is within seven calendar days of arrival." : "The full amount is refundable under the seven-day policy."}`}
                    </p>
                    {booking.status === "confirmed" &&
                      booking.refundableAmount === 0 && (
                        <label className="policy-check">
                          <input
                            type="checkbox"
                            checked={acceptNoRefund}
                            onChange={(e) =>
                              setAcceptNoRefund(e.target.checked)
                            }
                          />
                          <span>I understand that no refund is due.</span>
                        </label>
                      )}
                    <button
                      className="button outline full-width"
                      disabled={
                        busy ||
                        (booking.status === "confirmed" &&
                          booking.refundableAmount === 0 &&
                          !acceptNoRefund)
                      }
                      onClick={() => action("cancel", { acceptNoRefund })}
                    >
                      Confirm cancellation
                    </button>
                    <button
                      className="subtle-button"
                      onClick={() => setCancelOpen(false)}
                    >
                      Keep my reservation
                    </button>
                  </>
                )}
              </div>
            )}
            <p className="booking-reassurance">
              Keep this link private. Anyone with the link can view and cancel
              this booking.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
