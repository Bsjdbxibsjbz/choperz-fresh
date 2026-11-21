import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  phoneNumberClient,
} from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [
    // Infer custom server-side user fields such as kind on the client.
    inferAdditionalFields<typeof auth>(),
    phoneNumberClient(),
  ],
});
