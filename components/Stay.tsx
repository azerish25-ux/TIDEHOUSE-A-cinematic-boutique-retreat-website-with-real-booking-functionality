"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { addons } from "@/lib/catalog";
import { type Quote, type Selection, money, formatDate } from "@/lib/domain";
import { readStayLink } from "@/lib/stay-link";
import { api, post } from "@/lib/client";
import { useCatalog } from "./Site";
import { PropertyMap } from "./PropertyMap";
import { Calendar } from "./Calendar";
import {
  CabinFacts,
  Gallery,
  Comparison,
  type CabinAvailability,
} from "./CabinDetails";
import { Arrow } from "./Brand";

export function PriceBreakdown({ quote }: { quote: Quote }) {
  return (
    <div className="price-breakdown">
      <details className="nightly-breakdown">
        <summary>
          <span>
            {quote.nights.length} unhurried nights{" "}
            <small>See nightly rates</small>
          </span>
          <span>{money(quote.accommodation)}</span>
        </summary>
        {quote.nights.map((n) => (
          <div key={n.date} className="price-row">
            <span>{formatDate(n.date)}</span>
            <span>{money(n.cents)}</span>
          </div>
        ))}
      </details>
      {quote.extras.map((a) => (
        <div className="price-row" key={a.id}>
          <span>
            {a.name}
            <small>
              {a.quantity} × {money(a.unit)}
            </small>
          </span>
          <span>{money(a.total)}</span>
        </div>
      ))}
      <div className="price-row">
        <span>Illustrative tax ({quote.taxBps / 100}%)</span>
        <span>{money(quote.tax)}</span>
      </div>
      <div className="price-total">
        <span>
          Your complete stay<small>CAD · no additional resort fee</small>
        </span>
        <strong>{money(quote.total)}</strong>
      </div>
    </div>
  );
}
type SearchResult = { results: Record<number, CabinAvailability> };
type Attempt = {
  identity: string;
  body: {
    selection: Selection;
    name: string;
    email: string;
    acceptedPolicy: boolean;
    expectedTotal: number;
    idempotencyKey: string;
  };
};

