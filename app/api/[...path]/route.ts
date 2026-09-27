import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import { AppError, object, text, today, addDays } from "@/lib/domain";
import { cabins, editorial } from "@/lib/catalog";
import {
  reserve,
  readQuote,
  inventory,
  getBooking,
  cancel,
  settle,
  blockDates,
  unblockDates,
  updateRates,
} from "@/lib/bookings";
import {
  paymentMode,
  secret,
  requireOrigin,
  rateLimit,
  verifyPassword,
  makeAdminSession,
  verifyAdminSession,
  requireBookingToken,
  safeEqual,
  appUrl,
} from "@/lib/security";
import { checkout, stripeWebhook } from "@/lib/payments";
import { maintenance, processRefunds, deliverEmails } from "@/lib/jobs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function jsonBody(request: Request) {
  const body = await request.text();
  if (body.length > 16384) throw new AppError(413, "The request is too large.");
  try {
    return object(JSON.parse(body));
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(400, "The request body must be valid JSON.");
  }
}
function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function owner(request: NextRequest) {
  if (!verifyAdminSession(request.cookies.get("tidehouse_owner")?.value))
    throw new AppError(401, "Sign in to the owner studio.", "UNAUTHORIZED");
}
async function handle(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await params).path,
      route = path.join("/"),
      method = request.method;
    if (method === "GET" && route === "health") {
      await getPool().query("SELECT 1");
      return response({
        ok: true,
        database: "postgresql",
        paymentMode: paymentMode(),
      });
    }
    if (method === "GET" && route === "catalog") {
      if (!process.env.DATABASE_URL)
        return response({
          cabins,
          pages: editorial,
          bookingConfigured: false,
          paymentMode: null,
          today: today(),
        });
      const pool = getPool(),
        rates = await pool.query("SELECT id,base_rate FROM cabins"),
        pages = await pool.query(
          "SELECT slug,title,eyebrow,body FROM content_pages",
        );
      return response({
        cabins: cabins.map((c) => ({
          ...c,
          baseRate:
            rates.rows.find((r) => r.id === c.id)?.base_rate ?? c.baseRate,
        })),
        pages: Object.fromEntries(pages.rows.map((p) => [p.slug, p])),
        bookingConfigured: !!process.env.APP_SECRET,
        paymentMode: process.env.PAYMENT_PROVIDER ?? null,
        today: today(),
      });
    }
    const pool = getPool();
    if (method === "POST" && route === "webhooks/stripe") {
      const body = await request.text();
      if (body.length > 1000000) throw new AppError(413, "Webhook too large.");
      const result = await stripeWebhook(
        pool,
        body,
        request.headers.get("stripe-signature") ?? "",
      );
      return response(result);
    }
    if (route === "maintenance" && (method === "POST" || method === "GET")) {
      const token =
        request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
      if (
        !process.env.CRON_SECRET ||
        process.env.CRON_SECRET.length < 32 ||
        !safeEqual(token, process.env.CRON_SECRET)
      )
        throw new AppError(401, "Unauthorized.");
      return response(await maintenance(pool));
    }
    if (method !== "GET") requireOrigin(request);
    if (method === "GET" && route === "availability") {
      const from = request.nextUrl.searchParams.get("from") ?? today(),
        to = request.nextUrl.searchParams.get("to") ?? addDays(from, 62);
      return response({ occupied: await inventory(pool, from, to) });
    }
    if (method === "POST" && route === "quote") {
      await rateLimit(pool, request, "quote", 180);
      return response(await readQuote(pool, await jsonBody(request)));
    }
    if (method === "POST" && route === "bookings") {
      await rateLimit(pool, request, "reserve", 20);
      secret();
      const mode = paymentMode(),
        booking = await reserve(pool, await jsonBody(request), mode);
      return response(await checkout(pool, booking), 201);
    }
    if (path[0] === "bookings" && path[1]) {
      const id = path[1];
      if (!uuid.test(id)) throw new AppError(404, "Booking not found.");
      requireBookingToken(
        id,
        request.headers.get("authorization")?.replace(/^Bearer /, "") ?? null,
      );
      if (method === "GET" && path.length === 2) {
        const b = await getBooking(pool, id);
        return response({
          ...b,
          request_hash: undefined,
          provider_session_id: undefined,
          payment_intent: undefined,
        });
      }
      if (method === "POST" && path[2] === "simulate") {
        await rateLimit(pool, request, "simulate", 30);
        if (paymentMode() !== "simulator")
          throw new AppError(404, "Not found.");
        const body = await jsonBody(request),
          b = await getBooking(pool, id);
        if (body.outcome !== "paid" && body.outcome !== "failed")
          throw new AppError(
            400,
            "Choose an approved or declined test payment.",
          );
        if (b.status !== "held")
          throw new AppError(409, "This payment hold is no longer active.");
        const result = await settle(pool, {
          eventId: `sim:${id}:${body.outcome}`,
          bookingId: id,
          sessionId: `sim_${id}`,
          provider: "simulator",
          outcome: body.outcome,
          amount: b.total,
          currency: "CAD",
          paymentIntent: `sim_${id}`,
        });
        await deliverEmails(pool);
        return response(result);
      }
      if (method === "POST" && path[2] === "cancel") {
        const body = await jsonBody(request),
          result = await cancel(pool, id, body.acceptNoRefund === true);
        await processRefunds(pool);
        await deliverEmails(pool);
        return response(result);
      }
    }
    if (method === "POST" && route === "admin/login") {
      await rateLimit(pool, request, "owner-login", 5);
      const body = await jsonBody(request);
      if (!verifyPassword(text(body.password, "Password", 512)))
        throw new AppError(401, "The owner password is incorrect.");
      const result = response({ ok: true });
      result.cookies.set("tidehouse_owner", makeAdminSession(), {
        httpOnly: true,
        sameSite: "strict",
        secure: appUrl().startsWith("https:"),
        path: "/",
        maxAge: 8 * 60 * 60,
      });
      return result;
    }
    if (path[0] === "admin") {
      owner(request);
      if (method === "POST" && route === "admin/logout") {
        const result = response({ ok: true });
        result.cookies.delete("tidehouse_owner");
        return result;
      }
      if (method === "GET" && route === "admin/state") {
        const [bookings, rates, pages, audit] = await Promise.all([
          pool.query(
            "SELECT b.id,b.cabin_id,b.arrival::text,b.departure::text,b.guests,b.status,b.guest_name,b.guest_email,b.total,b.is_block,r.state AS refund_state FROM bookings b LEFT JOIN refund_jobs r ON r.booking_id=b.id ORDER BY b.created_at DESC LIMIT 200",
          ),
          pool.query("SELECT * FROM cabins ORDER BY id"),
          pool.query("SELECT * FROM content_pages ORDER BY slug"),
          pool.query("SELECT * FROM audit_log ORDER BY id DESC LIMIT 20"),
        ]);
        return response({
          bookings: bookings.rows,
          rates: rates.rows,
          pages: pages.rows,
          audit: audit.rows,
        });
      }
      if (method === "POST" && route === "admin/blocks")
        return response(await blockDates(pool, await jsonBody(request)), 201);
      if (method === "POST" && route === "admin/unblock") {
        const body = await jsonBody(request);
        if (typeof body.id !== "string" || !uuid.test(body.id))
          throw new AppError(400, "Invalid block ID.");
        return response(await unblockDates(pool, body.id));
      }
      if (method === "POST" && route === "admin/rates")
        return response(await updateRates(pool, await jsonBody(request)));
      if (method === "POST" && route === "admin/content") {
        const body = await jsonBody(request),
          slug = text(body.slug, "Page", 40);
        if (!Object.hasOwn(editorial, slug))
          throw new AppError(400, "Unknown editorial page.");
        const title = text(body.title, "Title", 150),
          eyebrow = text(body.eyebrow, "Section label", 80),
          content = text(body.body, "Page content", 12000);
        await pool.query(
          "UPDATE content_pages SET title=$2,eyebrow=$3,body=$4,updated_at=now() WHERE slug=$1",
          [slug, title, eyebrow, content],
        );
        await pool.query(
          "INSERT INTO audit_log(action,details) VALUES('edit_content',$1)",
          [JSON.stringify({ slug })],
        );
        return response({ ok: true });
      }
      if (method === "POST" && route === "admin/maintenance")
        return response(await maintenance(pool));
    }
    throw new AppError(404, "Not found.");
  } catch (error) {
    if (error instanceof AppError)
      return response({ error: error.message, code: error.code }, error.status);
    const reference = randomUUID();
    console.error("TIDEHOUSE request failed", {
      reference,
      code: (error as { code?: string }).code ?? "INTERNAL",
    });
    return response(
      {
        error:
          "We could not complete that request. No payment has been assumed successful. Please retry.",
        code: "INTERNAL",
        reference,
      },
      500,
    );
  }
}
export const GET = handle;
export const POST = handle;
