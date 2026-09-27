import test from "node:test";
import assert from "node:assert/strict";
import {
  firstOfMonth,
  moveMonth,
  calendarKeyDate,
  nightOccupied,
  canDepart,
  suggestedDeparture,
  type CalendarInventory,
} from "../lib/calendar-days.ts";

const inventory: CalendarInventory = {
  from: "2027-01-01",
  to: "2027-04-01",
  occupied: [
    { cabin_id: 1, arrival: "2027-01-10", departure: "2027-01-12" },
    { cabin_id: 2, arrival: "2027-01-20", departure: "2027-01-22" },
  ],
};

test("month navigation clamps long dates instead of skipping a month", () => {
  assert.equal(firstOfMonth("2027-01-31", 1), "2027-02-01");
  assert.equal(moveMonth("2027-01-31", 1), "2027-02-28");
  assert.equal(moveMonth("2028-01-31", 1), "2028-02-29");
});
test("calendar keyboard movement follows grid and month conventions", () => {
  assert.equal(calendarKeyDate("2027-03-10", "ArrowRight"), "2027-03-11");
  assert.equal(calendarKeyDate("2027-03-10", "ArrowUp"), "2027-03-03");
  assert.equal(calendarKeyDate("2027-03-10", "Home"), "2027-03-08");
  assert.equal(calendarKeyDate("2027-03-10", "End"), "2027-03-14");
  assert.equal(calendarKeyDate("2027-03-31", "PageDown"), "2027-04-30");
  assert.equal(calendarKeyDate("2027-03-31", "PageDown", true), "2028-03-31");
  assert.equal(calendarKeyDate("2027-03-10", "Enter"), null);
});
test("inventory uses half-open nights so checkout remains reusable", () => {
  assert.equal(nightOccupied(inventory, 1, "2027-01-10"), true);
  assert.equal(nightOccupied(inventory, 1, "2027-01-11"), true);
  assert.equal(nightOccupied(inventory, 1, "2027-01-12"), false);
  assert.equal(canDepart(inventory, 1, "2027-01-08", "2027-01-10", "2027-01-01"), true);
});
test("suggested stays never jump through an occupied night", () => {
  assert.equal(suggestedDeparture(inventory, 1, "2027-01-09", "2027-01-01"), null);
  assert.equal(suggestedDeparture(inventory, 1, "2027-01-12", "2027-01-01"), "2027-01-15");
});
test("departure rules enforce two to twenty-one nights and loaded coverage", () => {
  assert.equal(canDepart(inventory, 1, "2027-02-01", "2027-02-02", "2027-01-01"), false);
  assert.equal(canDepart(inventory, 1, "2027-02-01", "2027-02-23", "2027-01-01"), false);
  assert.equal(canDepart(inventory, 1, "2027-03-31", "2027-04-02", "2027-01-01"), false);
  assert.equal(canDepart(inventory, 1, "2027-02-01", "2027-02-04", "2027-01-01"), true);
});
