export const applicationReviewKeys = {
  all: ["applicationReviews"] as const,
  noteDraft: (id: string) => ["applicationReviews", "noteDraft", id] as const,
};
