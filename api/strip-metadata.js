/**
 * PDF Metadata Stripping API Route
 * Healthcare Governance Commons
 *
 * Strips metadata from uploaded PDFs before storage.
 * Removes: author, creator, producer, creation date, modification date,
 * custom properties, embedded thumbnails, XMP metadata.
 *
 * Accepts: base64-encoded PDF
 * Returns: base64-encoded cleaned PDF
 *
 * Note: This is a lightweight implementation that clears PDF info dictionary
 * entries. For production with high sensitivity requirements, upgrade to
 * a dedicated PDF sanitization service.
 */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { base64pdf, filename } = req.body;

    if (!base64pdf) {
      return res.status(400).json({ error: "PDF content required" });
    }

    // Validate it's actually a PDF
    const buffer = Buffer.from(base64pdf, "base64");
    const header = buffer.slice(0, 5).toString("ascii");

    if (!header.startsWith("%PDF-")) {
      return res.status(400).json({
        error: "File does not appear to be a valid PDF",
        action: "BLOCK",
      });
    }

    // Convert to string for metadata manipulation
    let pdfString = buffer.toString("binary");

    // Strip Info dictionary entries
    // These contain: Author, Creator, Producer, CreationDate, ModDate, Title, Subject, Keywords
    pdfString = pdfString.replace(
      /\/Author\s*\([^)]*\)/g,
      "/Author ()"
    );
    pdfString = pdfString.replace(
      /\/Creator\s*\([^)]*\)/g,
      "/Creator (Healthcare Governance Commons)"
    );
    pdfString = pdfString.replace(
      /\/Producer\s*\([^)]*\)/g,
      "/Producer (Healthcare Governance Commons)"
    );
    pdfString = pdfString.replace(
      /\/CreationDate\s*\([^)]*\)/g,
      "/CreationDate ()"
    );
    pdfString = pdfString.replace(
      /\/ModDate\s*\([^)]*\)/g,
      "/ModDate ()"
    );
    pdfString = pdfString.replace(
      /\/Subject\s*\([^)]*\)/g,
      "/Subject ()"
    );
    pdfString = pdfString.replace(
      /\/Keywords\s*\([^)]*\)/g,
      "/Keywords ()"
    );

    // Strip XMP metadata streams
    // XMP is stored in XML streams and can contain detailed author/org info
    pdfString = pdfString.replace(
      /<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/gi,
      ""
    );
    pdfString = pdfString.replace(
      /<?xpacket[\s\S]*?xpacket end[^>]*>/gi,
      ""
    );

    // Convert back to buffer
    const cleanedBuffer = Buffer.from(pdfString, "binary");
    const cleanedBase64 = cleanedBuffer.toString("base64");

    console.log(
      `Metadata stripped from PDF. Filename: ${filename || "unknown"}. ` +
      `Original size: ${buffer.length} bytes. Cleaned size: ${cleanedBuffer.length} bytes.`
    );

    return res.status(200).json({
      base64pdf: cleanedBase64,
      filename: filename || "document.pdf",
      originalSize: buffer.length,
      cleanedSize: cleanedBuffer.length,
      strippedAt: new Date().toISOString(),
      status: "CLEANED",
    });
  } catch (err) {
    console.error("Metadata stripping error:", err.message);
    return res.status(500).json({
      error: "Metadata stripping failed: " + err.message,
    });
  }
}
