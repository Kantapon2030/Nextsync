export async function register() {
  // Windows / corporate SSL inspection breaks Node fetch (Neon HTTP, Google OAuth, etc.)
  if (
    process.env.NODE_ENV === "development" &&
    process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "1"
  ) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
}
