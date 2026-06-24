import { redirect } from "next/navigation";

// PONYTAIL: bare redirect — the middleware already bounces logged-out
// users to /login, so an authenticated hit here means "go somewhere real".
export default function Home() {
  redirect("/dashboard");
}
