import { formatCalendarDate, toCalendarDate } from "./calendarDate";

describe("calendar dates", () => {
  it("displays the wire date without local timezone conversion", () => {
    expect(formatCalendarDate("2020-01-01T00:00:00Z")).toBe("2020-01-01");
    expect(formatCalendarDate("")).toBe("");
  });

  it("serializes the UTC picker date as UTC midnight", () => {
    expect(toCalendarDate(new Date("2020-01-01T12:00:00Z"))).toBe("2020-01-01T00:00:00Z");
  });
});