export function Stay() {
  const params = useSearchParams(),
    { cabins } = useCatalog();
  const [initial] = useState(() => readStayLink(params));
  const [selection, setSelection] = useState<Selection>(initial.selection);
  const [search, setSearch] = useState<{
    key: string;
    results: Record<number, CabinAvailability>;
    error: string;
  }>({ key: "", results: {}, error: "" });
  const [step, setStep] = useState<"choose" | "details">("choose");
  const [compare, setCompare] = useState<number[]>([]),
    [comparing, setComparing] = useState(false);
  const [busy, setBusy] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [accepted, setAccepted] = useState(false);
  const [reserveError, setReserveError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [retryable, setRetryable] = useState(false);
  const attempt = useRef<Attempt | null>(null);
  const cabin = cabins.find((c) => c.id === selection.cabinId) ?? cabins[0];
  // The selection's cabin is omitted because a single search prices all five cabins.
  const queryKey = JSON.stringify({
    arrival: selection.arrival,
    departure: selection.departure,
    guests: selection.guests,
    addons: [...selection.addons].sort(),
  });
  const identity = JSON.stringify({
    selection,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    accepted,
  });
  const loading = search.key !== queryKey;
  const result = !loading ? search.results[cabin.id] : undefined;
  const quote = result?.quote ?? null;
  const available = result?.available === true;
  const recovering = retryable && attempt.current?.identity === identity;
  const error =
    reserveError ||
    (!loading
      ? search.error ||
        (result && !result.available
          ? result.reason ||
            "These dates are unavailable. Choose another cabin or dates."
          : "")
      : "");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => {
      api<SearchResult>("search", {
        method: "POST",
        body: JSON.stringify({ ...JSON.parse(queryKey), cabinId: 1 }),
        signal: controller.signal,
      })
        .then((data) => {
          if (active)
            setSearch({ key: queryKey, results: data.results, error: "" });
        })
        .catch((e) => {
          if (active)
            setSearch({
              key: queryKey,
              results: {},
              error:
                e instanceof Error
                  ? e.message
                  : "Availability could not be checked.",
            });
        });
    }, 180);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [queryKey, refresh]);
  useEffect(() => {
    const update = () => setRefresh((n) => n + 1);
    const interval = setInterval(update, 15000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", update);
    };
  }, []);
  function change(next: Selection) {
    setSelection(next);
    setReserveError("");
    setRetryable(false);
  }
  function pickCabin(id: number) {
    change({ ...selection, cabinId: id });
    setStep("choose");
  }
  function toggleCompare(id: number) {
    setCompare((c) =>
      c.includes(id)
        ? c.filter((n) => n !== id)
        : c.length < 2
          ? [...c, id]
          : [c[1], id],
    );
  }
  async function book(e: FormEvent) {
    e.preventDefault();
    if (busy || !accepted || (!recovering && (loading || !quote || !available)))
      return;
    setBusy(true);
    setReserveError("");
    if (!recovering)
      attempt.current = {
        identity,
        body: {
          selection,
          name,
          email,
          acceptedPolicy: accepted,
          expectedTotal: quote!.total,
          idempotencyKey: crypto.randomUUID(),
        },
      };
    try {
      const reservation = await post<{
        id: string;
        token: string;
        url: string;
      }>("bookings", attempt.current!.body);
      try {
        sessionStorage.setItem(
          `tidehouse:${reservation.id}`,
          reservation.token,
        );
      } catch {
        // Keep the bearer token in the fragment when browser storage is blocked.
        window.location.assign(
          `/booking/${reservation.id}#${reservation.token}`,
        );
        return;
      }
      window.location.assign(reservation.url);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "We could not start your booking.";
      setReserveError(message);
      const definitive =
        /price changed|already reserved|dates.*unavailable|different booking details/i.test(
          message,
        );
      setRetryable(!definitive);
      if (definitive) attempt.current = null;
      setRefresh((n) => n + 1);
      setBusy(false);
    }
  }
  return (
    <main id="main" className="stay-page section-pad">
      <div className="stay-intro">
        <div>
          <span className="eyebrow">A FEW DAYS, ENTIRELY YOURS</span>
          <h1>
            Find <em>your stay.</em>
          </h1>
        </div>
        <p>
          Choose a view. Find a little space.
          <br />
          We’ll take care of the rest.
        </p>
      </div>
      {initial.corrected && (
        <p role="status" className="notice">
          Some details in that link were not valid. We have selected a valid
          cabin and dates; please review them before booking.
        </p>
      )}
      <ol className="journey-steps" aria-label="Booking steps">
        <li className={step === "choose" ? "current" : "done"}>
          <span>01</span>Your cabin & dates
        </li>
        <li className={step === "details" ? "current" : ""}>
          <span>02</span>The little details
        </li>
        <li>
          <span>03</span>Payment & a warm welcome
        </li>
      </ol>
      <div className="stay-layout">
        <div className="stay-main">
          <div className="stay-map-top">
            <span className="eyebrow">PICK YOUR PLACE ON THE MAP</span>
            <span>One retreat. Just five cabins.</span>
          </div>
          <PropertyMap
            cabins={cabins}
            selected={selection.cabinId}
            onSelect={pickCabin}
            compact
          />
          <div className="cabin-selector">
            {cabins.map((c) => {
              const r = !loading ? search.results[c.id] : undefined;
              return (
                <div className={c.id === cabin.id ? "selected" : ""} key={c.id}>
                  <button
                    onClick={() => pickCabin(c.id)}
                    aria-pressed={c.id === cabin.id}
                  >
                    <span>0{c.id}</span>
                    <strong>{c.name}</strong>
                    <small>{c.capacity} guests</small>
                    <span
                      className={`availability-status ${r && !r.available ? "unavailable" : ""}`}
                    >
                      {loading
                        ? "Checking your dates…"
                        : r?.available && r.quote
                          ? `${money(r.quote.total)} · complete stay`
                          : r?.reason || "Availability unavailable"}
                    </span>
                  </button>
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`Compare ${c.name}`}
                      checked={compare.includes(c.id)}
                      onChange={() => toggleCompare(c.id)}
                    />
                    Compare {c.name}
                  </label>
                </div>
              );
            })}
          </div>
          <div className="compare-bar">
            <span>
              {compare.length === 2
                ? "Two places. Which one feels like you?"
                : "Select two cabins above to compare."}
            </span>
            <button
              className="text-link"
              disabled={compare.length !== 2}
              onClick={() => setComparing(true)}
            >
              Compare cabins ({compare.length}/2)
              <Arrow />
            </button>
          </div>
          <div className="selected-cabin-title">
            <div>
              <span className="eyebrow">YOUR CABIN / 0{cabin.id}</span>
              <h2>{cabin.name}</h2>
            </div>
            <span className="serif-lead">{cabin.subtitle}</span>
          </div>
          <Gallery key={cabin.id} cabin={cabin} />
          <CabinFacts cabin={cabin} />
          <section className="stay-dates" id="dates">
            <Calendar
              cabinId={cabin.id}
              arrival={selection.arrival}
              departure={selection.departure}
              onChange={(arrival, departure) => {
                change({ ...selection, arrival, departure });
                setStep("choose");
              }}
            />
          </section>
          <section className="stay-addons">
            <span className="eyebrow">A LITTLE SOMETHING EXTRA</span>
            <h3>
              Make it <em>your own.</em>
            </h3>
            {addons.map((a) => (
              <label
                className={`addon-option ${selection.addons.includes(a.id) ? "checked" : ""}`}
                key={a.id}
              >
                <input
                  type="checkbox"
                  checked={selection.addons.includes(a.id)}
                  onChange={(e) =>
                    change({
                      ...selection,
                      addons: e.target.checked
                        ? [...selection.addons, a.id]
                        : selection.addons.filter((x) => x !== a.id),
                    })
                  }
                />
                <span>
                  <strong>{a.name}</strong>
                  <p>{a.description}</p>
                  <small>
                    {money(a.unit)} CAD / {a.basis}
                  </small>
                </span>
                <span className="addon-check" aria-hidden="true">
                  {selection.addons.includes(a.id) ? "✓" : "+"}
                </span>
              </label>
            ))}
          </section>
        </div>
        <aside className="stay-sidebar">
          <div className="booking-card">
            <span className="eyebrow">YOUR LITTLE ESCAPE</span>
            <h3>{cabin.name}</h3>
            <p>{cabin.view}</p>
            <div className="summary-dates">
              <div>
                <small>ARRIVAL</small>
                <strong>{formatDate(selection.arrival)}</strong>
              </div>
              <Arrow />
              <div>
                <small>DEPARTURE</small>
                <strong>{formatDate(selection.departure)}</strong>
              </div>
            </div>
            <label className="guest-field">
              Your people
              <select
                value={selection.guests}
                onChange={(e) =>
                  change({ ...selection, guests: Number(e.target.value) })
                }
                aria-label="Total guests"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "guest" : "guests"}
                    {n > cabin.capacity
                      ? " — exceeds this cabin’s capacity"
                      : ""}
                  </option>
                ))}
              </select>
              <small>
                All guests count, including children. Maximum {cabin.capacity}.
              </small>
            </label>
            <div aria-live="polite">
              {loading ? (
                <p className="quote-loading">
                  Finding the price for your dates…
                </p>
              ) : quote ? (
                <PriceBreakdown quote={quote} />
              ) : null}
              {error && (
                <p role="alert" className="notice error">
                  {error}
                </p>
              )}
            </div>
            {!loading && search.error && (
              <button
                type="button"
                className="text-link"
                onClick={() => setRefresh((n) => n + 1)}
              >
                Check availability again <Arrow />
              </button>
            )}
            {step === "choose" ? (
              <button
                className="button dark full-width"
                disabled={loading || !available || !quote}
                onClick={() => setStep("details")}
              >
                Continue to your details <Arrow />
              </button>
            ) : (
              <form className="guest-form" onSubmit={book}>
                <span className="eyebrow">A NAME FOR YOUR WELCOME</span>
                <label>
                  Your name
                  <input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setRetryable(false);
                    }}
                    autoComplete="name"
                    required
                    maxLength={100}
                  />
                </label>
                <label>
                  Email address
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setRetryable(false);
                    }}
                    autoComplete="email"
                    placeholder="Use a test address"
                    required
                    maxLength={254}
                  />
                </label>
                <label className="policy-check">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    required
                  />
                  <span>
                    I have read the{" "}
                    <Link href="/field-notes/cancellation" target="_blank">
                      cancellation policy
                    </Link>{" "}
                    and understand this is a fictional retreat with test
                    payments only.
                  </span>
                </label>
                <button
                  className="button dark full-width"
                  disabled={
                    busy ||
                    !accepted ||
                    (!recovering && (loading || !quote || !available))
                  }
                >
                  {busy
                    ? "Holding your dates…"
                    : recovering
                      ? "Retry this booking attempt"
                      : "Continue to test payment"}
                  <Arrow />
                </button>
                <button
                  type="button"
                  className="subtle-button"
                  onClick={() => setStep("choose")}
                >
                  Back to your stay
                </button>
              </form>
            )}
            <p className="booking-reassurance">
              Your dates are held only when you continue to payment.
              Confirmation follows a successful payment result.
            </p>
            <Link className="small-link" href="/field-notes/cancellation">
              Free cancellation 7+ days before arrival
            </Link>
          </div>
          <div className="sidebar-note">
            <span className="eyebrow">THE NICE THINGS, INCLUDED</span>
            <p>
              Linen, towels, Wi-Fi, firewood, parking and final cleaning. No
              surprises at the door.
            </p>
            <Link href="/field-notes/included" className="text-link">
              All the details <Arrow />
            </Link>
          </div>
        </aside>
      </div>
      {comparing && compare.length === 2 && (
        <Comparison
          cabins={compare.map((id) => cabins.find((c) => c.id === id)!)}
          onClose={() => setComparing(false)}
          onChoose={(id) => {
            pickCabin(id);
            setComparing(false);
          }}
          availability={!loading ? search.results : {}}
          stayLabel={`${formatDate(selection.arrival)} – ${formatDate(selection.departure)} · ${selection.guests} guests`}
        />
      )}
    </main>
  );
}
