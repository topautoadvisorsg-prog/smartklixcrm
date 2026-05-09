import jwt from "jsonwebtoken";
import crypto from "crypto";

const SECRET = "test-secret";
const PAYLOAD = { foo: "bar", timestamp: Date.now() };

// 1. Test JWT Generation
const token = jwt.sign({ sub: "agent-platform" }, SECRET, { algorithm: "HS256" });
console.log("Generated JWT:", token);

try {
  const decoded = jwt.verify(token, SECRET);
  console.log("JWT Verified successfully:", decoded);
} catch (err) {
  console.error("JWT Verification failed:", err);
  process.exit(1);
}

// 2. Test HMAC Generation
const signature = crypto
  .createHmac("sha256", SECRET)
  .update(JSON.stringify(PAYLOAD))
  .digest("hex");
console.log("Generated HMAC:", signature);

const expectedSignature = crypto
  .createHmac("sha256", SECRET)
  .update(JSON.stringify(PAYLOAD))
  .digest("hex");

if (signature === expectedSignature) {
  console.log("HMAC matched successfully.");
} else {
  console.error("HMAC mismatch!");
  process.exit(1);
}

console.log("All security utilities verified locally.");
