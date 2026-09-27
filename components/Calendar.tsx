"use client";
import { useEffect, useState } from "react";
import { addDays, today, formatDate, datesBetween } from "@/lib/domain";
import { api } from "@/lib/client";
import { Arrow } from "./Brand";
export type Occupied = { cabin_id: number; arrival: string; departure: string };
function monthDate(date: string, offset = 0) {
  const d = new Date(date + "T12:00:00Z");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1, 12))
    .toISOString()
    .slice(0, 10);
}
export function Calendar({
  cabinId,
  arrival,
  departure,
  onChange,
}: {
  cabinId: number;
  arrival: string;
  departure: string;
  onChange: (start: string, end: string) => void;
}) {
  const [month, setMonth] = useState(monthDate(arrival)),
    [pickingEnd, setPickingEnd] = useState(false),
    [occupied, setOccupied] = useState<Occupied[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    async function load() {
      try {
        const data = await api<{ occupied: Occupied[] }>(
          `availability?from=${month}&to=${addDays(month, 93)}`,
          { signal: controller.signal },
        );
        if (alive) {
          setOccupied(data.occupied);
          setError("");
        }
      } catch (e) {
        if (alive)
          setError(
            e instanceof Error
              ? e.message
              : "Availability could not be loaded.",
          );
      } finally {
        if (alive) setLoading(false);
      }
    }
    setLoading(true);
    void load();
    const timer = setInterval(load, 15000);
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [month, cabinId]);
  const unavailable = (date: string) =>
    occupied.some(
      (r) => r.cabin_id === cabinId && date >= r.arrival && date < r.departure,
    );
  const canEnd = (date: string) =>
    date >= addDays(arrival, 2) &&
    date <= addDays(arrival, 21) &&
    datesBetween(arrival, date).every((d) => !unavailable(d));
  function choose(date: string) {
    if (pickingEnd && canEnd(date)) {
      onChange(arrival, date);
      setPickingEnd(false);
    } else if (!unavailable(date)) {
      onChange(date, addDays(date, 3));
      setPickingEnd(true);
    }
  }
  return (
    <div className="calendar">
      <div className="calendar-controls">
        <div>
          <span className="eyebrow">
            {pickingEnd ? "NOW CHOOSE YOUR DEPARTURE" : "CHOOSE YOUR DATES"}
          </span>
          <p>
            {pickingEnd
              ? `Arriving ${formatDate(arrival)} · minimum 2 nights`
              : "Stay a little. Two nights, or a few more."}
          </p>
        </div>
        <div className="calendar-arrows">
          <button
            className="round-button"
            aria-label="Previous month"
            disabled={month <= monthDate(today())}
            onClick={() => setMonth(monthDate(month, -1))}
          >
            <Arrow direction="left" />
          </button>
          <button
            className="round-button"
            aria-label="Next month"
            disabled={month >= monthDate(addDays(today(), 365))}
            onClick={() => setMonth(monthDate(month, 1))}
          >
            <Arrow />
          </button>
        </div>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="calendar-months" aria-busy={loading}>
        {[0, 1].map((offset) => {
          const first = monthDate(month, offset),
            date = new Date(first + "T12:00:00Z"),
            length = new Date(
              Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
            ).getUTCDate(),
            start = (date.getUTCDay() + 6) % 7;
          return (
            <div className="calendar-month" key={first}>
              <h4>
                {new Intl.DateTimeFormat("en-CA", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(date)}
              </h4>
              <div className="calendar-weekdays" aria-hidden="true">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
              <div className="calendar-days">
                {Array.from({ length: start }, (_, i) => (
                  <span key={`empty-${i}`} />
                ))}
                {Array.from({ length }, (_, i) => {
                  const day = addDays(first, i),
                    blocked = unavailable(day),
                    isEnd = pickingEnd && canEnd(day),
                    disabled =
                      loading ||
                      !!error ||
                      day < addDays(today(), 1) ||
                      day > addDays(today(), 365) ||
                      (blocked && !isEnd),
                    inside = day > arrival && day < departure;
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={disabled}
                      onClick={() => choose(day)}
                      aria-label={`${formatDate(day)}${blocked ? " — occupied night" : ""}${isEnd ? " — departure available" : ""}`}
                      aria-pressed={day === arrival || day === departure}
                      className={`${inside ? "in-range " : ""}${day === arrival ? "range-start " : ""}${day === departure ? "range-end " : ""}${blocked ? "occupied " : ""}`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="calendar-key">
        <span>
          <i /> Selected stay
        </span>
        <span>
          <s>14</s> Unavailable night
        </span>
        <span>Check-in 15:00 · Check-out 11:00</span>
      </div>
      <div className="date-input-fallback">
        <label>
          Arrival
          <input
            type="date"
            value={arrival}
            min={addDays(today(), 1)}
            max={addDays(today(), 365)}
            onChange={(e) => {
              if (e.target.value) {
                onChange(e.target.value, addDays(e.target.value, 3));
                setMonth(monthDate(e.target.value));
                setPickingEnd(false);
              }
            }}
          />
        </label>
        <label>
          Departure
          <input
            type="date"
            value={departure}
            min={addDays(arrival, 2)}
            max={addDays(arrival, 21)}
            onChange={(e) => {
              if (e.target.value) {
                onChange(arrival, e.target.value);
                setPickingEnd(false);
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}
