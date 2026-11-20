import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import RestTimer from "./RestTimer";

test("counts rest time independently and starts over after closing", () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  const onClose = jest.fn();
  const { rerender } = render(<RestTimer startedAt={Date.now()} onClose={onClose} />);

  expect(screen.getByRole("timer")).toHaveTextContent("00:00");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  act(() => jest.advanceTimersByTime(30000));
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "30");
  act(() => jest.advanceTimersByTime(30000));
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  expect(screen.getByRole("timer")).toHaveTextContent("01:00");
  act(() => jest.advanceTimersByTime(5000));
  expect(screen.getByRole("timer")).toHaveTextContent("01:05");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "5");

  fireEvent.click(screen.getByRole("button", { name: "Close rest timer" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  rerender(<></>);
  rerender(<RestTimer startedAt={Date.now()} onClose={onClose} />);
  expect(screen.getByRole("timer")).toHaveTextContent("00:00");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  jest.useRealTimers();
});
