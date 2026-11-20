/**
 * Function schema types for RayfinClient.
 *
 * AUTO-GENERATED — do not edit manually.
 * Re-generated automatically when function source files change.
 *
 * If this file is not updating automatically, run:
 *   rayfin dev functions apply
 *
 * The schema is a closed object type: only the function names listed
 * below are accepted by RayfinClient.functions.<name>.invoke(...).
 * Adding, renaming, or changing the signature of a udf.func() call
 * regenerates this file and surfaces type errors at every consumer.
 *
 * IMPORTANT: This file must NOT import any Node.js packages — it is
 * resolved by the frontend app's TypeScript compiler.
 */

export type AppFunctionsSchema = {
  searchPlaces: {
    input: { query: string };
    output: { error: string; places: { name: string; region: string; latitude: number; longitude: number }[] };
  };
  getForecast: {
    input: { latitude: number; longitude: number };
    output: { error: string; timezone: string; days: { date: string; snow: null | number; high: null | number; low: null | number; code: null | number }[] };
  };
};
