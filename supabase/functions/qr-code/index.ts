// QR Code generator — returns a PNG image
// Public endpoint, no auth required (must be embeddable in emails)
import QRCode from "npm:qrcode@1.5.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const data = url.searchParams.get("data");
    const sizeParam = url.searchParams.get("size");
    const size = Math.max(64, Math.min(1024, Number(sizeParam) || 320));

    if (!data || data.length > 2048) {
      return new Response("Missing or invalid 'data' param", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const buffer = await QRCode.toBuffer(data, {
      type: "png",
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#FFFFFF" },
    });

    return new Response(buffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=2592000, immutable",
      },
    });
  } catch (err) {
    console.error("[qr-code] error", err);
    return new Response("Failed to generate QR code", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
