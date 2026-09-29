import { Firestore } from "@google-cloud/firestore";

let firestore: Firestore | undefined;

export function getFirestore(): Firestore {
  // Several stored records have optional fields (e.g. `resource`) that are
  // legitimately absent rather than always present — without this, Firestore
  // throws on any `undefined` property instead of just omitting it.
  firestore ??= new Firestore({ ignoreUndefinedProperties: true });
  return firestore;
}
