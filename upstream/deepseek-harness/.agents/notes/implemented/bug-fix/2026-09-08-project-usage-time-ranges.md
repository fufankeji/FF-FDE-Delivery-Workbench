# Agent Note: Request-dated project usage

Status: implemented

English | [中文](2026-09-08-project-usage-time-ranges.zh.md)

## Problem

The dashboard defaulted to Today and assigned a session's lifetime counters to its latest update timestamp. Historical projects therefore appeared empty on a new day, while a session spanning several days could move all usage into one day.

## Decision

Default the product view to lifetime totals. Register an independent numeric `sessionActivity` projection alongside cumulative stats, reusing the stats reducer and replacing repeated usage receipts within a step. Attribute each request to its start interval, falling back to receipt time only when the start is absent. Keep the existing cumulative projections and chat footer unchanged.

The trusted workspace usage route uses attached snapshots or public cold projection replay for persisted sessions. It does not open an Agent, copy message content or rewrite logs. The client controller cancels obsolete reads and distinguishes loading, failure, partial data and genuine inactivity. Date-filtered cards, trends and rows share the same activity data; long histories merge calendar days rather than discard them.

## Alternatives and verification

Changing only the default would leave date filters incorrect. Parsing private persistence files in the browser or widening the Session API is unnecessary because the public projection cache can replay historical logs. Focused tests cover cross-midnight attribution, receipt replacement, cancellation, checkpoint restoration, Loader composition, range switching and stale client requests. Actual project totals, log hashes and the served bundle are checked in the F002 task record. No model call, external export or automated browser acceptance is required.
