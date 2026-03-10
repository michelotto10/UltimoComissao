import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createSupabaseServerClient(req, res);

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  const path = req.nextUrl.pathname;

  // sem login => não entra em /admin nem /pais
  if ((path.startsWith("/admin") || path.startsWith("/pais")) && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (user && (path.startsWith("/admin") || path.startsWith("/pais"))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = String(profile?.role ?? "").trim().toLowerCase();

    if (!role) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    // pai não entra no admin
    if (path.startsWith("/admin") && role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/pais";
      return NextResponse.redirect(url);
    }

    // opcional: admin não entra no pais
    if (path.startsWith("/pais") && role === "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/pais/:path*"],
};